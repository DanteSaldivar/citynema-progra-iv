import { inject, Injectable } from '@angular/core';
import { Butaca, FormatoFuncion, Funcion, IdiomaFuncion, Pelicula, Sala, } from '../models/database.types';
import { SupabaseService } from '../supabase.service';
import { ConfiguracionService } from './configuracion.service';
import { AuditService } from './audit.service';
import { ESTADOS_FUNCION } from '../models/constantes';
import { traducirError } from '../utils/errores';
import { obtenerPartesAR } from '../utils/fechas';

@Injectable({
  providedIn: 'root',
})
export class FuncionesService {
 private readonly supabase = inject(SupabaseService);
  private readonly configService = inject(ConfiguracionService);
  private readonly audit = inject(AuditService);

  private readonly MARGEN_DEFAULT_MIN = 30;

  /** Lee el margen configurado en configuracion.margen_funciones_min (fallback 30 min). */
  async obtenerMargenMinutos(): Promise<number> {
    await this.configService.cargar();
    const valor = Number(this.configService.get<number>('margen_funciones_min', this.MARGEN_DEFAULT_MIN));
    return Number.isFinite(valor) ? Math.max(0, valor) : this.MARGEN_DEFAULT_MIN;
  }


  async hayConflicto(
    salaId: string,
    inicio: Date,
    fin: Date,
    funcionIdExcluida?: string,
    margenMinutos?: number
  ): Promise<boolean> {
    const margen = margenMinutos ?? (await this.obtenerMargenMinutos());
    const margenMs = margen * 60 * 1000;

    const limiteSuperiorInicioExistente = new Date(fin.getTime() + margenMs).toISOString();
    const limiteInferiorFinExistente = new Date(inicio.getTime() - margenMs).toISOString();

    let query = this.supabase.client
      .from('funciones')
      .select('id, inicio, fin')
      .eq('sala_id', salaId)
      .neq('estado', ESTADOS_FUNCION.CANCELADA)
      .lt('inicio', limiteSuperiorInicioExistente)
      .gt('fin', limiteInferiorFinExistente);

    if (funcionIdExcluida) {
      query = query.neq('id', funcionIdExcluida);
    }

    const { data: solapadas, error } = await query;
    if (error) {
      throw new Error(traducirError(error));
    }

    return Boolean(solapadas && solapadas.length > 0);
  }


  async asignarSalaAutomatica(
    inicio: Date,
    fin: Date,
    margenMinutos?: number
  ): Promise<Sala> {
    const margen = margenMinutos ?? (await this.obtenerMargenMinutos());

    const { data: salas, error } = await this.supabase.client
      .from('salas')
      .select('*')
      .eq('activa', true)
      .order('numero', { ascending: true })
      .order('id', { ascending: true });

    if (error || !salas || salas.length === 0) {
      throw new Error('No hay salas activas disponibles en el sistema.');
    }

    for (const sala of salas as Sala[]) {
      const enConflicto = await this.hayConflicto(sala.id, inicio, fin, undefined, margen);
      if (!enConflicto) {
        return sala;
      }
    }

    throw new Error(
      `Todas las salas activas están ocupadas o dentro del margen de limpieza de ${margen} minutos para ese horario.`
    );
  }

  /** Valida que el inicio sea futuro en AR y no anterior a la fecha de estreno de la película. */
  validarHorarioPelicula(inicio: Date, fechaEstrenoYMD: string): string | null {
    if (Number.isNaN(inicio.getTime())) {
      return 'La fecha u hora seleccionada no es válida.';
    }

    if (inicio.getTime() <= Date.now()) {
      return 'No se pueden programar funciones en una fecha u hora pasada.';
    }

    const pInicio = obtenerPartesAR(inicio);
    const fechaFuncionYMD = `${pInicio.anio}-${String(pInicio.mes).padStart(2, '0')}-${String(pInicio.dia).padStart(2, '0')}`;

    if (fechaFuncionYMD < fechaEstrenoYMD) {
      return `La función (${fechaFuncionYMD}) no puede programarse antes del estreno (${fechaEstrenoYMD}).`;
    }

    return null;
  }


