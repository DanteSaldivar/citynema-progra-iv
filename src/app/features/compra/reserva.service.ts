import { Injectable, signal, effect, OnDestroy, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase.service';

export interface ButacaOcupada {
    id: string; // ID de la butaca
    estado: 'ocupada' | 'reservada'; // ocupada = ya pagada, reservada = temporal
}

@Injectable({
    providedIn: 'root'
})
export class ReservasService implements OnDestroy {

    private auth = inject(AuthService);
    private supabase = inject(SupabaseService);

    private channel: RealtimeChannel | null = null;

    // Signal reactivo con las butacas no disponibles en este momento
    butacasBloqueadas = signal<ButacaOcupada[]>([]);
    misReservasActivas = signal<string[]>([]);

    private sessionId = this.obtenerSessionId();
    private obtenerSessionId(): string {
        let sid = sessionStorage.getItem('cine_session_id');
        if (!sid) {
            sid = crypto.randomUUID();
            sessionStorage.setItem('cine_session_id', sid);
        }
        return sid;
    }

    /**
     * RF-COM-02: Se suscribe a los cambios en tiempo real de la función actual.
     * Escucha tanto reservas temporales (reservas_butaca) como entradas definitivas (entradas).
     */
    async inicializarTiempoReal(funcionId: string) {
        this.limpiarSuscripcion();
        await this.limpiarReservasVencidas();
        await this.cargarOcupacionInicial(funcionId);

        // Canal de Supabase Realtime para esta función específica
        this.channel = this.supabase.client.channel(`ocupacion_funcion_${funcionId}`)
            // Escuchar nuevas reservas temporales
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'reservas_butaca',
                filter: `funcion_id=eq.${funcionId}`
            }, () => {
                this.cargarOcupacionInicial(funcionId);
            })
            // Escuchar compras definitivas
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'entradas',
                filter: `funcion_id=eq.${funcionId}`
            }, () => {
                this.cargarOcupacionInicial(funcionId);
            })
            .subscribe();
    }

    private async cargarOcupacionInicial(funcionId: string) {
        // 1. Cargar entradas ya vendidas
        const { data: vendidas } = await this.supabase.client
            .from('entradas')
            .select('butaca_id')
            .eq('funcion_id', funcionId)
            .in('estado', ['valida', 'usada']);

        // 2. Cargar reservas temporales vigentes
        const { data: reservadas } = await this.supabase.client
            .from('reservas_butaca')
            .select('butaca_id, session_id')
            .eq('funcion_id', funcionId)
            .gt('expira_at', new Date().toISOString()); // Solo las que no vencieron

        const bloqueadas: ButacaOcupada[] = [];
        const misReservas: string[] = [];

        vendidas?.forEach(v => bloqueadas.push({ id: v.butaca_id, estado: 'ocupada' }));

        reservadas?.forEach(r => {
            // Si la reserva es de ESTA sesión, no la marcamos como bloqueada para este usuario
            if (r.session_id !== this.sessionId) {
                bloqueadas.push({ id: r.butaca_id, estado: 'reservada' });
            } else {
                misReservas.push(r.butaca_id);
            }
        });

        this.butacasBloqueadas.set(bloqueadas);
        this.misReservasActivas.set(misReservas);
    }

    /**
     * Intenta reservar una butaca temporalmente (10 min).
     * RN-10: La tabla tiene un UNIQUE(funcion_id, butaca_id). Si choca, falla acá.
     */
    async reservarButaca(funcionId: string, butacaId: string): Promise<boolean> {
        const userId = this.auth.perfil()?.id || null;

        const { error } = await this.supabase.client
            .from('reservas_butaca')
            .insert({
                funcion_id: funcionId,
                butaca_id: butacaId,
                user_id: userId,
                session_id: this.sessionId
                // expira_at se calcula automáticamente en la BD por DEFAULT
            });

        if (error) {
            if (error.code === '23505') { // Violación de UNIQUE constraint (chocó con otro)
                console.warn('La butaca acaba de ser tomada por otra persona.');
                return false;
            }
            throw new Error(`Error reservando butaca: ${error.message}`);
        }

        // Si fue exitoso, forzamos la recarga para que el usuario la vea como suya
        await this.cargarOcupacionInicial(funcionId);
        return true;
    }

    async liberarButaca(funcionId: string, butacaId: string) {
        const { data, error } = await this.supabase.client
            .from('reservas_butaca')
            .delete()
            .match({
                funcion_id: funcionId,
                butaca_id: butacaId,
                session_id: this.sessionId
            })
            .select(); // <--- CLAVE: si esto devuelve array vacío, el match falló

        if (error) {
            console.error('Error liberando butaca:', error.message);
        } else if (!data || data.length === 0) {
            console.warn(`Supabase borró 0 filas. Revisa en tu base de datos si la butaca ${butacaId} realmente tiene el session_id: ${this.sessionId}`);
        }

        await this.cargarOcupacionInicial(funcionId);
    }

    /**
     * Limpia filas basura de reservas caducadas en lugar de usar un cron.
     */
    async limpiarReservasVencidas() {
        await this.supabase.client
            .from('reservas_butaca')
            .delete()
            .lt('expira_at', new Date().toISOString());
    }

    async limpiarMisReservas() {
        const { data, error } = await this.supabase.client
            .from('reservas_butaca')
            .delete()
            .eq('session_id', this.sessionId)
            .select(); // Obligamos a que devuelva lo borrado

        if (error) console.error('Error al limpiar sesión:', error.message);
    }

    limpiarSuscripcion() {
        if (this.channel) {
            this.supabase.client.removeChannel(this.channel);
            this.channel = null;
        }
    }

    ngOnDestroy() {
        this.limpiarSuscripcion();
    }
}