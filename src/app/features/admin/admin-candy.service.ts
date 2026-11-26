import { inject, Injectable } from '@angular/core';
import { CategoriaProducto, Combo, ComboItem, Producto,
} from '../../../app/core/models/database.types';
import { ESTADOS_FUNCION } from '../../../app/core/models/constantes';
import { AuditService } from '../../../app/core/services/audit.service';
import { SupabaseService } from '../../../app/core/supabase.service';
import { traducirError } from '../../../app/core/utils/errores';
import { Result, fail, ok } from '../../../app/core/utils/result';

export interface ProductoAdminItem extends Producto {
  categoria_nombre: string;
  en_uso_combo_o_recompensa: boolean;
}

export interface ComboItemDetalle extends ComboItem {
  producto_nombre: string;
  producto_precio: number;
  producto_activo: boolean;
}

export interface ComboAdminItem extends Combo {
  items: ComboItemDetalle[];
}

export interface FiltroProductosAdmin {
  categoriaId?: string;
  busqueda?: string;
  pagina: number;
  tamanioPagina: number;
}

export interface PaginaProductosAdmin {
  items: ProductoAdminItem[];
  total: number;
}

export interface GuardarCategoriaDTO {
  nombre: string;
  orden: number;
  activa: boolean;
}

export interface GuardarProductoDTO {
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
}

export interface GuardarComboItemDTO {
  producto_id: string;
  cantidad: number;
}

export interface GuardarComboDTO {
  nombre: string;
  descripcion: string | null;
  precio: number;
  incluye_entradas: number;
  destacado: boolean;
  activo: boolean;
  items: GuardarComboItemDTO[];
}

@Injectable({
  providedIn: 'root',
})
export class AdminCandyService {
  private readonly supabase = inject(SupabaseService);
  private readonly audit = inject(AuditService);
  private readonly bucket = 'posters';

  private readonly extensionesPermitidas: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  private readonly maxBytesImagen = 5 * 1024 * 1024; // 5 MB

  // =========================================================================
  // STORAGE (reutiliza bucket 'posters' bajo prefijo 'candy/')
  // =========================================================================

  private validarImagen(archivo: File): { ok: true; extension: string } | { ok: false; error: string } {
    const extension = this.extensionesPermitidas[archivo.type];
    if (!extension) {
      return { ok: false, error: 'Formato de imagen no válido. Usá JPG, PNG o WebP.' };
    }
    if (archivo.size > this.maxBytesImagen) {
      return { ok: false, error: 'La imagen no puede superar los 5 MB.' };
    }
    return { ok: true, extension };
  }

  private async subirImagenStorage(
    archivo: File
  ): Promise<Result<{ ruta: string; publicUrl: string }>> {
    const validacion = this.validarImagen(archivo);
    if (!validacion.ok) {
      return fail(validacion.error);
    }

    const ruta = `candy/${crypto.randomUUID()}.${validacion.extension}`;
    const { error } = await this.supabase.client.storage
      .from(this.bucket)
      .upload(ruta, archivo, {
        contentType: archivo.type,
        upsert: false,
      });

    if (error) {
      return fail(traducirError(error));
    }

    const { data } = this.supabase.client.storage.from(this.bucket).getPublicUrl(ruta);
    return ok({ ruta, publicUrl: data.publicUrl });
  }

  private async eliminarImagenStorageSilencioso(ruta: string): Promise<void> {
    const { error } = await this.supabase.client.storage.from(this.bucket).remove([ruta]);
    if (error) {
      console.error('No se pudo eliminar imagen temporal en Storage:', error);
    }
  }

  // =========================================================================
  // CATEGORÍAS DE PRODUCTO
  // =========================================================================

