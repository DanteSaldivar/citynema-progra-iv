import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { AuditService } from './audit.service';
import { Genero } from '../models/database.types';
import { Result, fail, ok } from '../utils/result';
import { traducirError } from '../utils/errores';

export interface GeneroConConteo extends Genero {
  cantidad_peliculas: number;
}

@Injectable({
  providedIn: 'root',
})
export class GenerosService {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);

  private generarSlug(nombre: string): string {
    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Lista todos los géneros ordenados alfabéticamente (desempate por id) junto con el conteo de películas asociadas. */
  async listarConConteo(): Promise<Result<GeneroConConteo[]>> {
    const [resGeneros, resRelaciones] = await Promise.all([
      this.supabase.client
        .from('generos')
        .select('*')
        .order('nombre', { ascending: true })
        .order('id', { ascending: true }),
      this.supabase.client.from('pelicula_generos').select('genero_id'),
    ]);

    if (resGeneros.error) {
      return fail(traducirError(resGeneros.error));
    }

    const conteoPorGenero = new Map<string, number>();
    for (const rel of resRelaciones.data ?? []) {
      const gid = (rel as { genero_id: string }).genero_id;
      conteoPorGenero.set(gid, (conteoPorGenero.get(gid) ?? 0) + 1);
    }

    const lista: GeneroConConteo[] = ((resGeneros.data ?? []) as Genero[]).map((g) => ({
      ...g,
      cantidad_peliculas: conteoPorGenero.get(g.id) ?? 0,
    }));

    return ok(lista);
  }

  async crear(nombre: string): Promise<Result<Genero>> {
    const limpio = nombre.trim();
    const slug = this.generarSlug(limpio);

    if (!limpio || !slug) {
      return fail('Ingresá un nombre válido para el género.');
    }

    const { data, error } = await this.supabase.client
      .from('generos')
      .insert({ nombre: limpio, slug })
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const creado = data as Genero;

    await this.audit.registrar({
      accion: 'crear_genero',
      entidad: 'generos',
      entidad_id: creado.id,
      datos_despues: { nombre: creado.nombre, slug: creado.slug },
    });

    return ok(creado);
  }

  async editar(id: string, nombre: string): Promise<Result<Genero>> {
    const limpio = nombre.trim();
    const slug = this.generarSlug(limpio);

    if (!limpio || !slug) {
      return fail('Ingresá un nombre válido para el género.');
    }

    const { data: anterior } = await this.supabase.client
      .from('generos')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await this.supabase.client
      .from('generos')
      .update({ nombre: limpio, slug })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const actualizado = data as Genero;

    await this.audit.registrar({
      accion: 'editar_genero',
      entidad: 'generos',
      entidad_id: actualizado.id,
      datos_antes: anterior ? { nombre: anterior.nombre, slug: anterior.slug } : null,
      datos_despues: { nombre: actualizado.nombre, slug: actualizado.slug },
    });

    return ok(actualizado);
  }

  /** Cuenta cuántas películas tienen asignado este género. */
  async contarPeliculasAsignadas(generoId: string): Promise<Result<number>> {
    const { count, error } = await this.supabase.client
      .from('pelicula_generos')
      .select('*', { count: 'exact', head: true })
      .eq('genero_id', generoId);

    if (error) {
      return fail(traducirError(error));
    }

    return ok(count ?? 0);
  }

  /**
   * Elimina el género sólo si no tiene películas asignadas.
   * Si tiene asignadas, devuelve fail con el conteo para que la UI avise en modal.
   */
  async eliminar(generoId: string): Promise<Result<void>> {
    const resConteo = await this.contarPeliculasAsignadas(generoId);
    if (!resConteo.ok) {
      return fail(resConteo.error);
    }

    if (resConteo.data > 0) {
      return fail(
        `No se puede eliminar este género porque está asignado a ${resConteo.data} película(s). Quitáselo primero desde la edición de cada película.`
      );
    }

    const { data: anterior } = await this.supabase.client
      .from('generos')
      .select('*')
      .eq('id', generoId)
      .single();

    const { error } = await this.supabase.client.from('generos').delete().eq('id', generoId);

    if (error) {
      return fail(traducirError(error));
    }

    await this.audit.registrar({
      accion: 'eliminar_genero',
      entidad: 'generos',
      entidad_id: generoId,
      datos_antes: anterior ? { nombre: anterior.nombre, slug: anterior.slug } : null,
    });

    return ok(undefined);
  }
}