  async crearFuncionAutomatica(params: {
    peliculaId: string;
    inicio: Date;
    formato: FormatoFuncion;
    idioma: IdiomaFuncion;
    precioBase: number;
    userId: string;
  }): Promise<Funcion> {
    const { data: pelicula, error: errPeli } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, fecha_estreno, activa')
      .eq('id', params.peliculaId)
      .single();

    if (errPeli || !pelicula) {
      throw new Error('Película no encontrada.');
    }

    const peli = pelicula as Pick<Pelicula, 'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'activa'>;
    if (!peli.activa) {
      throw new Error('No se pueden programar funciones para una película inactiva.');
    }

    const errorHorario = this.validarHorarioPelicula(params.inicio, peli.fecha_estreno);
    if (errorHorario) {
      throw new Error(errorHorario);
    }

    if (!Number.isFinite(params.precioBase) || params.precioBase <= 0) {
      throw new Error('El precio base debe ser mayor a cero.');
    }

    const margen = await this.obtenerMargenMinutos();
    const fin = new Date(params.inicio.getTime() + peli.duracion_min * 60 * 1000);
    const salaAsignada = await this.asignarSalaAutomatica(params.inicio, fin, margen);

    const { data: nuevaFuncion, error: errInsert } = await this.supabase.client
      .from('funciones')
      .insert({
        pelicula_id: params.peliculaId,
        sala_id: salaAsignada.id,
        inicio: params.inicio.toISOString(),
        fin: fin.toISOString(),
        formato: params.formato,
        idioma: params.idioma,
        precio_base: Number(params.precioBase),
        estado: ESTADOS_FUNCION.PROGRAMADA,
        created_by: params.userId,
      })
      .select('*')
      .single();

    if (errInsert || !nuevaFuncion) {
      throw new Error(traducirError(errInsert));
    }

    const creada = nuevaFuncion as Funcion;

    await this.audit.registrar({
      accion: 'crear_funcion',
      entidad: 'funciones',
      entidad_id: creada.id,
      datos_despues: {
        modo: 'individual',
        pelicula_id: creada.pelicula_id,
        pelicula_titulo: peli.titulo,
        sala_id: salaAsignada.id,
        sala_nombre: salaAsignada.nombre,
        inicio: creada.inicio,
        fin: creada.fin,
        formato: creada.formato,
        idioma: creada.idioma,
        precio_base: creada.precio_base,
      },
    });

    return creada;
  }


  // Consultas públicas / compra (mapa-butacas y pelicula-detalle)


  async getButacasDeFuncion(funcionId: string): Promise<{ salaId: string; butacas: Butaca[] }> {
    const { data: funcion, error: errFuncion } = await this.supabase.client
      .from('funciones')
      .select('sala_id')
      .eq('id', funcionId)
      .single();

    if (errFuncion || !funcion) throw new Error('Función no encontrada');

    const { data: butacas, error: errButacas } = await this.supabase.client
      .from('butacas')
      .select('*')
      .eq('sala_id', funcion.sala_id)
      .eq('activa', true)
      .order('numero', { ascending: true });

    if (errButacas) throw new Error('Error al cargar las butacas');

    return {
      salaId: funcion.sala_id,
      butacas: butacas as Butaca[],
    };
  }

  async getNombrePelicula(funcionId: string) {
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select(`
        pelicula_id,
        peliculas (
          titulo,
          poster_url,
          duracion_min,
          clasificacion
        )
      `)
      .eq('id', funcionId)
      .single();

    if (error || !data) {
      throw new Error('Función no encontrada');
    }
    return data.peliculas;
  }

  async getFuncion(funcionId: string) {
    const { data: funcion, error: errFuncion } = await this.supabase.client
      .from('funciones')
      .select(`
        *,
        salas (
          nombre
        )
      `)
      .eq('id', funcionId)
      .single();

    if (errFuncion || !funcion) throw new Error('Función no encontrada');
    return funcion;
  }
}