  async listarCategorias(): Promise<Result<CategoriaProducto[]>> {
    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .select('*')
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }
    return ok((data ?? []) as CategoriaProducto[]);
  }

  async crearCategoria(dto: GuardarCategoriaDTO): Promise<Result<CategoriaProducto>> {
    const payload = {
      nombre: dto.nombre.trim(),
      orden: Number(dto.orden) || 0,
      activa: dto.activa,
    };

    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const creada = data as CategoriaProducto;
    await this.audit.registrar({
      accion: 'crear_categoria_producto',
      entidad: 'categorias_producto',
      entidad_id: creada.id,
      datos_despues: { nombre: creada.nombre, orden: creada.orden, activa: creada.activa },
    });

    return ok(creada);
  }

  async editarCategoria(
    categoriaId: string,
    dto: GuardarCategoriaDTO
  ): Promise<Result<CategoriaProducto>> {
    const { data: anterior, error: errPrev } = await this.supabase.client
      .from('categorias_producto')
      .select('*')
      .eq('id', categoriaId)
      .single();

    if (errPrev || !anterior) {
      return fail(traducirError(errPrev ?? 'Categoría no encontrada.'));
    }

    const payload = {
      nombre: dto.nombre.trim(),
      orden: Number(dto.orden) || 0,
      activa: dto.activa,
    };

    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .update(payload)
      .eq('id', categoriaId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const actualizada = data as CategoriaProducto;
    await this.audit.registrar({
      accion: 'editar_categoria_producto',
      entidad: 'categorias_producto',
      entidad_id: actualizada.id,
      datos_antes: { nombre: anterior.nombre, orden: anterior.orden, activa: anterior.activa },
      datos_despues: {
        nombre: actualizada.nombre,
        orden: actualizada.orden,
        activa: actualizada.activa,
      },
    });

    return ok(actualizada);
  }

  async cambiarEstadoCategoria(
    categoriaId: string,
    activa: boolean
  ): Promise<Result<CategoriaProducto>> {
    const { data, error } = await this.supabase.client
      .from('categorias_producto')
      .update({ activa })
      .eq('id', categoriaId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const cat = data as CategoriaProducto;
    await this.audit.registrar({
      accion: activa ? 'activar_categoria_producto' : 'desactivar_categoria_producto',
      entidad: 'categorias_producto',
      entidad_id: cat.id,
      datos_antes: { activa: !activa },
      datos_despues: { activa, nombre: cat.nombre },
    });

    return ok(cat);
  }

  /**
   * Regla 4A.1: No se puede eliminar una categoría con productos; solo desactivar (baja lógica).
   */
  async eliminarCategoria(categoriaId: string): Promise<Result<void>> {
    const { count, error: errCount } = await this.supabase.client
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', categoriaId);

    if (errCount) {
      return fail(traducirError(errCount));
    }

    if ((count ?? 0) > 0) {
      return fail(
        `No se puede eliminar la categoría porque tiene ${count} producto(s) asociado(s). Usá "Desactivar" en su lugar.`
      );
    }

    const { data: anterior } = await this.supabase.client
      .from('categorias_producto')
      .select('nombre')
      .eq('id', categoriaId)
      .single();

    const { error } = await this.supabase.client
      .from('categorias_producto')
      .delete()
      .eq('id', categoriaId);

    if (error) {
      return fail(traducirError(error));
    }

    await this.audit.registrar({
      accion: 'eliminar_categoria_producto',
      entidad: 'categorias_producto',
      entidad_id: categoriaId,
      datos_antes: anterior ? { nombre: anterior.nombre } : null,
    });

    return ok(undefined);
  }

  // =========================================================================
  // PRODUCTOS
  // =========================================================================

  async listarProductosAdmin(filtro: FiltroProductosAdmin): Promise<Result<PaginaProductosAdmin>> {
    const desde = (filtro.pagina - 1) * filtro.tamanioPagina;
    const hasta = desde + filtro.tamanioPagina - 1;

    let query = this.supabase.client
      .from('productos')
      .select('*, categorias_producto(nombre)', { count: 'exact' })
      .order('nombre', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, hasta);

    if (filtro.categoriaId && filtro.categoriaId !== 'todas') {
      query = query.eq('categoria_id', filtro.categoriaId);
    }

    const termino = filtro.busqueda?.trim();
    if (termino) {
      query = query.ilike('nombre', `%${termino}%`);
    }

    const [resProd, resComboItems, resRecompensas] = await Promise.all([
      query,
      this.supabase.client.from('combo_items').select('producto_id'),
      this.supabase.client.from('recompensas').select('producto_id').not('producto_id', 'is', null),
    ]);

    if (resProd.error) {
      return fail(traducirError(resProd.error));
    }

    const idsEnUso = new Set<string>();
    for (const ci of resComboItems.data ?? []) {
      if (ci.producto_id) idsEnUso.add(String(ci.producto_id));
    }
    for (const rec of resRecompensas.data ?? []) {
      if (rec.producto_id) idsEnUso.add(String(rec.producto_id));
    }

    const items: ProductoAdminItem[] = (resProd.data ?? []).map((row: Record<string, unknown>) => {
      const cat = row['categorias_producto'] as { nombre?: string } | null;
      const { categorias_producto: _omit, ...prod } = row;
      const base = prod as unknown as Producto;
      return {
        ...base,
        categoria_nombre: cat?.nombre ?? 'Sin categoría',
        en_uso_combo_o_recompensa: idsEnUso.has(base.id),
      };
    });

    return ok({
      items,
      total: resProd.count ?? 0,
    });
  }

  async listarProductosActivosParaCombo(): Promise<Result<Producto[]>> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }
    return ok((data ?? []) as Producto[]);
  }

  async crearProducto(
    dto: GuardarProductoDTO,
    imagen?: File | null
  ): Promise<Result<Producto>> {
    let imagenUrl: string | null = null;
    let rutaSubida: string | null = null;

    if (imagen) {
      const subida = await this.subirImagenStorage(imagen);
      if (!subida.ok) {
        return fail(subida.error);
      }
      imagenUrl = subida.data.publicUrl;
      rutaSubida = subida.data.ruta;
    }

    const payload = {
      categoria_id: dto.categoria_id,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      imagen_url: imagenUrl,
      precio: Number(dto.precio),
      activo: dto.activo,
    };

    const { data, error } = await this.supabase.client
      .from('productos')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      if (rutaSubida) {
        await this.eliminarImagenStorageSilencioso(rutaSubida);
      }
      return fail(traducirError(error));
    }

    const creado = data as Producto;
    await this.audit.registrar({
      accion: 'crear_producto',
      entidad: 'productos',
      entidad_id: creado.id,
      datos_despues: {
        nombre: creado.nombre,
        categoria_id: creado.categoria_id,
        precio: creado.precio,
        activo: creado.activo,
      },
    });

    return ok(creado);
  }

  async editarProducto(
    productoId: string,
    dto: GuardarProductoDTO,
    imagenNueva?: File | null
  ): Promise<Result<Producto>> {
    const { data: anterior, error: errPrev } = await this.supabase.client
      .from('productos')
      .select('*')
      .eq('id', productoId)
      .single();

    if (errPrev || !anterior) {
      return fail(traducirError(errPrev ?? 'Producto no encontrado.'));
    }

    let imagenUrl = (anterior as Producto).imagen_url;
    let rutaSubida: string | null = null;

    if (imagenNueva) {
      const subida = await this.subirImagenStorage(imagenNueva);
      if (!subida.ok) {
        return fail(subida.error);
      }
      imagenUrl = subida.data.publicUrl;
      rutaSubida = subida.data.ruta;
    }

    const precioNuevo = Number(dto.precio);
    const precioAnterior = Number(anterior.precio);

    const payload = {
      categoria_id: dto.categoria_id,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      imagen_url: imagenUrl,
      precio: precioNuevo,
      activo: dto.activo,
    };

    const { data, error } = await this.supabase.client
      .from('productos')
      .update(payload)
      .eq('id', productoId)
      .select('*')
      .single();

    if (error || !data) {
      if (rutaSubida) {
        await this.eliminarImagenStorageSilencioso(rutaSubida);
      }
      return fail(traducirError(error));
    }

    const actualizado = data as Producto;

    await this.audit.registrar({
      accion: 'editar_producto',
      entidad: 'productos',
      entidad_id: actualizado.id,
      datos_antes: {
        nombre: anterior.nombre,
        categoria_id: anterior.categoria_id,
        precio: precioAnterior,
        activo: anterior.activo,
      },
      datos_despues: {
        nombre: actualizado.nombre,
        categoria_id: actualizado.categoria_id,
        precio: actualizado.precio,
        activo: actualizado.activo,
      },
    });

    // Regla 4A.4: Registro explícito de cambio de precio
    if (precioAnterior !== precioNuevo) {
      await this.audit.registrar({
        accion: 'cambiar_precio_producto',
        entidad: 'productos',
        entidad_id: actualizado.id,
        datos_antes: { precio_anterior: precioAnterior, nombre: actualizado.nombre },
        datos_despues: { precio_nuevo: precioNuevo, nombre: actualizado.nombre },
      });
    }

    return ok(actualizado);
  }

  async cambiarEstadoProducto(productoId: string, activo: boolean): Promise<Result<Producto>> {
    const { data, error } = await this.supabase.client
      .from('productos')
      .update({ activo })
      .eq('id', productoId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const prod = data as Producto;
    await this.audit.registrar({
      accion: activo ? 'activar_producto' : 'desactivar_producto',
      entidad: 'productos',
      entidad_id: prod.id,
      datos_antes: { activo: !activo },
      datos_despues: { activo, nombre: prod.nombre },
    });

    return ok(prod);
  }

  // =========================================================================
  // COMBOS Y COMBO_ITEMS
  // =========================================================================

  /** Obtiene precio base típico de entrada (última función programada) para calcular "valor sin combo". */
  async obtenerPrecioBaseTipicoEntrada(): Promise<number> {
    const { data } = await this.supabase.client
      .from('funciones')
      .select('precio_base')
      .eq('estado', ESTADOS_FUNCION.PROGRAMADA)
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    const precio = Number(data?.precio_base);
    return Number.isFinite(precio) && precio > 0 ? precio : 8000;
  }

  async listarCombosAdmin(): Promise<Result<ComboAdminItem[]>> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .select('*, combo_items(combo_id, producto_id, cantidad, productos(nombre, precio, activo))')
      .order('destacado', { ascending: false })
      .order('nombre', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      return fail(traducirError(error));
    }

    const combos: ComboAdminItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const rawItems =
        (row['combo_items'] as Array<{
          combo_id: string;
          producto_id: string;
          cantidad: number;
          productos?: { nombre?: string; precio?: number; activo?: boolean } | null;
        }> | null) ?? [];

      const items: ComboItemDetalle[] = rawItems.map((ci) => ({
        combo_id: ci.combo_id,
        producto_id: ci.producto_id,
        cantidad: Number(ci.cantidad),
        producto_nombre: ci.productos?.nombre ?? 'Producto',
        producto_precio: Number(ci.productos?.precio ?? 0),
        producto_activo: Boolean(ci.productos?.activo ?? true),
      }));

      const { combo_items: _omit, ...resto } = row;
      return {
        ...(resto as unknown as Combo),
        items,
      };
    });

    return ok(combos);
  }

  async crearCombo(dto: GuardarComboDTO, imagen?: File | null): Promise<Result<Combo>> {
    if (!dto.items || dto.items.length === 0) {
      return fail('El combo debe incluir al menos un producto.');
    }

    let imagenUrl: string | null = null;
    let rutaSubida: string | null = null;

    if (imagen) {
      const subida = await this.subirImagenStorage(imagen);
      if (!subida.ok) {
        return fail(subida.error);
      }
      imagenUrl = subida.data.publicUrl;
      rutaSubida = subida.data.ruta;
    }

    const payload = {
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      imagen_url: imagenUrl,
      precio: Number(dto.precio),
      incluye_entradas: Math.max(0, Math.floor(Number(dto.incluye_entradas) || 0)),
      destacado: dto.destacado,
      activo: dto.activo,
    };

    const { data, error } = await this.supabase.client
      .from('combos')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      if (rutaSubida) {
        await this.eliminarImagenStorageSilencioso(rutaSubida);
      }
      return fail(traducirError(error));
    }

    const combo = data as Combo;

    const filasItems = dto.items.map((item) => ({
      combo_id: combo.id,
      producto_id: item.producto_id,
      cantidad: Math.max(1, Math.floor(Number(item.cantidad) || 1)),
    }));

    const { error: errItems } = await this.supabase.client.from('combo_items').insert(filasItems);
    if (errItems) {
      return fail(traducirError(errItems));
    }

    await this.audit.registrar({
      accion: 'crear_combo',
      entidad: 'combos',
      entidad_id: combo.id,
      datos_despues: {
        nombre: combo.nombre,
        precio: combo.precio,
        incluye_entradas: combo.incluye_entradas,
        destacado: combo.destacado,
        items: filasItems,
      },
    });

    return ok(combo);
  }

  async editarCombo(
    comboId: string,
    dto: GuardarComboDTO,
    imagenNueva?: File | null
  ): Promise<Result<Combo>> {
    if (!dto.items || dto.items.length === 0) {
      return fail('El combo debe incluir al menos un producto.');
    }

    const { data: anterior, error: errPrev } = await this.supabase.client
      .from('combos')
      .select('*')
      .eq('id', comboId)
      .single();

    if (errPrev || !anterior) {
      return fail(traducirError(errPrev ?? 'Combo no encontrado.'));
    }

    let imagenUrl = (anterior as Combo).imagen_url;
    let rutaSubida: string | null = null;

    if (imagenNueva) {
      const subida = await this.subirImagenStorage(imagenNueva);
      if (!subida.ok) {
        return fail(subida.error);
      }
      imagenUrl = subida.data.publicUrl;
      rutaSubida = subida.data.ruta;
    }

    const precioAnterior = Number(anterior.precio);
    const precioNuevo = Number(dto.precio);

    const payload = {
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      imagen_url: imagenUrl,
      precio: precioNuevo,
      incluye_entradas: Math.max(0, Math.floor(Number(dto.incluye_entradas) || 0)),
      destacado: dto.destacado,
      activo: dto.activo,
    };

    const { data, error } = await this.supabase.client
      .from('combos')
      .update(payload)
      .eq('id', comboId)
      .select('*')
      .single();

    if (error || !data) {
      if (rutaSubida) {
        await this.eliminarImagenStorageSilencioso(rutaSubida);
      }
      return fail(traducirError(error));
    }

    // Reemplazar combo_items en secuencia
    const { error: errDel } = await this.supabase.client
      .from('combo_items')
      .delete()
      .eq('combo_id', comboId);

    if (errDel) {
      return fail(traducirError(errDel));
    }

    const filasItems = dto.items.map((item) => ({
      combo_id: comboId,
      producto_id: item.producto_id,
      cantidad: Math.max(1, Math.floor(Number(item.cantidad) || 1)),
    }));

    const { error: errIns } = await this.supabase.client.from('combo_items').insert(filasItems);
    if (errIns) {
      return fail(traducirError(errIns));
    }

    const actualizado = data as Combo;

    await this.audit.registrar({
      accion: 'editar_combo',
      entidad: 'combos',
      entidad_id: actualizado.id,
      datos_antes: {
        nombre: anterior.nombre,
        precio: precioAnterior,
        incluye_entradas: anterior.incluye_entradas,
        destacado: anterior.destacado,
        activo: anterior.activo,
      },
      datos_despues: {
        nombre: actualizado.nombre,
        precio: actualizado.precio,
        incluye_entradas: actualizado.incluye_entradas,
        destacado: actualizado.destacado,
        activo: actualizado.activo,
        items: filasItems,
      },
    });

    if (precioAnterior !== precioNuevo) {
      await this.audit.registrar({
        accion: 'cambiar_precio_combo',
        entidad: 'combos',
        entidad_id: actualizado.id,
        datos_antes: { precio_anterior: precioAnterior, nombre: actualizado.nombre },
        datos_despues: { precio_nuevo: precioNuevo, nombre: actualizado.nombre },
      });
    }

    return ok(actualizado);
  }

  async cambiarEstadoCombo(comboId: string, activo: boolean): Promise<Result<Combo>> {
    const { data, error } = await this.supabase.client
      .from('combos')
      .update({ activo })
      .eq('id', comboId)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const combo = data as Combo;
    await this.audit.registrar({
      accion: activo ? 'activar_combo' : 'desactivar_combo',
      entidad: 'combos',
      entidad_id: combo.id,
      datos_antes: { activo: !activo },
      datos_despues: { activo, nombre: combo.nombre },
    });

    return ok(combo);
  } 
}