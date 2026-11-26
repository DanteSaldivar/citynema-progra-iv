import { inject, Injectable } from '@angular/core';
import { EstadoFuncion, FormatoFuncion, Funcion, IdiomaFuncion, Pelicula, Sala,
} from '../../../app/core/models/database.types';
import { SupabaseService } from '../../../app/core/supabase.service';
import { FuncionesService } from '../../../app/core/services/funciones.service';
import { AuditService } from '../../../app/core/services/audit.service';
import { ESTADOS_FUNCION } from '../../../app/core/models/constantes';
import { Result, fail, ok } from '../../../app/core/utils/result';
import { traducirError } from '../../../app/core/utils/errores';
import { construirTimestamptzAR, finDelDiaAR, inicioDelDiaAR,} from '../../../app/core/utils/fechas';
import { ItemPrevisualizacionRecurrente, listarFechasCandidatas, simularAsignacionLote, sumarDiasCivilYMD, } from './admin-funciones/funciones-recurrentes.helper';

export { sumarDiasCivilYMD };
export type { ItemPrevisualizacionRecurrente };

export interface FuncionAdminItem extends Funcion {
  pelicula_titulo: string;
  sala_nombre: string;
  sala_numero: number;
}

export interface FiltroFuncionesAdmin {
  fechaYMD?: string;
  peliculaId?: string;
  salaId?: string;
  estado?: EstadoFuncion | 'todos';
  pagina: number;
  tamanioPagina: number;
}

export interface PaginaFuncionesAdmin {
  items: FuncionAdminItem[];
  total: number;
}

export interface ResultadoLoteFunciones {
  creadas: Funcion[];
  omitidas: ItemPrevisualizacionRecurrente[];
}

const MAX_SEMANAS_RECURRENTE = 8;

@Injectable({
  providedIn: 'root',
})
export class AdminFuncionesService {
  private readonly supabase = inject(SupabaseService);
  private readonly funcionesCore = inject(FuncionesService);
  private readonly audit = inject(AuditService);

