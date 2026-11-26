import { inject, Injectable } from '@angular/core';
import { CategoriaProducto, Combo, Producto, } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase.service';
import { traducirError } from '../../core/utils/errores';
import { Result, fail, ok } from '../../core/utils/result';

export interface ComboItemPublico {
  producto_id: string;
  cantidad: number;
  producto_nombre: string;
}

export interface ComboPublico extends Combo {
  items: ComboItemPublico[];
}

export interface CatalogoCandyActivo {
  categorias: CategoriaProducto[];
  productos: Producto[];
  combos: ComboPublico[];
}

@Injectable({
  providedIn: 'root',
})
export class CandyCatalogoService {
  private readonly supabase = inject(SupabaseService);

  async obtenerCatalogoActivo(): Promise<Result<CatalogoCandyActivo>> {
    const [resCats, resProds, resCombos] = await Promise.all([
      this.supabase.client
        .from('categorias_producto')
        .select('*')
        .eq('activa', true)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true })
        .order('id', { ascending: true }),
      this.supabase.client
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true })
        .order('id', { ascending: true }),
      this.supabase.client
        .from('combos')
        .select('*, combo_items(producto_id, cantidad, productos(nombre))')
        .eq('activo', true)
        .order('destacado', { ascending: false })
        .order('nombre', { ascending: true })
        .order('id', { ascending: true }),
    ]);

    if (resCats.error) return fail(traducirError(resCats.error));
    if (resProds.error) return fail(traducirError(resProds.error));
    if (resCombos.error) return fail(traducirError(resCombos.error));

    const categorias = (resCats.data ?? []) as CategoriaProducto[];
    const categoriasActivasIds = new Set(categorias.map((c) => c.id));

    // Filtrar productos cuya categoría también esté activa
    const productos = ((resProds.data ?? []) as Producto[]).filter((p) =>
      categoriasActivasIds.has(p.categoria_id)
    );

    const combos: ComboPublico[] = (resCombos.data ?? []).map((row: Record<string, unknown>) => {
      const rawItems =
        (row['combo_items'] as Array<{
          producto_id: string;
          cantidad: number;
          productos?: { nombre?: string } | null;
        }> | null) ?? [];

      const items: ComboItemPublico[] = rawItems.map((ci) => ({
        producto_id: ci.producto_id,
        cantidad: Number(ci.cantidad),
        producto_nombre: ci.productos?.nombre ?? 'Producto',
      }));

      const { combo_items: _omit, ...base } = row;
      return {
        ...(base as unknown as Combo),
        items,
      };
    });

    return ok({ categorias, productos, combos });
  }
}