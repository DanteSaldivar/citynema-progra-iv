import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { Result, fail, ok } from '../../core/utils/result';
import { traducirError } from '../../core/utils/errores';

export interface ReseniaItem {
  id: string;
  pelicula_id: string;
  user_id: string;
  puntaje: number;
  comentario: string | null;
  created_at: string;
  autor_nombre: string;
}

export interface ResumenResenas {
  promedio: number;
  total: number;
}

export interface PaginaResenas {
  items: ReseniaItem[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class ResenasService {
  private readonly supabase = inject(SupabaseService);

  /**
   * RF-RES-03: Calcula promedio y cantidad de reseñas al vuelo (sin guardar denormalizado).
   */
  async obtenerResumen(peliculaId: string): Promise<Result<ResumenResenas>> {
    const { data, error } = await this.supabase.client
      .from('resenias')
      .select('puntaje')
      .eq('pelicula_id', peliculaId);

    if (error) {
      return fail(traducirError(error));
    }

    const lista = data ?? [];
    const total = lista.length;
    if (total === 0) {
      return ok({ promedio: 0, total: 0 });
    }

    const suma = lista.reduce((acc, item) => acc + Number(item.puntaje || 0), 0);
    return ok({
      promedio: Number((suma / total).toFixed(1)),
      total,
    });
  }

  /**
   * RF-RES-03 / RF-CAT-05: Lista reseñas de una película en orden estable con paginación incremental ("Ver más").
   */
  async listarPorPelicula(
    peliculaId: string,
    offset = 0,
    limite = 5
  ): Promise<Result<PaginaResenas>> {
    const { data, error, count } = await this.supabase.client
      .from('resenias')
      .select('id, pelicula_id, user_id, puntaje, comentario, created_at, profiles(nombre, apellido)', {
        count: 'exact',
      })
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + limite - 1);

    if (error) {
      return fail(traducirError(error));
    }

    const items: ReseniaItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const perfil = row['profiles'] as { nombre?: string; apellido?: string } | null;
      const nombreCompleto = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ').trim();

      return {
        id: String(row['id']),
        pelicula_id: String(row['pelicula_id']),
        user_id: String(row['user_id']),
        puntaje: Number(row['puntaje']),
        comentario: (row['comentario'] as string | null) ?? null,
        created_at: String(row['created_at']),
        autor_nombre: nombreCompleto || 'Espectador verificado',
      };
    });

    return ok({ items, total: count ?? items.length });
  }
}