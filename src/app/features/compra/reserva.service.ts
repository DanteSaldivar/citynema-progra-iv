import { computed, inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { AuthService } from '../../core/auth/auth.service';
import { ConfiguracionService } from '../../core/services/configuracion.service';
import { SupabaseService } from '../../core/supabase.service';
import { ESTADOS_ENTRADA } from '../../core/models/constantes';
import { Result, fail, ok } from '../../core/utils/result';
import { traducirError } from '../../core/utils/errores';

export interface ButacaOcupada {
  id: string;
  estado: 'ocupada' | 'reservada'; // ocupada = entrada vendida, reservada = retenida por otro
}

export interface MiReservaActiva {
  butacaId: string;
  expiraAt: string; // ISO timestamptz
}

export type ResultadoReserva =
  | { estado: 'ok'; expiraAt: string }
  | { estado: 'conflicto' }
  | { estado: 'error'; mensaje: string };

@Injectable({
  providedIn: 'root',
})
export class ReservasService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly configService = inject(ConfiguracionService);

  private readonly MINUTOS_HOLD_DEFAULT = 10;
  private readonly MAX_EXTENSIONES_HOLD = 1;
  readonly extensionesUsadas = signal<number>(0);

  readonly puedeExtenderHold = computed(
    () =>
      this.misReservasActivas().length > 0 &&
      this.extensionesUsadas() < this.MAX_EXTENSIONES_HOLD
  );

  private channel: RealtimeChannel | null = null;
  private funcionSuscritaId: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private expiracionTimer: ReturnType<typeof setInterval> | null = null;

  // Estado reactivo del mapa actual
  readonly butacasBloqueadas = signal<ButacaOcupada[]>([]);
  readonly misReservasDetalle = signal<MiReservaActiva[]>([]);
  readonly misReservasActivas = computed(() =>
    this.misReservasDetalle().map((r) => r.butacaId)
  );
  readonly vencimientoProximo = signal<string | null>(null);

  private readonly sessionId = this.obtenerSessionId();

  private obtenerSessionId(): string {
    let sid = sessionStorage.getItem('cine_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('cine_session_id', sid);
    }
    return sid;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Extiende el expira_at de todas las butacas vigentes de esta sesión
   * para la función indicada.
   */
  async extenderHold(funcionId: string): Promise<Result<string>> {
    if (this.extensionesUsadas() >= this.MAX_EXTENSIONES_HOLD) {
      return fail('Ya utilizaste la extensión máxima de tiempo para esta reserva.');
    }

    await this.configService.cargar();
    const minutosHold = Math.max(
      1,
      Number(this.configService.get<number>('minutos_hold_butaca', this.MINUTOS_HOLD_DEFAULT)) ||
        this.MINUTOS_HOLD_DEFAULT
    );

    const ahoraIso = new Date().toISOString();
    const nuevoExpiraAt = new Date(Date.now() + minutosHold * 60 * 1000).toISOString();

    // Solo actualiza las reservas de esta sesión que SIGUEN vigentes (expira_at > ahora)
    const { data, error } = await this.supabase.client
      .from('reservas_butaca')
      .update({ expira_at: nuevoExpiraAt })
      .eq('funcion_id', funcionId)
      .eq('session_id', this.sessionId)
      .gt('expira_at', ahoraIso)
      .select('butaca_id');

    if (error) {
      return fail(traducirError(error));
    }

    if (!data || data.length === 0) {
      return fail('Tu reserva ya venció. Volvé a seleccionar tus butacas.');
    }

    this.extensionesUsadas.update((n) => n + 1);

    if (this.funcionSuscritaId === funcionId) {
      await this.cargarOcupacionInicial(funcionId);
    }

    return ok(nuevoExpiraAt);
  }

 
  async inicializarTiempoReal(funcionId: string): Promise<Result<void>> {
    this.limpiarSuscripcion();
    this.funcionSuscritaId = funcionId;

    await this.configService.cargar();
    await this.limpiarReservasVencidasDeFuncion(funcionId);

    const resInicial = await this.cargarOcupacionInicial(funcionId);
    if (!resInicial.ok) {
      return resInicial;
    }

    this.channel = this.supabase.client
      .channel(`sala_realtime_${funcionId}_${crypto.randomUUID().slice(0, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas_butaca' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const fnId =
            (payload.new as Record<string, unknown> | null)?.['funcion_id'] ??
            (payload.old as Record<string, unknown> | null)?.['funcion_id'];
          if (fnId === funcionId) {
            this.programarRefresco(funcionId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'entradas' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const fnId = (payload.new as Record<string, unknown> | null)?.['funcion_id'];
          if (fnId === funcionId) {
            this.programarRefresco(funcionId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entradas' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const fnId =
            (payload.new as Record<string, unknown> | null)?.['funcion_id'] ??
            (payload.old as Record<string, unknown> | null)?.['funcion_id'];
          if (fnId === funcionId) {
            this.programarRefresco(funcionId);
          }
        }
      )
      .subscribe();

    // Timer cada 30s para descartar localmente reservas cuyo expira_at ya venció
    this.expiracionTimer = setInterval(() => {
      this.descartarVencidasLocalmente();
    }, 30_000);

    return ok(undefined);
  }

  private programarRefresco(funcionId: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      if (this.funcionSuscritaId === funcionId) {
        void this.cargarOcupacionInicial(funcionId);
      }
    }, 150);
  }

  private descartarVencidasLocalmente(): void {
    const ahoraMs = Date.now();
    const vigentes = this.misReservasDetalle().filter(
      (r) => new Date(r.expiraAt).getTime() > ahoraMs
    );
    if (vigentes.length !== this.misReservasDetalle().length) {
      this.misReservasDetalle.set(vigentes);
      this.actualizarVencimientoProximo(vigentes);
    }
    if (this.funcionSuscritaId) {
      void this.cargarOcupacionInicial(this.funcionSuscritaId);
    }
  }

  async cargarOcupacionInicial(funcionId: string): Promise<Result<void>> {
    const ahoraIso = new Date().toISOString();

    const [resVendidas, resReservadas] = await Promise.all([
      this.supabase.client
        .from('entradas')
        .select('butaca_id')
        .eq('funcion_id', funcionId)
        .in('estado', [ESTADOS_ENTRADA.VALIDA, ESTADOS_ENTRADA.USADA]),
      this.supabase.client
        .from('reservas_butaca')
        .select('butaca_id, session_id, expira_at')
        .eq('funcion_id', funcionId)
        .gt('expira_at', ahoraIso),
    ]);

    if (resVendidas.error) {
      return fail(traducirError(resVendidas.error));
    }
    if (resReservadas.error) {
      return fail(traducirError(resReservadas.error));
    }

    const bloqueadas: ButacaOcupada[] = [];
    const misDetalle: MiReservaActiva[] = [];
    const idsVendidas = new Set<string>();

    for (const v of resVendidas.data ?? []) {
      idsVendidas.add(v.butaca_id);
      bloqueadas.push({ id: v.butaca_id, estado: 'ocupada' });
    }

    for (const r of resReservadas.data ?? []) {
      if (idsVendidas.has(r.butaca_id)) continue;

      if (r.session_id === this.sessionId) {
        misDetalle.push({ butacaId: r.butaca_id, expiraAt: r.expira_at });
      } else {
        bloqueadas.push({ id: r.butaca_id, estado: 'reservada' });
      }
    }

    this.butacasBloqueadas.set(bloqueadas);
    this.misReservasDetalle.set(misDetalle);
    this.actualizarVencimientoProximo(misDetalle);
    return ok(undefined);
  }

  private actualizarVencimientoProximo(reservas: MiReservaActiva[]): void {
    if (reservas.length === 0) {
      this.vencimientoProximo.set(null);
      return;
    }
    const masProxima = reservas.reduce((min, curr) =>
      new Date(curr.expiraAt).getTime() < new Date(min.expiraAt).getTime() ? curr : min
    );
    this.vencimientoProximo.set(masProxima.expiraAt);
  }


  async reservarButaca(funcionId: string, butacaId: string): Promise<ResultadoReserva> {
    await this.configService.cargar();
    const minutosHold = Math.max(
      1,
      Number(this.configService.get<number>('minutos_hold_butaca', this.MINUTOS_HOLD_DEFAULT)) ||
        this.MINUTOS_HOLD_DEFAULT
    );
    const expiraAt = new Date(Date.now() + minutosHold * 60 * 1000).toISOString();
    const userId = this.auth.perfil()?.id ?? null;

    // Limpiar si hubiera una reserva vencida puntual de esa butaca antes de insertar
    await this.supabase.client
      .from('reservas_butaca')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('butaca_id', butacaId)
      .lt('expira_at', new Date().toISOString());

    const { error } = await this.supabase.client.from('reservas_butaca').insert({
      funcion_id: funcionId,
      butaca_id: butacaId,
      user_id: userId,
      session_id: this.sessionId,
      expira_at: expiraAt,
    });

    if (error) {
      if (error.code === '23505') {
        await this.cargarOcupacionInicial(funcionId);
        return { estado: 'conflicto' };
      }
      return { estado: 'error', mensaje: traducirError(error) };
    }

    await this.cargarOcupacionInicial(funcionId);
    return { estado: 'ok', expiraAt };
  }

  async liberarButaca(funcionId: string, butacaId: string): Promise<Result<void>> {
    const { error } = await this.supabase.client
      .from('reservas_butaca')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('butaca_id', butacaId)
      .eq('session_id', this.sessionId);

    if (error) {
      return fail(traducirError(error));
    }

    await this.cargarOcupacionInicial(funcionId);
    return ok(undefined);
  }

  /** Limpia reservas vencidas de una función al abrir el mapa. */
  async limpiarReservasVencidasDeFuncion(funcionId: string): Promise<void> {
    await this.supabase.client
      .from('reservas_butaca')
      .delete()
      .eq('funcion_id', funcionId)
      .lt('expira_at', new Date().toISOString());
  }

  /** Libera todas las reservas propias de esta sesión (al salir del mapa sin ir al checkout). */
  async liberarPropiasDeFuncion(funcionId: string): Promise<void> {
    await this.supabase.client
      .from('reservas_butaca')
      .delete()
      .eq('funcion_id', funcionId)
      .eq('session_id', this.sessionId);

    if (this.funcionSuscritaId === funcionId) {
      this.misReservasDetalle.set([]);
      this.vencimientoProximo.set(null);
    }
  }

  limpiarSuscripcion(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.expiracionTimer) {
      clearInterval(this.expiracionTimer);
      this.expiracionTimer = null;
    }
    if (this.channel) {
      void this.supabase.client.removeChannel(this.channel);
      this.channel = null;
    }
    this.funcionSuscritaId = null;
  }
}