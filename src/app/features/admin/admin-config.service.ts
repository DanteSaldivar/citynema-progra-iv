import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

export interface Cupon {
  id?: string;
  codigo: string;
  descripcion?: string | null;
  tipo: 'primera_compra' | 'edad_minima' | 'general';
  porcentaje: number;
  edad_minima: number | null;
  activo: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AdminConfigService {
  private readonly supabase = inject(SupabaseService);

  async getCupones(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.client
      .from('cupones')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Error al cargar los cupones');
    return data as Cupon[];
  }

  async guardarCupon(cupon: Cupon) {
    const { error } = await this.supabase.client.from('cupones').upsert({
      id: cupon.id,
      codigo: cupon.codigo.toUpperCase(),
      descripcion: cupon.descripcion ?? null,
      tipo: cupon.tipo,
      porcentaje: cupon.porcentaje,
      edad_minima: cupon.edad_minima,
      activo: cupon.activo,
    });

    if (error) throw new Error(`Error guardando el cupón: ${error.message}`);
  }

  async toggleEstadoCupon(id: string, estadoActual: boolean) {
    const { error } = await this.supabase.client
      .from('cupones')
      .update({ activo: !estadoActual })
      .eq('id', id);
    if (error) throw new Error('Error al cambiar el estado del cupón');
  }
}