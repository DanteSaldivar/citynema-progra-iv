import { inject, Injectable } from '@angular/core';
import { Pelicula } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase.service';

export interface PeliculaVentas extends Pelicula {
  entradas_vendidas: number;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {

  /**
   * Obtiene las películas marcadas por el admin para aparecer al entrar a la página.
   * RF-CAT-02: El cliente pidió poder elegir qué películas aparecen en la página principal[cite: 5].
   */

  private readonly supabaseService = inject(SupabaseService);

  async getPeliculasDestacadas(): Promise<Pelicula[]> {
    const { data, error } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('destacada', true)
      .eq('activa', true)
      .order('orden_destacada', { ascending: true });

    if (error) throw new Error(`Error al cargar destacadas: ${error.message}`);
    return data || [];
  }

  /**
   * Calcula y devuelve las 3 películas con más entradas vendidas.
   * RF-CAT-01: El cliente solicitó que se muestren primero las 3 películas más vendidas[cite: 5].
   * Nota técnica: Al no usar vistas SQL, traemos las entradas válidas y agrupamos en memoria.
   */
  async getTop3Vendidas(): Promise<PeliculaVentas[]> {
    // 1. Traer todas las películas activas
    const { data: peliculas, error: errPeliculas } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('activa', true);

    if (errPeliculas || !peliculas) throw new Error('Error al cargar catálogo para el top 3.');

    // 2. Traer las entradas válidas asociadas a sus funciones
    const { data: entradas, error: errEntradas } = await this.supabaseService.client
      .from('entradas')
      .select(`
        id,
        estado,
        funciones (
          pelicula_id
        )
      `)
      .in('estado', ['valida', 'usada']);

    if (errEntradas) throw new Error('Error al cargar ventas.');

    // 3. Agrupar y contar ventas por película en TypeScript
    const conteoVentas: Record<string, number> = {};
    peliculas.forEach(p => conteoVentas[p.id] = 0);

    entradas?.forEach((entrada: any) => {
      const peliculaId = entrada.funciones?.pelicula_id;
      if (peliculaId && conteoVentas[peliculaId] !== undefined) {
        conteoVentas[peliculaId]++;
      }
    });

    // 4. Mapear, ordenar y tomar las 3 primeras
    const peliculasConVentas: PeliculaVentas[] = peliculas.map(p => ({
      ...p,
      entradas_vendidas: conteoVentas[p.id]
    }));

    return peliculasConVentas
      .sort((a, b) => b.entradas_vendidas - a.entradas_vendidas)
      .slice(0, 3);
  }

  /**
   * Obtiene la lista de todos los géneros disponibles para los filtros.
   */
  async getGeneros() {
    const { data, error } = await this.supabaseService.client
      .from('generos')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw new Error(`Error al cargar géneros: ${error.message}`);
    return data || [];
  }

  /**
   * Obtiene la lista preventas.
   */
  async getPeliculasPreventa(): Promise<Pelicula[]> {
    const { data, error } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('estado', 'proximamente')
      .eq('activa', true);

    if (error) throw new Error(`Error al cargar preventas: ${error.message}`);
    return data || [];
  }



  /**
   * RF-CAT-03 / RF-CAT-04: Búsqueda por texto (título/sinopsis) y filtro por múltiples géneros.
   * Nota de arquitectura: La consulta a Supabase trae las películas con sus géneros asociados 
   * mediante un join implícito (!inner) para poder filtrar correctamente.
   */
  async buscarPeliculas(termino: string, generosIds: string[]): Promise<Pelicula[]> {
    let query = this.supabaseService.client
      .from('peliculas')
      .select(`
        *,
        pelicula_generos!inner (
          genero_id
        )
      `)
      .eq('activa', true);

    // Filtro por texto en título o sinopsis
    if (termino && termino.trim() !== '') {
      query = query.or(`titulo.ilike.%${termino}%,sinopsis.ilike.%${termino}%`);
    }

    // Filtro por múltiples géneros (si seleccionó alguno)
    if (generosIds && generosIds.length > 0) {
      query = query.in('pelicula_generos.genero_id', generosIds);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Error en la búsqueda: ${error.message}`);

    // Como una película con varios géneros puede venir duplicada en el join, filtramos únicos
    const unicas = Array.from(new Map((data || []).map((p: any) => [p.id, p])).values());

    return unicas as Pelicula[];
  }

  /**
   * RF-CAT-05: Ficha de película con géneros.
   */
  async getPeliculaById(id: string): Promise<Pelicula | null> {
    const { data, error } = await this.supabaseService.client
      .from('peliculas')
      .select(`
        *,
        pelicula_generos (
          generos ( nombre )
        )
      `)
      .eq('id', id)
      .single();


    if (error) throw new Error(`Error al cargar la película: ${error.message}`);
    const pelicula = data as any;

    return {
      ...pelicula,
      pelicula_generos: pelicula.pelicula_generos
        ?.map((pg: any) => pg.generos?.nombre)
        .filter(Boolean) ?? []
    };
  }

  /**
   * RF-RES-03: Calcula y muestra la puntuación promedio de cada película junto con la cantidad de reseñas.
   * Se agrupa en TS porque no usamos funciones SQL/vistas por requerimiento arquitectónico.
   */
  async getResumenResenas(peliculaId: string): Promise<{ promedio: number, total: number }> {
    const { data, error } = await this.supabaseService.client
      .from('resenias')
      .select('puntaje')
      .eq('pelicula_id', peliculaId);

    if (error) {
      console.error('Error cargando reseñas', error);
      return { promedio: 0, total: 0 };
    }

    const total = data.length;
    if (total === 0) return { promedio: 0, total: 0 };

    const suma = data.reduce((acc, curr) => acc + curr.puntaje, 0);
    return { promedio: Number((suma / total).toFixed(1)), total };
  }

  /**
   * RF-CAT-06: Lista las funciones disponibles indicando fecha, hora, sala, formato e idioma.
   */
  async getFuncionesDisponibles(peliculaId: string) {
    const ahora = new Date().toISOString();
    const { data, error } = await this.supabaseService.client
      .from('funciones')
      .select(`
        id, inicio, formato, idioma, precio_base, estado,
        salas ( nombre )
      `)
      .eq('pelicula_id', peliculaId)
      .eq('estado', 'programada')
      .gt('inicio', ahora) // Solo funciones futuras
      .order('inicio', { ascending: true });



    if (error) throw new Error(`Error al cargar funciones: ${error.message}`);
    return data;
  }

}