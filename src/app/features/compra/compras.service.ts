import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import {
  ESTADOS_CANDY,
  ESTADOS_ENTRADA,
  ESTADOS_ORDEN,
  TIPOS_BUTACA,
} from '../../core/models/constantes';
import { Butaca } from '../../core/models/database.types';
import { PreciosService } from '../../core/services/precios.service';
import { SupabaseService } from '../../core/supabase.service';
import { ItemCarritoCandy } from './carrito.service';

@Injectable({
  providedIn: 'root',
})
export class ComprasService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly preciosService = inject(PreciosService);

  /**
   * Calcula el subtotal bruto de butacas desglosando recargos VIP.
   */
  calcularSubtotal(precioBase: number, butacas: Butaca[]): number {
    return this.preciosService.calcularSubtotalButacas(precioBase, butacas);
  }

  /**
   * Valida la edad del comprador si la película tiene restricciones 
   */
  validarEdad(clasificacion: string, fechaNacimiento?: string): boolean {
    if (clasificacion === 'atp' || !fechaNacimiento) return true;

    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
      edad--;
    }

    if (clasificacion === '13' && edad < 13) return false;
    if (clasificacion === '18' && edad < 18) return false;
    return true;
  }

  /**
   * Punto único de cálculo final de la orden (Bloque 4: sin descuentos de cupón/crédito/puntos aún;
   * el Bloque 5 extenderá este punto para aplicar RN-18).
   */
  calcularTotalFinalOrden(params: {
    subtotalEntradasNeto: number;
    subtotalCandy: number;
  }): { subtotal: number; total: number } {
    const subtotal = Math.max(0, params.subtotalEntradasNeto + params.subtotalCandy);
    return {
      subtotal,
      total: subtotal,
    };
  }


  async confirmarCompra(params: {
    funcionId: string;
    butacasIds: string[];
    emailInvitado?: string;
    itemsCandy: ItemCarritoCandy[];
  }): Promise<string> {
    const userId = this.auth.perfil()?.id ?? null;
    const emailFinal = userId ? this.auth.perfil()?.email : params.emailInvitado?.trim();

    if (!emailFinal) {
      throw new Error('Se requiere un email para enviarte las entradas.');
    }

    if (!params.butacasIds || params.butacasIds.length === 0) {
      throw new Error('No hay butacas seleccionadas para confirmar la compra.');
    }

    // 1. Re-leer función, butacas, productos y combos desde la base (fuente de verdad de precios)
    const [resFuncion, resButacas] = await Promise.all([
      this.supabase.client
        .from('funciones')
        .select('id, precio_base, estado, peliculas(clasificacion)')
        .eq('id', params.funcionId)
        .single(),
      this.supabase.client
        .from('butacas')
        .select('*')
        .in('id', params.butacasIds)
        .eq('activa', true),
    ]);

    if (resFuncion.error || !resFuncion.data) {
      throw new Error('No se pudo verificar la función seleccionada en la base de datos.');
    }

    if (resButacas.error || !resButacas.data || resButacas.data.length !== params.butacasIds.length) {
      throw new Error('Algunas butacas seleccionadas ya no están disponibles.');
    }

    const precioBaseReal = Number(resFuncion.data.precio_base) || 0;
    const butacasReales = resButacas.data as Butaca[];

    const productosIds = params.itemsCandy
      .filter((i) => i.tipo === 'producto' && i.cantidad > 0)
      .map((i) => i.id);
    const combosIds = params.itemsCandy
      .filter((i) => i.tipo === 'combo' && i.cantidad > 0)
      .map((i) => i.id);

    const [resProdsBD, resCombosBD] = await Promise.all([
      productosIds.length > 0
        ? this.supabase.client
            .from('productos')
            .select('id, precio, activo')
            .in('id', productosIds)
            .eq('activo', true)
        : Promise.resolve({ data: [], error: null }),
      combosIds.length > 0
        ? this.supabase.client
            .from('combos')
            .select('id, precio, incluye_entradas, activo')
            .in('id', combosIds)
            .eq('activo', true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (resProdsBD.error) {
      throw new Error('No se pudieron verificar los precios de los productos de Candy Bar.');
    }
    if (resCombosBD.error) {
      throw new Error('No se pudieron verificar los precios de los combos.');
    }

    const mapaPreciosProd = new Map<string, number>(
      (resProdsBD.data ?? []).map((p) => [String(p.id), Number(p.precio)])
    );
    const mapaCombosBD = new Map<string, { precio: number; incluyeEntradas: number }>(
      (resCombosBD.data ?? []).map((c) => [
        String(c.id),
        {
          precio: Number(c.precio),
          incluyeEntradas: Math.max(0, Number(c.incluye_entradas) || 0),
        },
      ])
    );

    // Armar líneas validadas de orden_productos (producto_id XOR combo_id)
    const lineasCandyValidadas: Array<{
      producto_id: string | null;
      combo_id: string | null;
      cantidad: number;
      precio_unitario: number;
    }> = [];

    let subtotalCandyReal = 0;
    let entradasCubiertasPorCombos = 0;

    for (const item of params.itemsCandy) {
      if (item.cantidad <= 0) continue;

      if (item.tipo === 'producto') {
        const precioReal = mapaPreciosProd.get(item.id);
        if (precioReal === undefined) {
          throw new Error(`El producto "${item.nombre}" ya no está disponible.`);
        }
        lineasCandyValidadas.push({
          producto_id: item.id,
          combo_id: null,
          cantidad: item.cantidad,
          precio_unitario: precioReal,
        });
        subtotalCandyReal += precioReal * item.cantidad;
      } else {
        const comboReal = mapaCombosBD.get(item.id);
        if (!comboReal) {
          throw new Error(`El combo "${item.nombre}" ya no está disponible.`);
        }
        lineasCandyValidadas.push({
          producto_id: null,
          combo_id: item.id,
          cantidad: item.cantidad,
          precio_unitario: comboReal.precio,
        });
        subtotalCandyReal += comboReal.precio * item.cantidad;
        entradasCubiertasPorCombos += comboReal.incluyeEntradas * item.cantidad;
      }
    }

    if (entradasCubiertasPorCombos > butacasReales.length) {
      throw new Error(
        'La cantidad de entradas incluidas en los combos supera las butacas seleccionadas.'
      );
    }

    // Calcular totales reales
    const subtotalEntradasBruto = this.preciosService.calcularSubtotalButacas(
      precioBaseReal,
      butacasReales
    );
    const descuentoEntradasCombos =
      Math.min(butacasReales.length, entradasCubiertasPorCombos) * precioBaseReal;
    const subtotalEntradasNeto = Math.max(0, subtotalEntradasBruto - descuentoEntradasCombos);

    const { subtotal, total } = this.calcularTotalFinalOrden({
      subtotalEntradasNeto,
      subtotalCandy: subtotalCandyReal,
    });

    const tieneCandy = lineasCandyValidadas.length > 0;
    const codigoCandy = tieneCandy ? crypto.randomUUID() : null;
    const candyEstado = tieneCandy ? ESTADOS_CANDY.PENDIENTE : null;

    // 2. Insertar Orden inicialmente en 'pendiente' (minimiza inconsistencia si falla un paso posterior)
    const { data: orden, error: errOrden } = await this.supabase.client
      .from('ordenes')
      .insert({
        user_id: userId,
        email_invitado: !userId ? emailFinal : null,
        subtotal,
        descuento_cupon: 0,
        credito_aplicado: 0,
        puntos_aplicados: 0,
        total,
        estado: ESTADOS_ORDEN.PENDIENTE,
        codigo_candy: codigoCandy,
        candy_estado: candyEstado,
      })
      .select('id, numero')
      .single();

    if (errOrden || !orden) {
      throw new Error(`No se pudo crear la orden: ${errOrden?.message ?? 'Error desconocido'}`);
    }

    // 3. Insertar Entradas con QR individual
    const clasificacion =
      (resFuncion.data.peliculas as { clasificacion?: string } | null)?.clasificacion ?? 'atp';
    const requiereAdulto = clasificacion !== 'atp';

    const entradasToInsert = butacasReales.map((b) => ({
      orden_id: orden.id,
      funcion_id: params.funcionId,
      butaca_id: b.id,
      precio: this.preciosService.precioButaca(precioBaseReal, b.tipo ?? TIPOS_BUTACA.ESTANDAR),
      tipo_butaca: b.tipo,
      requiere_adulto: requiereAdulto,
      codigo_qr: crypto.randomUUID(),
      estado: ESTADOS_ENTRADA.VALIDA,
    }));

    const { error: errEntradas } = await this.supabase.client
      .from('entradas')
      .insert(entradasToInsert);

    if (errEntradas) {
      throw new Error(
        `La orden #${orden.numero} quedó pendiente pero falló la emisión de entradas: ${errEntradas.message}`
      );
    }

    // 4. Insertar líneas de Candy Bar (producto_id XOR combo_id) ANTES de marcar pagada
    if (tieneCandy) {
      const filasOrdenProductos = lineasCandyValidadas.map((l) => ({
        orden_id: orden.id,
        producto_id: l.producto_id,
        combo_id: l.combo_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
      }));

      const { error: errCandy } = await this.supabase.client
        .from('orden_productos')
        .insert(filasOrdenProductos);

      if (errCandy) {
        throw new Error(
          `Atención: se creó la orden #${orden.numero} en estado PENDIENTE y se emitieron tus entradas, pero falló el guardado del Candy Bar (${errCandy.message}). Contactá al personal con el número de orden.`
        );
      }
    }

    // 5. Marcar la orden como 'pagada' una vez persistidas entradas y candy
    const { error: errPagar } = await this.supabase.client
      .from('ordenes')
      .update({
        estado: ESTADOS_ORDEN.PAGADA,
        pagada_at: new Date().toISOString(),
      })
      .eq('id', orden.id);

    if (errPagar) {
      throw new Error(
        `Las entradas y el candy de la orden #${orden.numero} se guardaron, pero no se pudo confirmar el estado pagado: ${errPagar.message}`
      );
    }

    // 6. Liberar reservas temporales de butacas
    await this.supabase.client
      .from('reservas_butaca')
      .delete()
      .eq('funcion_id', params.funcionId)
      .in('butaca_id', params.butacasIds);

    // 7. Acreditar puntos solo si el usuario está autenticado
    if (userId && total > 0) {
      const { error: errPuntos } = await this.supabase.client
        .from('puntos_movimientos')
        .insert({
          user_id: userId,
          tipo: 'acumulacion',
          puntos: Math.floor(total),
          orden_id: orden.id,
          descripcion: `Puntos ganados por compra de orden #${orden.numero}`,
        });

      if (errPuntos) {
        console.error('Error al acreditar puntos:', errPuntos);
      }
    }

    return orden.id;
  }

  /**
   * Obtiene la orden completa con entradas, butacas, productos y combos para el comprobante y PDF.
   */
  async getOrdenCompleta(ordenId: string) {
    const { data, error } = await this.supabase.client
      .from('ordenes')
      .select(`
        *,
        entradas (
          *,
          butacas ( fila, numero ),
          funciones ( inicio, pelicula_id, formato, idioma, salas(nombre), peliculas(titulo, clasificacion) )
        ),
        orden_productos (
          id,
          producto_id,
          combo_id,
          cantidad,
          precio_unitario,
          productos ( nombre ),
          combos ( nombre, incluye_entradas )
        )
      `)
      .eq('id', ordenId)
      .single();

    if (error) {
      throw new Error(`Error al recuperar la orden: ${error.message}`);
    }

    return data;
  }
}