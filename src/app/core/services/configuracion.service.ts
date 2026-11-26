import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from './audit.service';
import { Configuracion, Json } from '../models/database.types';
import { Result, fail, ok } from '../utils/result';
import { traducirError } from '../utils/errores';

// Nota: descuento_primera_compra_pct NO se usa aquí; el porcentaje vive en la tabla cupones.
export type ClaveConfiguracion =
  | 'recargo_vip_pct'
  | 'margen_funciones_min'
  | 'minutos_hold_butaca'
  | 'horas_limite_cancelacion'
  | 'puntos_por_peso'
  | 'minutos_espera_lista'
  | 'dias_preventa_default';

@Injectable({
  providedIn: 'root',
})
export class ConfiguracionService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly audit = inject(AuditService);

  private readonly mapaSignal = signal<Record<string, Configuracion>>({});
  private readonly cargandoSignal = signal<boolean>(false);
  private cargado = false;

  readonly configuraciones = computed(() => Object.values(this.mapaSignal()));
  readonly cargando = computed(() => this.cargandoSignal());

  constructor() {
    void this.cargar();
  }

  async cargar(forzar = false): Promise<Result<Record<string, Configuracion>>> {
    if (this.cargado && !forzar) {
      return ok(this.mapaSignal());
    }

    this.cargandoSignal.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('configuracion')
        .select('*')
        .order('clave', { ascending: true });

      if (error) {
        return fail(traducirError(error));
      }

      const nuevoMapa: Record<string, Configuracion> = {};
      for (const row of (data ?? []) as Configuracion[]) {
        nuevoMapa[row.clave] = row;
      }

      this.mapaSignal.set(nuevoMapa);
      this.cargado = true;
      return ok(nuevoMapa);
    } catch (err) {
      return fail(traducirError(err));
    } finally {
      this.cargandoSignal.set(false);
    }
  }

  get<T extends Json>(clave: ClaveConfiguracion, valorPorDefecto: T): T {
    const registro = this.mapaSignal()[clave];
    if (!registro || registro.valor === undefined || registro.valor === null) {
      return valorPorDefecto;
    }
    return registro.valor as T;
  }

  async actualizar(clave: ClaveConfiguracion, nuevoValor: Json): Promise<Result<Configuracion>> {
    const anterior = this.mapaSignal()[clave] ?? null;
    const uid = this.auth.perfil()?.id ?? null;

    const { data, error } = await this.supabase.client
      .from('configuracion')
      .update({
        valor: nuevoValor,
        updated_at: new Date().toISOString(),
        updated_by: uid,
      })
      .eq('clave', clave)
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    const actualizada = data as Configuracion;

    this.mapaSignal.update((mapa) => ({
      ...mapa,
      [clave]: actualizada,
    }));


    await this.audit.registrar({
      accion: 'actualizar_configuracion',
      entidad: 'configuracion',
      entidad_id: clave,
      datos_antes: anterior ? { valor: anterior.valor } : null,
      datos_despues: { valor: actualizada.valor },
    });

    return ok(actualizada);
  }
}