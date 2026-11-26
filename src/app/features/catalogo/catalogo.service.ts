import { inject, Injectable } from '@angular/core';
import { EstadoEntrada, EstadoOrden, EstadoPelicula, FormatoFuncion, Genero, IdiomaFuncion, Pelicula, } from '../../core/models/database.types';
import { ESTADOS_ENTRADA, ESTADOS_FUNCION, ESTADOS_ORDEN, ESTADOS_PELICULA, } from '../../core/models/constantes';
import { SupabaseService } from '../../core/supabase.service';
import { Result, fail, ok } from '../../core/utils/result';
import { traducirError } from '../../core/utils/errores';

export interface PeliculaConGeneros extends Pelicula {
  generos: Genero[];
}

export interface PeliculaVentas extends PeliculaConGeneros {
  entradas_vendidas: number;
  es_relleno_destacada?: boolean;
}

export interface FuncionCatalogoItem {
  id: string;
  inicio: string;
  fin: string;
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  estado: string;
  sala_nombre: string;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogoService {
  private readonly supabase = inject(SupabaseService);

  private mapearGeneros(row: Record<string, unknown>): PeliculaConGeneros {
    const rawPg = (row['pelicula_generos'] as Array<{ generos?: Genero | null }> | null) ?? [];
    const generos = rawPg
      .map((pg) => pg.generos)
      .filter((g): g is Genero => Boolean(g && g.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const { pelicula_generos: _pg, ...resto } = row;
    return {
      ...(resto as unknown as Pelicula),
      generos,
    };
  }

  /**
   * RF-CAT-01: Top 3 películas más vendidas activas en cartelera.
   * Cuenta entradas 'valida' o 'usada' excluyendo entradas y órdenes 'cancelada'.
   * Si hay menos de 3 películas con ventas, completa con destacadas activas en cartelera.
   */
  async getTop3Vendidas(): Promise<Result<PeliculaVentas[]>> {
    const [resPelis, resEntradas] = await Promise.all([
      this.supabase.client
        .from('peliculas')
        .select('*, pelicula_generos(generos(id, nombre, slug))')
        .eq('activa', true)
        .eq('estado', ESTADOS_PELICULA.EN_CARTELERA as EstadoPelicula)
        .order('orden_destacada', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true }),
      this.supabase.client
        .from('entradas')
        .select('id, estado, funciones!inner(pelicula_id, estado), ordenes!inner(estado)')
        .in('estado', [ESTADOS_ENTRADA.VALIDA, ESTADOS_ENTRADA.USADA] as EstadoEntrada[])
        .neq('funciones.estado', ESTADOS_FUNCION.CANCELADA)
        .neq('ordenes.estado', ESTADOS_ORDEN.CANCELADA as EstadoOrden),
    ]);

    if (resPelis.error) {
      return fail(traducirError(resPelis.error));
    }
    if (resEntradas.error) {
      return fail(traducirError(resEntradas.error));
    }

    const peliculas = (resPelis.data ?? []).map((r) =>
      this.mapearGeneros(r as Record<string, unknown>)
    );
    const conteo: Record<string, number> = {};
    for (const p of peliculas) {
      conteo[p.id] = 0;
    }

    for (const ent of resEntradas.data ?? []) {
      const fn = (ent as unknown as { funciones?: { pelicula_id?: string } }).funciones;
      const pid = fn?.pelicula_id;
      if (pid && conteo[pid] !== undefined) {
        conteo[pid]++;
      }
    }

    const conVentas = peliculas
      .filter((p) => conteo[p.id] > 0)
      .map((p): PeliculaVentas => ({ ...p, entradas_vendidas: conteo[p.id] }))
      .sort((a, b) => b.entradas_vendidas - a.entradas_vendidas || a.id.localeCompare(b.id))
      .slice(0, 3);

    if (conVentas.length >= 3) {
      return ok(conVentas);
    }

    // Completar con destacadas en cartelera (y si aún faltan, con el resto en cartelera)
    const idsUsados = new Set(conVentas.map((p) => p.id));
    const destacadasRelleno = peliculas
      .filter((p) => p.destacada && !idsUsados.has(p.id))
      .map(
        (p): PeliculaVentas => ({
          ...p,
          entradas_vendidas: 0,
          es_relleno_destacada: true,
        })
      );

    const resultado = [...conVentas, ...destacadasRelleno].slice(0, 3);
    if (resultado.length < 3) {
      for (const p of peliculas) {
        if (resultado.length >= 3) break;
        if (!resultado.some((r) => r.id === p.id)) {
          resultado.push({ ...p, entradas_vendidas: 0, es_relleno_destacada: true });
        }
      }
    }

    return ok(resultado);
  }

  /**
   * RF-CAT-02: Películas destacadas activas en cartelera ordenadas por orden_destacada.
   */
  async getPeliculasDestacadas(): Promise<Result<PeliculaConGeneros[]>> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*, pelicula_generos(generos(id, nombre, slug))')
      .eq('activa', true)
      .eq('destacada', true)
      .eq('estado', ESTADOS_PELICULA.EN_CARTELERA as EstadoPelicula)
      .order('orden_destacada', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    return ok((data ?? []).map((r) => this.mapearGeneros(r as Record<string, unknown>)));
  }

  /**
   * RF-CAT-01: Resto de películas activas en cartelera.
   */
  async getPeliculasEnCartelera(): Promise<Result<PeliculaConGeneros[]>> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*, pelicula_generos(generos(id, nombre, slug))')
      .eq('activa', true)
      .eq('estado', ESTADOS_PELICULA.EN_CARTELERA as EstadoPelicula)
      .order('fecha_estreno', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    return ok((data ?? []).map((r) => this.mapearGeneros(r as Record<string, unknown>)));
  }

  /**
   * Próximos estrenos activos (estado = 'proximamente').
   */
  async getPeliculasProximamente(): Promise<Result<PeliculaConGeneros[]>> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*, pelicula_generos(generos(id, nombre, slug))')
      .eq('activa', true)
      .eq('estado', ESTADOS_PELICULA.PROXIMAMENTE as EstadoPelicula)
      .order('fecha_estreno', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    return ok((data ?? []).map((r) => this.mapearGeneros(r as Record<string, unknown>)));
  }

  async getGeneros(): Promise<Result<Genero[]>> {
    const { data, error } = await this.supabase.client
      .from('generos')
      .select('id, nombre, slug')
      .order('nombre', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    return ok((data ?? []) as Genero[]);
  }

  /**
   * RF-CAT-03 / RF-CAT-04: Buscador por texto y filtro por múltiples géneros (OR).
   * Trae TODOS los géneros de cada película sin recortarlos al filtrar.
   */
  async buscarPeliculas(
    termino: string,
    generosIds: string[]
  ): Promise<Result<PeliculaConGeneros[]>> {
    let query = this.supabase.client
      .from('peliculas')
      .select('*, pelicula_generos(generos(id, nombre, slug))')
      .eq('activa', true)
      .neq('estado', ESTADOS_PELICULA.FINALIZADA)
      .order('destacada', { ascending: false })
      .order('titulo', { ascending: true })
      .order('id', { ascending: true });

    const limpio = termino.trim();
    if (limpio !== '') {
      const escapado = limpio.replace(/[%_,]/g, '');
      query = query.or(`titulo.ilike.%${escapado}%,sinopsis.ilike.%${escapado}%`);
    }

    const { data, error } = await query;
    if (error) {
      return fail(traducirError(error));
    }

    let peliculas = (data ?? []).map((r) => this.mapearGeneros(r as Record<string, unknown>));

    // DECISIÓN PROPIA: Filtro OR entre géneros elegidos para no vaciar resultados en carteleras acotadas,
    // preservando todos los géneros originales de cada película en su ficha/tarjeta.
    if (generosIds.length > 0) {
      const setSeleccion = new Set(generosIds);
      peliculas = peliculas.filter((p) => p.generos.some((g) => setSeleccion.has(g.id)));
    }

    return ok(peliculas);
  }

  /**
   * RF-CAT-05: Ficha completa de película activa con sus géneros.
   */
  async getPeliculaById(id: string): Promise<Result<PeliculaConGeneros>> {
    const { data, error } = await this.supabase.client
      .from('peliculas')
      .select('*, pelicula_generos(generos(id, nombre, slug))')
      .eq('id', id)
      .eq('activa', true)
      .single();

    if (error || !data) {
      return fail(traducirError(error ?? 'Película no encontrada.'));
    }

    return ok(this.mapearGeneros(data as Record<string, unknown>));
  }

  /**
   * RF-CAT-06: Funciones futuras, activas (sala activa) y programadas (no canceladas).
   */
  async getFuncionesDisponibles(peliculaId: string): Promise<Result<FuncionCatalogoItem[]>> {
    const ahoraIso = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('funciones')
      .select('id, inicio, fin, formato, idioma, precio_base, estado, salas!inner(nombre, activa)')
      .eq('pelicula_id', peliculaId)
      .eq('estado', ESTADOS_FUNCION.PROGRAMADA)
      .eq('salas.activa', true)
      .gt('inicio', ahoraIso)
      .order('inicio', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    const items: FuncionCatalogoItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const sala = row['salas'] as { nombre?: string } | null;
      return {
        id: String(row['id']),
        inicio: String(row['inicio']),
        fin: String(row['fin']),
        formato: row['formato'] as FormatoFuncion,
        idioma: row['idioma'] as IdiomaFuncion,
        precio_base: Number(row['precio_base']),
        estado: String(row['estado']),
        sala_nombre: sala?.nombre ?? 'Sala',
      };
    });

    return ok(items);
  }
}