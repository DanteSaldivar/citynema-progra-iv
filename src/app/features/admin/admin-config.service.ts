import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

export interface Cupon {
  id?: string;
  codigo: string;
  descripcion?: string | null;
  tipo: 'primera_compra' | 'edad_minima' | 'general';
  porcentaje: number;
  edad_minima: number | null;   // sólo tiene sentido cuando tipo = 'edad_minima'
  activo: boolean;
}

export interface Combo {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  destacado?: boolean;          // RF-COM-10: debe poder destacarse en la compra
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminConfigService {

  // --- GESTIÓN DE CUPONES ---

  private supabase = inject(SupabaseService);
  
  async getCupones(): Promise<Cupon[]> {
    const { data, error } = await this.supabase.client.from('cupones').select('*').order('created_at', { ascending: false });
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
    const { error } = await this.supabase.client.from('cupones').update({ activo: !estadoActual }).eq('id', id);
    if (error) throw new Error('Error al cambiar el estado del cupón');
  }

  // --- GESTIÓN DE COMBOS ---

  async getCombos(): Promise<Combo[]> {
    const { data, error } = await this.supabase.client.from('combos').select('*').order('created_at', { ascending: false });
    if (error) throw new Error('Error al cargar los combos');
    return data as Combo[];
  }

  async guardarCombo(combo: Combo) {
    const { error } = await this.supabase.client.from('combos').upsert({
      id: combo.id,
      nombre: combo.nombre,
      descripcion: combo.descripcion ?? null,
      precio: combo.precio,
      destacado: combo.destacado ?? true,
      activo: combo.activo,
    });

    if (error) throw new Error(`Error guardando el combo: ${error.message}`);
  }

  async toggleEstadoCombo(id: string, estadoActual: boolean) {
    const { error } = await this.supabase.client.from('combos').update({ activo: !estadoActual }).eq('id', id);
    if (error) throw new Error('Error al cambiar el estado del combo');
  }
}