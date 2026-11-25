import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase.service';


@Injectable({
  providedIn: 'root'
})
export class ValidacionService {
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);

  /**
   * Valida el acceso a la sala escaneando el QR de una entrada.
   * Verifica que no haya sido usada antes y registra quién la validó.
   */
  async validarEntrada(codigoQr: string) {
    const empleadoId = this.auth.perfil()?.id;

    // 1. Buscar la entrada
    const { data: entrada, error: errBusqueda } = await this.supabase.client
      .from('entradas')
      .select('*, funciones(pelicula_id, inicio, formato, idioma)')
      .eq('codigo_qr', codigoQr)
      .single();

    if (errBusqueda || !entrada) throw new Error('Código QR no encontrado o inválido.');

    // 2. Verificar estado (QR de un solo uso)
    if (entrada.estado === 'usada') throw new Error('Esta entrada YA FUE VALIDADA anteriormente.');
    if (entrada.estado === 'cancelada') throw new Error('Esta entrada fue cancelada y no es válida.');

    // 3. Quemar la entrada (marcar como usada)
    const { error: errUpdate } = await this.supabase.client
      .from('entradas')
      .update({
        estado: 'usada',
        validada_at: new Date().toISOString(),
        validada_por: empleadoId
      })
      .eq('id', entrada.id);

    if (errUpdate) throw new Error('Error de conexión al validar la entrada.');

    // 4. Registrar auditoría (quién validó)
    await this.registrarAuditoria('validar_entrada', 'entradas', entrada.id);

    return entrada;
  }

  /**
   * Valida el retiro de productos del Candy Bar usando el código de la orden.
   */
  async validarRetiroCandy(codigoCandy: string) {
    const empleadoId = this.auth.perfil()?.id;

    const { data: orden, error: errBusqueda } = await this.supabase.client
      .from('ordenes')
      .select('id, candy_estado, orden_productos(*)')
      .eq('codigo_candy', codigoCandy)
      .single();

    if (errBusqueda || !orden) throw new Error('Código de Candy Bar no encontrado.');
    if (orden.candy_estado === 'entregado') throw new Error('Este pedido de Candy Bar YA FUE ENTREGADO.');
    if (orden.candy_estado === 'cancelado') throw new Error('Este pedido fue cancelado.');

    const { error: errUpdate } = await this.supabase.client
      .from('ordenes')
      .update({
        candy_estado: 'entregado',
        candy_entregado_at: new Date().toISOString(),
        candy_entregado_por: empleadoId
      })
      .eq('id', orden.id);

    if (errUpdate) throw new Error('Error al confirmar la entrega del Candy Bar.');

    await this.registrarAuditoria('entregar_candy', 'ordenes', orden.id);

    return orden;
  }

  private async registrarAuditoria(accion: string, entidad: string, entidadId: string) {
    const perfil = this.auth.perfil();
    await this.supabase.client.from('audit_log').insert({
      actor_id: perfil?.id,
      actor_rol: perfil?.rol,
      accion: accion,
      entidad: entidad,
      entidad_id: entidadId
    });
  }
}