  async obtenerPeliculasActivas(): Promise<
    Pick<Pelicula, 'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'estado' | 'activa'>[]
  > {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, fecha_estreno, estado, activa')
      .eq('activa', true)
      .order('titulo', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new Error(traducirError(error));
    return (data ?? []) as Pick<
      Pelicula,
      'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'estado' | 'activa'
    >[];
  }

  async obtenerTodasLasPeliculas(): Promise<
    Pick<Pelicula, 'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'estado' | 'activa'>[]
  > {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('id, titulo, duracion_min, fecha_estreno, estado, activa')
      .order('titulo', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new Error(traducirError(error));
    return (data ?? []) as Pick<
      Pelicula,
      'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'estado' | 'activa'
    >[];
  }

  async obtenerSalasActivas(): Promise<Sala[]> {
    const { data, error } = await this.supabase.client
      .from('salas')
      .select('*')
      .eq('activa', true)
      .order('numero', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new Error(traducirError(error));
    return (data ?? []) as Sala[];
  }

  async previsualizarProgramacionRecurrente(params: {
    peliculaId: string;
    fechaDesdeYMD: string;
    fechaHastaYMD: string;
    diasSemana: number[];
    horaHHMM: string;
  }): Promise<Result<ItemPrevisualizacionRecurrente[]>> {
    if (!params.diasSemana.length) return fail('Seleccioná al menos un día de la semana.');
    if (!params.fechaDesdeYMD || !params.fechaHastaYMD || params.fechaDesdeYMD > params.fechaHastaYMD) {
      return fail('El rango de fechas no es válido.');
    }
    if (params.fechaHastaYMD > sumarDiasCivilYMD(params.fechaDesdeYMD, MAX_SEMANAS_RECURRENTE * 7 - 1)) {
      return fail(`El rango máximo permitido es de ${MAX_SEMANAS_RECURRENTE} semanas.`);
    }
    if (!/^\d{1,2}:\d{2}$/.test(params.horaHHMM.trim())) {
      return fail('Ingresá una hora válida (HH:MM).');
    }

    const [resPeli, resSalas] = await Promise.all([
      this.supabase.client
        .from('peliculas')
        .select('id, duracion_min, fecha_estreno, activa')
        .eq('id', params.peliculaId)
        .single(),
      this.supabase.client
        .from('salas')
        .select('*')
        .eq('activa', true)
        .order('numero', { ascending: true })
        .order('id', { ascending: true }),
    ]);

    if (resPeli.error || !resPeli.data || !resPeli.data.activa) {
      return fail('Seleccioná una película activa válida.');
    }
    if (resSalas.error || !resSalas.data?.length) {
      return fail('No hay salas activas disponibles en el sistema.');
    }

    const candidatas = listarFechasCandidatas(params.fechaDesdeYMD, params.fechaHastaYMD, params.diasSemana);
    if (!candidatas.length) {
      return fail('No hay fechas que coincidan con los días seleccionados en ese rango.');
    }

    const margenMin = await this.funcionesCore.obtenerMargenMinutos();
    const margenMs = margenMin * 60 * 1000;
    const primerInicio = new Date(construirTimestamptzAR(candidatas[0], params.horaHHMM));
    const ultimoFin = new Date(
      new Date(construirTimestamptzAR(candidatas[candidatas.length - 1], params.horaHHMM)).getTime() +
        resPeli.data.duracion_min * 60 * 1000
    );

    const { data: existentes, error: errEx } = await this.supabase.client
      .from('funciones')
      .select('sala_id, inicio, fin')
      .neq('estado', ESTADOS_FUNCION.CANCELADA)
      .lt('inicio', new Date(ultimoFin.getTime() + margenMs).toISOString())
      .gt('fin', new Date(primerInicio.getTime() - margenMs).toISOString());

    if (errEx) return fail(traducirError(errEx));

    const items = simularAsignacionLote({
      fechasCandidatas: candidatas,
      horaHHMM: params.horaHHMM,
      duracionMin: resPeli.data.duracion_min,
      fechaEstrenoYMD: resPeli.data.fecha_estreno,
      margenMin,
      salasActivas: resSalas.data as Sala[],
      ocupacionesIniciales: (existentes ?? []).map((f) => ({
        sala_id: f.sala_id,
        inicioMs: new Date(f.inicio).getTime(),
        finMs: new Date(f.fin).getTime(),
      })),
      validarHorario: (ini, est) => this.funcionesCore.validarHorarioPelicula(ini, est),
    });

    return ok(items);
  }

  async crearProgramacionRecurrente(params: {
    peliculaId: string;
    fechaDesdeYMD: string;
    fechaHastaYMD: string;
    diasSemana: number[];
    horaHHMM: string;
    formato: FormatoFuncion;
    idioma: IdiomaFuncion;
    precioBase: number;
    userId: string;
  }): Promise<Result<ResultadoLoteFunciones>> {
    if (!Number.isFinite(params.precioBase) || params.precioBase <= 0) {
      return fail('El precio base debe ser mayor a cero.');
    }

    const resPrev = await this.previsualizarProgramacionRecurrente(params);
    if (!resPrev.ok) return fail(resPrev.error);

    const disponibles = resPrev.data.filter((i) => i.disponible && i.salaAsignada);
    const omitidas = resPrev.data.filter((i) => !i.disponible || !i.salaAsignada);
    if (!disponibles.length) {
      return fail('Ninguna de las fechas seleccionadas tiene sala disponible para programar.');
    }

    const margen = await this.funcionesCore.obtenerMargenMinutos();
    const creadas: Funcion[] = [];

    for (const item of disponibles) {
      try {
        const salaReal = await this.funcionesCore.asignarSalaAutomatica(item.inicio, item.fin, margen);
        const { data: insertada, error: errIns } = await this.supabase.client
          .from('funciones')
          .insert({
            pelicula_id: params.peliculaId,
            sala_id: salaReal.id,
            inicio: item.inicio.toISOString(),
            fin: item.fin.toISOString(),
            formato: params.formato,
            idioma: params.idioma,
            precio_base: Number(params.precioBase),
            estado: ESTADOS_FUNCION.PROGRAMADA,
            created_by: params.userId,
          })
          .select('*')
          .single();

        if (errIns || !insertada) {
          omitidas.push({ ...item, disponible: false, salaAsignada: null, motivoNoDisponible: traducirError(errIns) });
          continue;
        }

        const creada = insertada as Funcion;
        creadas.push(creada);

        await this.audit.registrar({
          accion: 'crear_funcion',
          entidad: 'funciones',
          entidad_id: creada.id,
          datos_despues: { modo: 'recurrente', pelicula_id: params.peliculaId, sala_id: salaReal.id, inicio: creada.inicio },
        });
      } catch (err) {
        omitidas.push({
          ...item,
          disponible: false,
          salaAsignada: null,
          motivoNoDisponible: err instanceof Error ? err.message : 'Sin sala disponible',
        });
      }
    }

    return ok({ creadas, omitidas });
  }

  async listarAdmin(filtro: FiltroFuncionesAdmin): Promise<Result<PaginaFuncionesAdmin>> {
    const desde = (filtro.pagina - 1) * filtro.tamanioPagina;
    let query = this.supabase.client
      .from('funciones')
      .select('*, peliculas(titulo), salas(nombre, numero)', { count: 'exact' })
      .order('inicio', { ascending: false })
      .order('id', { ascending: true })
      .range(desde, desde + filtro.tamanioPagina - 1);

    if (filtro.fechaYMD) {
      query = query.gte('inicio', inicioDelDiaAR(filtro.fechaYMD)).lte('inicio', finDelDiaAR(filtro.fechaYMD));
    }
    if (filtro.peliculaId) query = query.eq('pelicula_id', filtro.peliculaId);
    if (filtro.salaId) query = query.eq('sala_id', filtro.salaId);
    if (filtro.estado && filtro.estado !== 'todos') query = query.eq('estado', filtro.estado);

    const { data, error, count } = await query;
    if (error) return fail(traducirError(error));

    const items: FuncionAdminItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const peli = row['peliculas'] as { titulo?: string } | null;
      const sala = row['salas'] as { nombre?: string; numero?: number } | null;
      const { peliculas: _p, salas: _s, ...base } = row;
      return {
        ...(base as unknown as Funcion),
        pelicula_titulo: peli?.titulo ?? 'Película desconocida',
        sala_nombre: sala?.nombre ?? 'Sala',
        sala_numero: sala?.numero ?? 0,
      };
    });

    return ok({ items, total: count ?? 0 });
  }

  async actualizarPrecioBase(funcionId: string, nuevoPrecio: number): Promise<Result<Funcion>> {
    if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) return fail('El precio base debe ser mayor a cero.');

    const { data: anterior, error: errPrev } = await this.supabase.client
      .from('funciones')
      .select('estado, precio_base')
      .eq('id', funcionId)
      .single();

    if (errPrev || !anterior) return fail(traducirError(errPrev ?? 'Función no encontrada.'));
    if (anterior.estado !== ESTADOS_FUNCION.PROGRAMADA) {
      return fail('Sólo se puede modificar el precio de funciones en estado programada.');
    }

    const { data: actualizada, error: errUpd } = await this.supabase.client
      .from('funciones')
      .update({ precio_base: Number(nuevoPrecio) })
      .eq('id', funcionId)
      .select('*')
      .single();

    if (errUpd || !actualizada) return fail(traducirError(errUpd));

    await this.audit.registrar({
      accion: 'editar_precio_funcion',
      entidad: 'funciones',
      entidad_id: funcionId,
      datos_antes: { precio_base: anterior.precio_base },
      datos_despues: { precio_base: Number(nuevoPrecio) },
    });

    return ok(actualizada as Funcion);
  }

  async cancelarFuncionSiSinEntradas(funcionId: string): Promise<Result<Funcion>> {
    const { count, error: errEntradas } = await this.supabase.client
      .from('entradas')
      .select('*', { count: 'exact', head: true })
      .eq('funcion_id', funcionId);

    if (errEntradas) return fail(traducirError(errEntradas));
    if ((count ?? 0) > 0) {
      return fail(
        `No se puede desactivar esta función porque ya tiene ${count} entrada(s) vendida(s).`
      );
    }

    const { data: actualizada, error: errUpd } = await this.supabase.client
      .from('funciones')
      .update({ estado: ESTADOS_FUNCION.CANCELADA })
      .eq('id', funcionId)
      .select('*')
      .single();

    if (errUpd || !actualizada) return fail(traducirError(errUpd));

    await this.audit.registrar({
      accion: 'desactivar_funcion',
      entidad: 'funciones',
      entidad_id: funcionId,
      datos_antes: { estado: ESTADOS_FUNCION.PROGRAMADA },
      datos_despues: { estado: ESTADOS_FUNCION.CANCELADA },
    });

    return ok(actualizada as Funcion);
  }
}