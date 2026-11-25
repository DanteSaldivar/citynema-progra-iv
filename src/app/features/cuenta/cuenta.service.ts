import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth/auth.service';


@Injectable({
  providedIn: 'root'
})
export class CuentaService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  async getDatosPerfil() {
    const userId = this.auth.perfil()?.id;
    if (!userId) throw new Error('Usuario no autenticado');

    const [{ data: puntos, error: errPuntos }, { data: creditos, error: errCreditos }] = await Promise.all([
      this.supabase.client.from('puntos_movimientos').select('puntos').eq('user_id', userId),
      this.supabase.client.from('creditos_movimientos').select('monto').eq('user_id', userId),
    ]);

    if (errPuntos) throw errPuntos;
    if (errCreditos) throw errCreditos;

    return {
      saldoPuntos: puntos.reduce((acc, m) => acc + m.puntos, 0),
      saldoCredito: creditos.reduce((acc, m) => acc + Number(m.monto), 0),
    };
  }

  async getHistorialCompras() {
    const userId = this.auth.perfil()?.id;
    const { data, error } = await this.supabase.client
      .from('ordenes')
      .select(`
        id, total, estado, created_at,
        entradas ( id, estado, funciones ( inicio, peliculas(titulo, poster_url) ) )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * REGLA DE NEGOCIO: Cancelación hasta 2 horas antes y reintegro en créditos.
   */
  async cancelarOrden(orden: any) {
    const userId = this.auth.perfil()?.id;

    const funcionInicio = new Date(orden.entradas[0]?.funciones?.inicio);
    const ahora = new Date();
    const diferenciaHoras = (funcionInicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    if (diferenciaHoras < 2) {
      throw new Error('Solo se puede cancelar hasta 2 horas antes de la función.');
    }
    const { data: puntosDeEstaOrden } = await this.supabase.client
      .from('puntos_movimientos')
      .select('puntos')
      .eq('orden_id', orden.id)
      // Asegúrate de que el string coincida con el tipo que usas al sumar puntos en el checkout
      .eq('tipo', 'acumulacion')
      .maybeSingle();

    // Si la orden le dio puntos, tomamos ese valor. Si no (es vieja o anónima), es 0.
    const puntosARevertir = puntosDeEstaOrden ? puntosDeEstaOrden.puntos : 0;

    if (puntosARevertir > 0) {
      // 2. Obtenemos el saldo actual sumando todo el historial
      const { data: movimientos } = await this.supabase.client
        .from('puntos_movimientos')
        .select('puntos')
        .eq('user_id', userId);

      const saldoActualPuntos = movimientos?.reduce((acc, mov) => acc + (mov.puntos || 0), 0) || 0;

      // 3. Comprobamos si le alcanza
      if (saldoActualPuntos < puntosARevertir) {
        throw new Error(`No puedes cancelar. Tienes ${saldoActualPuntos} puntos, pero necesitas ${puntosARevertir} para devolver los generados por esta compra.`);
      }
    }

    await this.supabase.client.from('ordenes').update({ estado: 'cancelada' }).eq('id', orden.id);
    await this.supabase.client.from('entradas').update({ estado: 'cancelada' }).eq('orden_id', orden.id);

    // B) Acreditar: un INSERT, no un update sobre un valor leído antes.
    const { error: errCredito } = await this.supabase.client.from('creditos_movimientos').insert({
      user_id: userId,
      tipo: 'acreditacion',
      monto: orden.total,
      orden_id: orden.id,
      descripcion: `Crédito por cancelación de orden #${orden.id}`,
    });
    if (errCredito) throw errCredito;

    // RN-07 (del archivo de ambigüedades, A-07): revertir los puntos ganados por esa orden
    const { error: errPuntos } = await this.supabase.client.from('puntos_movimientos').insert({
      user_id: userId,
      tipo: 'ajuste',
      puntos: -puntosARevertir, // mismo criterio que al acreditar: 1 punto por peso
      orden_id: orden.id,
      descripcion: `Reverso de puntos por cancelación de orden #${orden.id}`,
    });
    if (errPuntos) throw errPuntos;

    await this.supabase.client.from('cancelaciones').insert({
      orden_id: orden.id,
      user_id: userId,
      monto_acreditado: orden.total,
    });

    await this.supabase.client.from('audit_log').insert({
      actor_id: userId,
      accion: 'cancelacion_usuario',
      entidad: 'ordenes',
      entidad_id: orden.id,
    });

    const nuevo = await this.getDatosPerfil();
    return nuevo.saldoCredito;
  }

  /**
   * Obtiene las recompensas configuradas por el admin
   */
  async getRecompensas() {
    const { data, error } = await this.supabase.client
      .from('recompensas')
      .select('*')
      .eq('activa', true);

    if (error) throw error;
    return data;
  }

  /**
 * Obtiene las películas que el usuario ya vio (entradas en estado 'usada' o de funciones pasadas)
 * y adjunta la reseña si el usuario ya la calificó.
 */
  async getMisPeliculasVistas() {
    const userId = this.auth.perfil()?.id;
    if (!userId) return [];

    // 1. Obtener entradas válidas/usadas del usuario
    const { data: entradas, error: errEntradas } =
      await this.supabase.client
        .from('entradas')
        .select(`
        id,
        estado,
        ordenes!inner (
          user_id
        ),
        funciones!inner (
          inicio,
          peliculas!inner (
            id,
            titulo,
            poster_url
          )
        )
      `)
        .eq('ordenes.user_id', userId)
        .eq('estado', 'usada');

    if (errEntradas) {
      throw new Error(errEntradas.message);
    }

    // 2. Obtener las reseñas que este usuario ya dejó
    const { data: resenas, error: errResenas } = await this.supabase.client
      .from('resenias')
      .select('*')
      .eq('user_id', userId);

    if (errResenas) throw new Error('Error al cargar reseñas.');

    // 3. Agrupar por película en TypeScript para un historial visual único
    const peliculasMap = new Map<string, any>();

    entradas?.forEach((entrada: any) => {
      const peli = entrada.funciones.peliculas;
      const fecha = entrada.funciones.inicio;

      if (!peliculasMap.has(peli.id)) {
        const miResena = resenas?.find(r => r.pelicula_id === peli.id);
        peliculasMap.set(peli.id, {
          id: peli.id,
          titulo: peli.titulo,
          poster_url: peli.poster_url,
          ultima_fecha: fecha,
          calificacion: miResena?.puntaje || 0,
          comentario: miResena?.comentario || ''
        });
      } else {
        // Si la vio varias veces, guardar la fecha más reciente
        const existente = peliculasMap.get(peli.id);
        if (new Date(fecha) > new Date(existente.ultima_fecha)) {
          existente.ultima_fecha = fecha;
        }
      }
    });

    return Array.from(peliculasMap.values());
  }

  /**
   * Inserta o actualiza la reseña de una película (Upsert).
   */
  async guardarResena(peliculaId: string, puntaje: number, comentario: string) {
    const userId = this.auth.perfil()?.id;
    if (!userId) throw new Error('Debe iniciar sesión para calificar.');

    const { error } = await this.supabase.client
      .from('resenias')
      .upsert({
        user_id: userId,
        pelicula_id: peliculaId,
        puntaje: puntaje,
        comentario: comentario,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, pelicula_id' }); // Requiere restricción UNIQUE en BD

    if (error) throw new Error(`Error al guardar calificación: ${error.message}`);

    // Auditoría
    await this.supabase.client.from('audit_log').insert({
      actor_id: userId,
      accion: 'dejar_resena',
      entidad: 'resenias',
      entidad_id: peliculaId
    });
  }
}