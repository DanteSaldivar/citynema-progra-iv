import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';
import { AuthService } from '../auth/auth.service';
import { Json, Notificacion, TipoNotificacion } from '../models/database.types';
import { Result, fail, ok } from '../utils/result';
import { traducirError } from '../utils/errores';

@Injectable({
  providedIn: 'root',
})
export class NotificacionesService implements OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private readonly listaSignal = signal<Notificacion[]>([]);
  private readonly cargandoSignal = signal<boolean>(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly lista = computed(() => this.listaSignal());
  readonly cargando = computed(() => this.cargandoSignal());
  readonly error = computed(() => this.errorSignal());
  readonly noLeidas = computed(() => this.listaSignal().filter((n) => !n.leida).length);

  private canal: RealtimeChannel | null = null;
  private usuarioSuscriptoId: string | null = null;

  constructor() {
    // Se suscribe automáticamente al iniciar sesión y limpia al cerrarla
    effect(() => {
      const perfil = this.auth.perfil();

      if (perfil?.id) {
        if (this.usuarioSuscriptoId !== perfil.id) {
          this.usuarioSuscriptoId = perfil.id;
          void this.cargarInicial(perfil.id);
          this.suscribirTiempoReal(perfil.id);
        }
      } else {
        this.usuarioSuscriptoId = null;
        this.limpiarCanal();
        this.listaSignal.set([]);
        this.errorSignal.set(null);
      }
    });
  }

  async cargarInicial(userId?: string): Promise<Result<Notificacion[]>> {
    const uid = userId ?? this.auth.perfil()?.id;
    if (!uid) {
      this.listaSignal.set([]);
      return ok([]);
    }

    this.cargandoSignal.set(true);
    this.errorSignal.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('notificaciones')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50);

      if (error) {
        const msg = traducirError(error);
        this.errorSignal.set(msg);
        return fail(msg);
      }

      const items = (data ?? []) as Notificacion[];
      this.listaSignal.set(items);
      return ok(items);
    } catch (err) {
      const msg = traducirError(err);
      this.errorSignal.set(msg);
      return fail(msg);
    } finally {
      this.cargandoSignal.set(false);
    }
  }

  private suscribirTiempoReal(userId: string): void {
    this.limpiarCanal();

    this.canal = this.supabase.client
      .channel(`notificaciones_usuario_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nueva = payload.new as Notificacion;
          this.listaSignal.update((actuales) => {
            if (actuales.some((n) => n.id === nueva.id)) return actuales;
            return [nueva, ...actuales];
          });
        }
      )
      .subscribe();
  }

  async marcarLeida(id: string): Promise<Result<void>> {
    const uid = this.auth.perfil()?.id;
    if (!uid) return fail('No hay sesión activa.');

    const { error } = await this.supabase.client
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      return fail(traducirError(error));
    }

    this.listaSignal.update((items) =>
      items.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
    return ok(undefined);
  }

  async marcarTodasLeidas(): Promise<Result<void>> {
    const uid = this.auth.perfil()?.id;
    if (!uid) return fail('No hay sesión activa.');

    const { error } = await this.supabase.client
      .from('notificaciones')
      .update({ leida: true })
      .eq('user_id', uid)
      .eq('leida', false);

    if (error) {
      return fail(traducirError(error));
    }

    this.listaSignal.update((items) => items.map((n) => ({ ...n, leida: true })));
    return ok(undefined);
  }

  /** Método auxiliar para pruebas / eventos del propio usuario */
  async crearNotificacionPropia(
    tipo: TipoNotificacion,
    mensaje: string,
    datos: Record<string, Json> = {}
  ): Promise<Result<Notificacion>> {
    const uid = this.auth.perfil()?.id;
    if (!uid) return fail('Iniciá sesión para probar notificaciones.');

    const { data, error } = await this.supabase.client
      .from('notificaciones')
      .insert({
        user_id: uid,
        tipo,
        mensaje,
        datos,
      })
      .select('*')
      .single();

    if (error || !data) {
      return fail(traducirError(error));
    }

    return ok(data as Notificacion);
  }


  async revisarAlertasEstreno(): Promise<void> {

  }

  private limpiarCanal(): void {
    if (this.canal) {
      void this.supabase.client.removeChannel(this.canal);
      this.canal = null;
    }
  }

  ngOnDestroy(): void {
    this.limpiarCanal();
  }
}