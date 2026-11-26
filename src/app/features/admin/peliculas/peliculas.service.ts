import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../../core/supabase.service';
import { AuditService } from '../../../core/services/audit.service';
import {
  ClasificacionPelicula,
  EstadoPelicula,
  Genero,
  Pelicula,
} from '../../../core/models/database.types';
import { ESTADOS_FUNCION } from '../../../core/models/constantes';
import { Result, fail, ok } from '../../../core/utils/result';
import { traducirError } from '../../../core/utils/errores';

export interface PeliculaAdminItem extends Pelicula {
  generos: Genero[];
}

export interface GuardarPeliculaDTO {
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  clasificacion: ClasificacionPelicula;
  fecha_estreno: string;
  estado: EstadoPelicula;
  destacada: boolean;
  orden_destacada: number | null;
  preventa_habilitada: boolean;
  preventa_dias: number;
  preventa_pct: number | null;
  generos_ids: string[];
}

export interface FiltroPeliculasAdmin {
  busqueda?: string;
  estado?: EstadoPelicula | 'todos';
  soloActivas?: boolean;
  pagina: number;
  tamanioPagina: number;
}

export interface PaginaPeliculasAdmin {
  items: PeliculaAdminItem[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class PeliculasService {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);
  private readonly tabla = 'peliculas';
  private readonly bucket = 'posters';

  private readonly extensionesPermitidas: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  private readonly maxBytesPoster = 5 * 1024 * 1024; // 5 MB

  /** Lista paginada para administración con búsqueda, filtro por estado y orden estable. */
  async listarAdmin(filtro: FiltroPeliculasAdmin): Promise<Result<PaginaPeliculasAdmin>> {
    const desde = (filtro.pagina - 1) * filtro.tamanioPagina;
    const hasta = desde + filtro.tamanioPagina - 1;

    let query = this.supabase.client
      .from(this.tabla)
      .select('*, pelicula_generos(generos(id, nombre, slug))', { count: 'exact' })
      .order('destacada', { ascending: false })
      .order('fecha_estreno', { ascending: false })
      .order('id', { ascending: true })
      .range(desde, hasta);

    if (filtro.soloActivas) {
      query = query.eq('activa', true);
    }

    if (filtro.estado && filtro.estado !== 'todos') {
      query = query.eq('estado', filtro.estado);
    }

    const termino = filtro.busqueda?.trim();
    if (termino) {
      query = query.ilike('titulo', `%${termino}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return fail(traducirError(error));
    }

    const items: PeliculaAdminItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const relaciones = (row['pelicula_generos'] as Array<{ generos: Genero | null }> | null) ?? [];
      const generos = relaciones
        .map((r) => r.generos)
        .filter((g): g is Genero => g !== null);

      const { pelicula_generos: _omit, ...peliculaBase } = row;
      return {
        ...(peliculaBase as unknown as Pelicula),
        generos,
      };
    });

    return ok({
      items,
      total: count ?? 0,
    });
  }

  private validarYSubirPoster(poster: File): { ok: true; extension: string } | { ok: false; error: string } {
    const extension = this.extensionesPermitidas[poster.type];
    if (!extension) {
      return { ok: false, error: 'El formato del póster no es válido. Usá JPG, PNG o WebP.' };
    }
    if (poster.size > this.maxBytesPoster) {
      return { ok: false, error: 'El póster no puede superar los 5 MB.' };
    }
    return { ok: true, extension };
  }

  private async subirPosterStorage(poster: File): Promise<Result<{ ruta: string; publicUrl: string }>> {
    const validacion = this.validarYSubirPoster(poster);
    if (!validacion.ok) {
      return fail(validacion.error);
    }

    const ruta = `${crypto.randomUUID()}.${validacion.extension}`;
    const { error: errorStorage } = await this.supabase.client.storage
      .from(this.bucket)
      .upload(ruta, poster, {
        contentType: poster.type,
        upsert: false,
      });

    if (errorStorage) {
      return fail(traducirError(errorStorage));
    }

    const { data: imagen } = this.supabase.client.storage.from(this.bucket).getPublicUrl(ruta);
    return ok({ ruta, publicUrl: imagen.publicUrl });
  }

  private async eliminarPosterStorageSilencioso(ruta: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from(this.bucket).remove([ruta]);
    if (error) {
      console.error('No se pudo eliminar el póster en Storage:', error);
    }
  }

  /**
   * RF-ADM-01 / RF-CAT-01 / RN-19: Alta completa de película + asignación de géneros en pelicula_generos + audit_log.
   */
  async crear(dto: GuardarPeliculaDTO, poster: File): Promise<Result<Pelicula>> {
    const subida = await this.subirPosterStorage(poster);
    if (!subida.ok) {
      return fail(subida.error);
    }

    const payload = {
      titulo: dto.titulo.trim(),
      sinopsis: dto.sinopsis.trim(),
      duracion_min: Number(dto.duracion_min),
      poster_url: subida.data.publicUrl,
      clasificacion: dto.clasificacion,
      fecha_estreno: dto.fecha_estreno,
      estado: dto.estado,
      destacada: dto.destacada,
      orden_destacada: dto.destacada ? dto.orden_destacada : null,
      preventa_habilitada: dto.preventa_habilitada,
      preventa_dias: dto.preventa_habilitada ? Number(dto.preventa_dias) : 7,
      preventa_pct: dto.preventa_habilitada ? dto.preventa_pct : null,
      activa: true,
    };

    const { data: creada, error: errorInsert } = await this.supabase.client
      .from(this.tabla)
      .insert(payload)
      .select('*')
      .single();

    if (errorInsert || !creada) {
      await this.eliminarPosterStorageSilencioso(subida.data.ruta);
      return fail(traducirError(errorInsert));
    }

    const pelicula = creada as Pelicula;

    // Insertar géneros asociados en pelicula_generos
    const generosUnicos = Array.from(new Set(dto.generos_ids));
    if (generosUnicos.length > 0) {
      const filasGeneros = generosUnicos.map((genero_id) => ({
        pelicula_id: pelicula.id,
        genero_id,
      }));
      const { error: errGen } = await this.supabase.client
        .from('pelicula_generos')
        .insert(filasGeneros);

      if (errGen) {
        return fail(traducirError(errGen));
      }
    }

    await this.audit.registrar({
      accion: 'crear_pelicula',
      entidad: 'peliculas',
      entidad_id: pelicula.id,
      datos_despues: {
        titulo: pelicula.titulo,
        clasificacion: pelicula.clasificacion,
        estado: pelicula.estado,
        generos_ids: generosUnicos,
      },
    });

    return ok(pelicula);
  }

  /**
   * RF-ADM-01 / RN-19: Edición completa de película, reemplazo opcional de póster y sincronización de pelicula_generos.
   */
  async editar(
    peliculaId: string,
    dto: GuardarPeliculaDTO,
    posterNuevo?: File | null
  ): Promise<Result<Pelicula>> {
    const { data: anterior, error: errPrev } = await this.supabase.client
      .from(this.tabla)
      .select('*')
      .eq('id', peliculaId)
      .single();

    if (errPrev || !anterior) {
      return fail(traducirError(errPrev ?? 'No se encontró la película a editar.'));
    }

    let posterUrl = (anterior as Pelicula).poster_url;
    let rutaSubidaNueva: string | null = null;

    if (posterNuevo) {
      const subida = await this.subirPosterStorage(posterNuevo);
      if (!subida.ok) {
        return fail(subida.error);
      }
      posterUrl = subida.data.publicUrl;
      rutaSubidaNueva = subida.data.ruta;
    }

    const payload = {
      titulo: dto.titulo.trim(),
      sinopsis: dto.sinopsis.trim(),
      duracion_min: Number(dto.duracion_min),
      poster_url: posterUrl,
      clasificacion: dto.clasificacion,
      fecha_estreno: dto.fecha_estreno,
      estado: dto.estado,
      destacada: dto.destacada,
      orden_destacada: dto.destacada ? dto.orden_destacada : null,
      preventa_habilitada: dto.preventa_habilitada,
      preventa_dias: dto.preventa_habilitada ? Number(dto.preventa_dias) : 7,
      preventa_pct: dto.preventa_habilitada ? dto.preventa_pct : null,
      updated_at: new Date().toISOString(),
    };

    const { data: actualizada, error: errUpdate } = await this.supabase.client
      .from(this.tabla)
      .update(payload)
      .eq('id', peliculaId)
      .select('*')
      .single();

    if (errUpdate || !actualizada) {
      if (rutaSubidaNueva) {
        await this.eliminarPosterStorageSilencioso(rutaSubidaNueva);
      }
      return fail(traducirError(errUpdate));
    }

    // Sincronizar géneros (borrar anteriores e insertar actuales en secuencia)
    const { error: errDelGen } = await this.supabase.client
      .from('pelicula_generos')
      .delete()
      .eq('pelicula_id', peliculaId);

    if (errDelGen) {
      return fail(traducirError(errDelGen));
    }

    const generosUnicos = Array.from(new Set(dto.generos_ids));
    if (generosUnicos.length > 0) {
      const filasGeneros = generosUnicos.map((genero_id) => ({
        pelicula_id: peliculaId,
        genero_id,
      }));
      const { error: errInsGen } = await this.supabase.client
        .from('pelicula_generos')
        .insert(filasGeneros);

      if (errInsGen) {
        return fail(traducirError(errInsGen));
      }
    }

    const pelicula = actualizada as Pelicula;

    await this.audit.registrar({
      accion: 'editar_pelicula',
      entidad: 'peliculas',
      entidad_id: pelicula.id,
      datos_antes: {
        titulo: anterior.titulo,
        clasificacion: anterior.clasificacion,
        estado: anterior.estado,
        destacada: anterior.destacada,
        preventa_habilitada: anterior.preventa_habilitada,
      },
      datos_despues: {
        titulo: pelicula.titulo,
        clasificacion: pelicula.clasificacion,
        estado: pelicula.estado,
        destacada: pelicula.destacada,
        preventa_habilitada: pelicula.preventa_habilitada,
        generos_ids: generosUnicos,
      },
    });

    return ok(pelicula);
  }

  /** Cuenta funciones futuras programadas de una película para advertir antes de dar baja lógica. */
  async contarFuncionesFuturas(peliculaId: string): Promise<Result<number>> {
    const ahoraISO = new Date().toISOString();

    const { count, error } = await this.supabase.client
      .from('funciones')
      .select('*', { count: 'exact', head: true })
      .eq('pelicula_id', peliculaId)
      .eq('estado', ESTADOS_FUNCION.PROGRAMADA)
      .gte('inicio', ahoraISO);

    if (error) {
      return fail(traducirError(error));
    }

    return ok(count ?? 0);
  }

  /**
   * Baja lógica (activa = true/false). No cancela funciones automáticamente.
   */
  async cambiarEstadoActiva(peliculaId: string, activa: boolean): Promise<Result<Pelicula>> {
    const { data, error } = await this.supabase.client
      .from(this.tabla)
      .update({ activa, updated_at: new Date().toISOString() })
      .eq('id', peliculaId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const pelicula = data as Pelicula;

    await this.audit.registrar({
      accion: activa ? 'activar_pelicula' : 'desactivar_pelicula',
      entidad: 'peliculas',
      entidad_id: pelicula.id,
      datos_antes: { activa: !activa },
      datos_despues: { activa, titulo: pelicula.titulo },
    });

    return ok(pelicula);
  }
}