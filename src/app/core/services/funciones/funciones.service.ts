import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { Butaca, Funcion, Sala } from '../../models/database.types';
import { SupabaseService } from '../../supabase.service';

@Injectable({
  providedIn: 'root'
})
export class FuncionesService {
  private supabase = inject(SupabaseService);
  private readonly MINUTOS_LIMPIEZA = 30; // RN-04: margen mínimo de 30 minutos

  /**
   * RN-04 / RN-05: Chequea si un rango de horarios colisiona con funciones existentes en una sala.
   * Considera la ventana de limpieza de 30 minutos antes y después.
   * Se valida en TypeScript/Angular y no con exclusion constraints de Postgres.
   */
  async hayConflicto(salaId: string, inicio: Date, fin: Date, funcionIdExcluida?: string): Promise<boolean> {
    // Margen de 30 min aplicado a la búsqueda
    const inicioConMargen = new Date(inicio.getTime() - this.MINUTOS_LIMPIEZA * 60 * 1000).toISOString();
    const finConMargen = new Date(fin.getTime() + this.MINUTOS_LIMPIEZA * 60 * 1000).toISOString();

    let query = this.supabase.client
      .from('funciones')
      .select('id, inicio, fin')
      .eq('sala_id', salaId)
      .neq('estado', 'cancelada')
      // Condición de solapamiento: inicio < finConMargen AND fin > inicioConMargen
      .lt('inicio', finConMargen)
      .gt('fin', inicioConMargen);

    if (funcionIdExcluida) {
      query = query.neq('id', funcionIdExcluida);
    }

    const { data: solapadas, error } = await query;
    if (error) {
      throw new Error(`Error al verificar conflictos de sala: ${error.message}`);
    }

    return (solapadas && solapadas.length > 0);
  }

  /**
   * RN-06: Asignación automática de sala.
   * Recorre las salas activas y prueba cada una con hayConflicto() hasta encontrar la primera libre.
   */
  async asignarSalaAutomatica(inicio: Date, fin: Date): Promise<Sala> {
    const { data: salas, error } = await this.supabase.client
      .from('salas')
      .select('*')
      .eq('activa', true)
      .order('numero', { ascending: true });

    if (error || !salas || salas.length === 0) {
      throw new Error('No hay salas activas disponibles en el sistema.');
    }

    for (const sala of salas) {
      const enConflicto = await this.hayConflicto(sala.id, inicio, fin);
      if (!enConflicto) {
        return sala; // Sala asignada con éxito
      }
    }

    throw new Error('No hay ninguna sala disponible que respete la ventana de 30 minutos para el horario solicitado.');
  }

  /**
   * RF-ADM-04 / RF-ADM-05: Da de alta una función calculando su horario de finalización
   * en base a la duración de la película y asignando sala automáticamente si no se provee.
   */
  async crearFuncionAutomatica(params: {
    peliculaId: string;
    inicio: Date;
    formato: '2D' | '3D' | '4D' | '5D';
    idioma: 'castellano' | 'subtitulada';
    precioBase: number;
    userId: string;
  }): Promise<Funcion> {
    // 1. Obtener duración de la película
    const { data: pelicula, error: errPeli } = await this.supabase.client
      .from('peliculas')
      .select('duracion_min')
      .eq('id', params.peliculaId)
      .single();

    if (errPeli || !pelicula) {
      throw new Error('Película no encontrada.');
    }

    // Calcular fin en TS antes de insertar 
    const fin = new Date(params.inicio.getTime() + pelicula.duracion_min * 60 * 1000);

    // 2. Asignación automática de sala (RN-06)
    const salaAsignada = await this.asignarSalaAutomatica(params.inicio, fin);

    // 3. Insertar la función
    const { data: nuevaFuncion, error: errInsert } = await this.supabase.client
      .from('funciones')
      .insert({
        pelicula_id: params.peliculaId,
        sala_id: salaAsignada.id,
        inicio: params.inicio.toISOString(),
        fin: fin.toISOString(),
        formato: params.formato,
        idioma: params.idioma,
        precio_base: params.precioBase,
        estado: 'programada',
        created_by: params.userId
      })
      .select()
      .single();

    if (errInsert) {
      throw new Error(`Error al persistir la función: ${errInsert.message}`);
    }

    /// Me guardo el log de auditoria para ver quien hace que
    await this.supabase.client.from('audit_log').insert({ accion: 'crear_funcion', entidad: 'funciones', entidad_id: nuevaFuncion.id, actor_id: params.userId })

    return nuevaFuncion;
  }

  async getButacasDeFuncion(funcionId: string): Promise<{ salaId: string, butacas: Butaca[] }> {
    // 1. Obtener la sala
    const { data: funcion, error: errFuncion } = await this.supabase.client
      .from('funciones')
      .select('sala_id')
      .eq('id', funcionId)
      .single();

    if (errFuncion || !funcion) throw new Error("Función no encontrada");

    // 2. Traer las butacas de esa sala
    const { data: butacas, error: errButacas } = await this.supabase.client
      .from('butacas')
      .select('*')
      .eq('sala_id', funcion.sala_id)
      .order('numero', { ascending: true });

    if (errButacas) throw new Error("Error al cargar las butacas");

    return {
      salaId: funcion.sala_id,
      butacas: butacas as Butaca[]
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
        salas(
          nombre
        )`)
      .eq('id', funcionId)
      .single();

    if (errFuncion || !funcion) throw new Error("Función no encontrada");
    return funcion;
  }

}