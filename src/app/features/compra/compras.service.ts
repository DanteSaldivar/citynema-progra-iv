import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Butaca } from '../../core/models/database.types';
import { SupabaseService } from '../../core/supabase.service';

export interface CarritoCandy {
    productoId?: string;
    comboId?: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
}

@Injectable({
    providedIn: 'root'
})
export class ComprasService {
    private auth = inject(AuthService);
    private supabase = inject(SupabaseService);

    /**
     * RN-18: Calcula el subtotal desglosando recargos VIP.
     */
    calcularSubtotal(precioBase: number, butacas: Butaca[], recargoVipPct: number = 50): number {
        return butacas.reduce((total, b) => {
            let precioFila = precioBase;
            if (b.tipo === 'vip') {
                precioFila += precioBase * (recargoVipPct / 100);
            }
            return total + precioFila;
        }, 0);
    }

    /**
     * Valida la edad del comprador si la película tiene restricciones (RF-COM-07).
     */
    validarEdad(clasificacion: string, fechaNacimiento?: string): boolean {
        if (clasificacion === 'atp' || !fechaNacimiento) return true; // Si es anónimo asume responsabilidad (A-02)

        const edad = new Date().getFullYear() - new Date(fechaNacimiento).getFullYear();
        if (clasificacion === '13' && edad < 13) return false;
        if (clasificacion === '18' && edad < 18) return false;
        return true;
    }

    /**
     * Confirma la orden realizando los INSERTS secuenciales.
     * Genera los QR con crypto.randomUUID().
     */
    async confirmarCompra(params: {
        funcionId: string;
        butacas: Butaca[];
        precioBase: number;
        emailInvitado?: string;
        candy: CarritoCandy[];
        totalPagado: number;
    }) {

        const userId = this.auth.perfil()?.id ?? null;
        const emailFinal = userId ? this.auth.perfil()?.email : params.emailInvitado;

        if (!emailFinal) throw new Error("Se requiere un email para enviar las entradas.");

        try {
            // 1. Crear Orden
            const codigoCandy = params.candy.length > 0 ? crypto.randomUUID() : null;
            const { data: orden, error: errOrden } = await this.supabase.client
                .from('ordenes')
                .insert({
                    user_id: userId || null,
                    email_invitado: !userId ? emailFinal : null,
                    subtotal: params.totalPagado,
                    total: params.totalPagado,
                    estado: 'pagada', // Simulación de pago exitoso
                    pagada_at: new Date().toISOString(),
                    codigo_candy: codigoCandy,
                    candy_estado: codigoCandy ? 'pendiente' : null
                })
                .select()
                .single();

            if (errOrden) throw errOrden;

            // 2. Crear Entradas (con QR individual)
            const entradasToInsert = params.butacas.map(b => {
                let precio = params.precioBase;
                if (b.tipo === 'vip') precio += (params.precioBase * 0.5);

                return {
                    orden_id: orden.id,
                    funcion_id: params.funcionId,
                    butaca_id: b.id,
                    precio: precio,
                    tipo_butaca: b.tipo,
                    codigo_qr: crypto.randomUUID(), // QR único por entrada
                    estado: 'valida'
                };
            });

            const { error: errEntradas } = await this.supabase.client.from('entradas').insert(entradasToInsert);
            if (errEntradas) throw errEntradas;

            // 3. Crear items de Candy Bar (si hay)
            if (params.candy.length > 0) {
                const candyToInsert = params.candy.map(c => ({
                    orden_id: orden.id,
                    producto_id: c.productoId || null,
                    combo_id: c.comboId || null,
                    cantidad: c.cantidad,
                    precio_unitario: c.precioUnitario
                }));
                await this.supabase.client.from('orden_productos').insert(candyToInsert);
            }

            // 4. Limpiar reservas temporales
            const butacasIds = params.butacas.map(b => b.id);
            await this.supabase.client
                .from('reservas_butaca')
                .delete()
                .eq('funcion_id', params.funcionId)
                .in('butaca_id', butacasIds);

            // 5. Cargamos puntos

            const { error: errPuntos } = await this.supabase.client.from('puntos_movimientos').insert({
                user_id: userId,
                tipo: 'acumulacion',
                puntos: Math.floor(params.totalPagado), // 1 peso = 1 punto
                orden_id: orden.id,
                descripcion: `Puntos ganados por compra de orden #${orden.id}`,
            });
            if (errPuntos) {
                console.error("Error al guardar puntos: ", errPuntos);
            }

            return orden.id; // Retorna el ID para redirigir al PDF
        } catch (error: any) {
            throw new Error(`Fallo al confirmar la compra: ${error.message}`);
        }
    }

    // Métodos auxiliares para cargar catálogo de Candy Bar
    async getProductosCandy() {
        const { data } = await this.supabase.client.from('productos').select('*').eq('activo', true);
        return data || [];
    }

    /**
   * Obtiene la orden completa con sus entradas, funciones, salas, películas y productos de candy.
   * Usado para la generación del PDF de éxito.
   */
    async getOrdenCompleta(ordenId: string) {
        const { data, error } = await this.supabase.client
            .from('ordenes')
            .select(`
        *,
        entradas ( *, funciones ( inicio, pelicula_id, salas(nombre), peliculas(titulo, clasificacion) ) ),
        orden_productos ( cantidad, productos(nombre) )
      `)
            .eq('id', ordenId)
            .single();

        if (error) {
            throw new Error(`Error al recuperar la orden: ${error.message}`);
        }

        return data;
    }

    async getDatosCheckout(funcionId: string, butacasIds: string[]) {
        // Buscar precio de la función
        const { data: funcion, error: errFuncion } = await this.supabase.client
            .from('funciones')
            .select('precio_base')
            .eq('id', funcionId)
            .single();

        if (errFuncion || !funcion) {
            throw new Error("No se pudo cargar el precio de la función.");
        }

        // Buscar detalles de las butacas (para saber cuáles son VIP/estándar)
        const { data: butacas, error: errButacas } = await this.supabase.client
            .from('butacas')
            .select('*')
            .in('id', butacasIds);

        if (errButacas || !butacas) {
            throw new Error("No se pudieron cargar los detalles de las butacas.");
        }

        return {
            precioBase: funcion.precio_base,
            butacas: butacas as Butaca[]
        };
    }
}