import { inject, Injectable } from '@angular/core';
import { TIPOS_BUTACA } from '../models/constantes';
import { Butaca, TipoButaca } from '../models/database.types';
import { ConfiguracionService } from './configuracion.service';

@Injectable({
  providedIn: 'root',
})
export class PreciosService {
  private readonly configService = inject(ConfiguracionService);
  private readonly RECARGO_VIP_DEFAULT_PCT = 50;

  /** Lee el porcentaje de recargo VIP desde configuracion.recargo_vip_pct (fallback 50%). */
  obtenerRecargoVipPct(): number {
    const raw = Number(
      this.configService.get<number>('recargo_vip_pct', this.RECARGO_VIP_DEFAULT_PCT)
    );
    return Number.isFinite(raw) && raw >= 0 ? raw : this.RECARGO_VIP_DEFAULT_PCT;
  }


  precioButaca(precioBase: number, tipo: TipoButaca, recargoVipPct?: number): number {
    const base = Number(precioBase) || 0;
    if (tipo === TIPOS_BUTACA.VIP) {
      const pct = recargoVipPct ?? this.obtenerRecargoVipPct();
      return Math.round(base * (1 + pct / 100) * 100) / 100;
    }
    return Math.round(base * 100) / 100;
  }

  /** Calcula el subtotal de un conjunto de butacas usando precioButaca(). */
  calcularSubtotalButacas(
    precioBase: number,
    butacas: ReadonlyArray<Pick<Butaca, 'tipo'>>,
    recargoVipPct?: number
  ): number {
    const pct = recargoVipPct ?? this.obtenerRecargoVipPct();
    return butacas.reduce((acc, b) => acc + this.precioButaca(precioBase, b.tipo, pct), 0);
  }
}