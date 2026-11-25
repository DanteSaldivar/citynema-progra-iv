import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AdminFuncionesService {

    private supabase = inject(SupabaseService);

  async getPeliculasActivas() {
    const { data, error } = await this.supabase.client.from('peliculas').select('id, titulo, duracion_min').eq('activa', true);
    if (error) throw error;
    return data;
  }

  /**
   * REGLA DE NEGOCIO: Asignación automática de sala sin superposiciones y con 30 min de limpieza.
   */
  async programarFuncion(peliculaId: string, duracionMinutos: number, fechaHoraInicio: Date, formato: string, idioma: string, precioBase: number) {
    // 1. Calcular el horario de fin de esta nueva función (Duración + 30 min de limpieza)
    const inicioMs = fechaHoraInicio.getTime();
    const finMs = inicioMs + (duracionMinutos * 60000) + (30 * 60000); 
    
    const inicioISO = new Date(inicioMs).toISOString();
    const finISO = new Date(finMs).toISOString();

    // 2. Traer todas las salas
    const { data: salas, error: errSalas } = await this.supabase.client.from('salas').select('id, nombre');
    if (errSalas || !salas) throw new Error('Error al cargar las salas del cine.');

    // 3. Buscar funciones que ocurran en ese mismo rango de tiempo para descartar salas
    // Buscamos funciones cuyo (inicio < nuevoFin) Y (fin_estimado > nuevoInicio)
    const { data: superposiciones, error: errSuperp } = await this.supabase.client
      .from('funciones')
      .select('sala_id')
      .lt('inicio', finISO)
      .gt('fin_estimado', inicioISO);

    if (errSuperp) throw new Error('Error al verificar disponibilidad de salas.');

    const salasOcupadas = new Set(superposiciones.map(f => f.sala_id));

    // 4. Encontrar la primera sala que NO esté en el Set de ocupadas
    const salaDisponible = salas.find(s => !salasOcupadas.has(s.id));

    if (!salaDisponible) {
      throw new Error('No hay ninguna sala disponible en ese horario. Por favor, elegí otra hora.');
    }

    // 5. Crear la función asignando la sala automáticamente
    const { data: nuevaFuncion, error: errInsert } = await this.supabase.client
      .from('funciones')
      .insert({
        pelicula_id: peliculaId,
        sala_id: salaDisponible.id,
        inicio: inicioISO,
        fin_estimado: finISO, // Guardamos el fin calculado (con los 30 min) para facilitar futuras queries
        formato: formato,
        idioma: idioma,
        precio_base: precioBase,
        estado: 'programada'
      })
      .select()
      .single();

    if (errInsert) throw new Error(`Error guardando la función: ${errInsert.message}`);

    return { funcion: nuevaFuncion, sala: salaDisponible };
  }
}