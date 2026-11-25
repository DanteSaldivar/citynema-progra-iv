import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

@Injectable({
    providedIn: 'root'
})
export class AdminReportesService {

    private supabase = inject(SupabaseService);

    async getDashboardData() {
        // 1. Facturación Diaria y Entradas Vendidas
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const { data: ordenes, error: errOrdenes } = await this.supabase.client
            .from('ordenes')
            .select('total, entradas(id)')
            .eq('estado', 'pagada')
            .gte('pagada_at', hoy.toISOString());

        if (errOrdenes) throw new Error('Error al cargar la facturación diaria.');

        let facturacionDiaria = 0;
        let entradasVendidas = 0;

        ordenes?.forEach(orden => {
            facturacionDiaria += Number(orden.total);
            entradasVendidas += orden.entradas ? orden.entradas.length : 0;
        });

        // 2. Gráfico: Películas más vistas (Mes actual)
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
        const { data: entradasValidas } = await this.supabase.client
            .from('entradas')
            .select('funciones(peliculas(titulo))')
            .in('estado', ['valida', 'usada'])
            .gte('created_at', inicioMes);

        const conteoPeliculas: Record<string, number> = {};
        entradasValidas?.forEach((e: any) => {
            const titulo = e.funciones?.peliculas?.titulo;
            if (titulo) conteoPeliculas[titulo] = (conteoPeliculas[titulo] || 0) + 1;
        });

        const topPeliculas = Object.entries(conteoPeliculas)
            .map(([titulo, vistas]) => ({ titulo, vistas }))
            .sort((a, b) => b.vistas - a.vistas)
            .slice(0, 5);

        // 3. Producto de Candy Bar más vendido
        const { data: candyVendidos } = await this.supabase.client
            .from('orden_productos')
            .select('cantidad, productos(nombre)');

        const conteoCandy: Record<string, number> = {};
        candyVendidos?.forEach((c: any) => {
            const nombre = c.productos?.nombre;
            if (nombre) conteoCandy[nombre] = (conteoCandy[nombre] || 0) + c.cantidad;
        });

        const topCandy = Object.entries(conteoCandy)
            .map(([nombre, cantidad]) => ({ nombre, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 3);

        // 4. Log de Actividad Reciente
        const { data: auditoria } = await this.supabase.client
            .from('audit_log')
            .select('*, profiles(email)')
            .order('created_at', { ascending: false })
            .limit(15);

        return { facturacionDiaria, entradasVendidas, topPeliculas, topCandy, auditoria };
    }
}