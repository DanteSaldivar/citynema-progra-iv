import { computed, inject, Injectable, signal } from '@angular/core';
import { TIPOS_BUTACA } from '../../core/models/constantes';
import { Butaca, Producto } from '../../core/models/database.types';
import { PreciosService } from '../../core/services/precios.service';
import { SupabaseService } from '../../core/supabase.service';
import { ComboPublico } from '../admin/admin-catalogo.service';
import { ReservasService } from './reserva.service';

export type TipoItemCandy = 'producto' | 'combo';

export interface ItemCarritoCandy {
  tipo: TipoItemCandy;
  id: string; // producto_id o combo_id
  nombre: string;
  cantidad: number;
  precioUnitario: number; 
  incluyeEntradas: number; 
}

interface ContextoCarritoPersistido {
  funcionId: string;
  butacasIds: string[];
  items: Array<{ tipo: TipoItemCandy; id: string; cantidad: number }>;
}

export interface DesgloseSubtotalCarrito {
  subtotalEntradasBruto: number;
  descuentoEntradasPorCombos: number;
  subtotalEntradasNeto: number;
  subtotalCandy: number;
  subtotalGeneral: number;
}

const STORAGE_KEY_CARRITO = 'citynema_carrito_ctx';

@Injectable({
  providedIn: 'root',
})
export class CarritoService {
  private readonly supabase = inject(SupabaseService);
  private readonly preciosService = inject(PreciosService);
  private readonly reservasService = inject(ReservasService);

  readonly funcionId = signal<string>('');
  readonly butacasIds = signal<string[]>([]);
  readonly butacas = signal<Butaca[]>([]);
  readonly precioBaseFuncion = signal<number>(0);
  readonly itemsCandy = signal<ItemCarritoCandy[]>([]);
  readonly expiraHoldIso = signal<string | null>(null);

  readonly puedeExtenderHold = computed(() => this.reservasService.puedeExtenderHold());


  readonly entradasCubiertasPorCombos = computed(() =>
    this.itemsCandy().reduce(
      (acc, item) => acc + (item.tipo === 'combo' ? item.incluyeEntradas * item.cantidad : 0),
      0
    )
  );

  async extenderTiempoReserva(): Promise<{ ok: true } | { ok: false; error: string }> {
    const fId = this.funcionId();
    if (!fId) return { ok: false, error: 'No hay una función activa.' };

    const res = await this.reservasService.extenderHold(fId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }

    this.expiraHoldIso.set(res.data);
    return { ok: true };
  }

  /** Subtotales por línea de candy */
  readonly lineasCandyConSubtotal = computed(() =>
    this.itemsCandy().map((item) => ({
      ...item,
      subtotalLinea: item.cantidad * item.precioUnitario,
    }))
  );

  /** Subtotal exclusivo de productos y combos del candy bar */
  readonly subtotalCandy = computed(() =>
    this.itemsCandy().reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0)
  );

  readonly desgloseSubtotal = computed<DesgloseSubtotalCarrito>(() => {
    const precioBase = this.precioBaseFuncion();
    const listaButacas = this.butacas();

    const subtotalEntradasBruto = this.preciosService.calcularSubtotalButacas(
      precioBase,
      listaButacas
    );

    const entradasACubrir = Math.min(
      listaButacas.length,
      this.entradasCubiertasPorCombos()
    );
    const descuentoEntradasPorCombos = entradasACubrir * precioBase;
    const subtotalEntradasNeto = Math.max(0, subtotalEntradasBruto - descuentoEntradasPorCombos);
    const candy = this.subtotalCandy();

    return {
      subtotalEntradasBruto,
      descuentoEntradasPorCombos,
      subtotalEntradasNeto,
      subtotalCandy: candy,
      subtotalGeneral: subtotalEntradasNeto + candy,
    };
  });

  /** Método invocable por el motor de precios del Bloque 5 */
  calcularDesgloseSubtotal(): DesgloseSubtotalCarrito {
    return this.desgloseSubtotal();
  }

  /**
   * Inicializa el contexto al salir del mapa de butacas y lo persiste en sessionStorage
   * (sin precios, solo IDs y cantidades).
   */
  establecerSeleccionButacas(funcionId: string, butacasIds: string[]): void {
    const cambioFuncion = this.funcionId() !== funcionId;
    this.funcionId.set(funcionId);
    this.butacasIds.set([...butacasIds]);

    if (cambioFuncion) {
      this.itemsCandy.set([]);
    } else {
      // Si redujo cantidad de butacas, recortar combos con entradas incluidas que excedan el nuevo total
      this.ajustarCombosAlLimiteDeButacas(butacasIds.length);
    }

    this.guardarContextoEnSession();
  }


  async rehidratarYValidarHold(
    catalogoProductos: Producto[] = [],
    catalogoCombos: ComboPublico[] = []
  ): Promise<{ ok: true } | { ok: false; motivo: string }> {
    if (!this.funcionId() || this.butacasIds().length === 0) {
      this.restaurarContextoDesdeSession();
    }

    const fId = this.funcionId();
    const bIds = this.butacasIds();

    if (!fId || bIds.length === 0) {
      return { ok: false, motivo: 'No hay una selección de butacas activa.' };
    }

    const sessionId = this.reservasService.getSessionId();
    const ahoraIso = new Date().toISOString();

    const [resFuncion, resButacas, resHold] = await Promise.all([
      this.supabase.client
        .from('funciones')
        .select('precio_base')
        .eq('id', fId)
        .single(),
      this.supabase.client
        .from('butacas')
        .select('*')
        .in('id', bIds),
      this.supabase.client
        .from('reservas_butaca')
        .select('butaca_id, expira_at')
        .eq('funcion_id', fId)
        .eq('session_id', sessionId)
        .in('butaca_id', bIds)
        .gt('expira_at', ahoraIso),
    ]);

    if (resFuncion.error || !resFuncion.data) {
      return { ok: false, motivo: 'No se pudo recuperar la función seleccionada.' };
    }

    if (resButacas.error || !resButacas.data || resButacas.data.length === 0) {
      return { ok: false, motivo: 'No se pudieron recuperar las butacas seleccionadas.' };
    }

    const holdsVigentes = resHold.data ?? [];
    if (holdsVigentes.length < bIds.length) {
      this.limpiarTodo();
      return {
        ok: false,
        motivo: 'Tu reserva temporal de butacas venció. Volvé a seleccionar tus asientos.',
      };
    }

    const vencimientoMasProximo = holdsVigentes
      .map((h) => String(h.expira_at))
      .sort()[0] ?? null;

    this.expiraHoldIso.set(vencimientoMasProximo);
    this.precioBaseFuncion.set(Number(resFuncion.data.precio_base) || 0);
    this.butacas.set(
      (resButacas.data as Butaca[]).sort(
        (a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero
      )
    );

    // Reconstruir precios reales desde el catálogo activo de la BD (nunca del storage)
    if (catalogoProductos.length > 0 || catalogoCombos.length > 0) {
      this.sincronizarItemsConCatalogoBD(catalogoProductos, catalogoCombos);
    }

    return { ok: true };
  }

  agregarProducto(producto: Producto): void {
    const actual = this.itemsCandy();
    const existente = actual.find((i) => i.tipo === 'producto' && i.id === producto.id);

    if (existente) {
      this.itemsCandy.set(
        actual.map((i) =>
          i.tipo === 'producto' && i.id === producto.id
            ? { ...i, cantidad: i.cantidad + 1, precioUnitario: Number(producto.precio) }
            : i
        )
      );
    } else {
      this.itemsCandy.set([
        ...actual,
        {
          tipo: 'producto',
          id: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precioUnitario: Number(producto.precio),
          incluyeEntradas: 0,
        },
      ]);
    }
    this.guardarContextoEnSession();
  }

  agregarCombo(combo: ComboPublico): { ok: true } | { ok: false; error: string } {
    const cantEntradasCombo = Math.max(0, Number(combo.incluye_entradas) || 0);
    const totalButacas = this.butacasIds().length;

    if (
      cantEntradasCombo > 0 &&
      this.entradasCubiertasPorCombos() + cantEntradasCombo > totalButacas
    ) {
      return {
        ok: false,
        error: `Este combo incluye ${cantEntradasCombo} entrada(s) y tenés ${totalButacas} butaca(s) elegida(s).`,
      };
    }

    const actual = this.itemsCandy();
    const existente = actual.find((i) => i.tipo === 'combo' && i.id === combo.id);

    if (existente) {
      this.itemsCandy.set(
        actual.map((i) =>
          i.tipo === 'combo' && i.id === combo.id
            ? {
                ...i,
                cantidad: i.cantidad + 1,
                precioUnitario: Number(combo.precio),
                incluyeEntradas: cantEntradasCombo,
              }
            : i
        )
      );
    } else {
      this.itemsCandy.set([
        ...actual,
        {
          tipo: 'combo',
          id: combo.id,
          nombre: combo.nombre,
          cantidad: 1,
          precioUnitario: Number(combo.precio),
          incluyeEntradas: cantEntradasCombo,
        },
      ]);
    }

    this.guardarContextoEnSession();
    return { ok: true };
  }

  decrementarItem(tipo: TipoItemCandy, id: string): void {
    const actual = this.itemsCandy();
    const siguiente = actual
      .map((item) =>
        item.tipo === tipo && item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item
      )
      .filter((item) => item.cantidad > 0);

    this.itemsCandy.set(siguiente);
    this.guardarContextoEnSession();
  }

  cantidadDe(tipo: TipoItemCandy, id: string): number {
    return this.itemsCandy().find((i) => i.tipo === tipo && i.id === id)?.cantidad ?? 0;
  }

  limpiarCandy(): void {
    this.itemsCandy.set([]);
    this.guardarContextoEnSession();
  }

  limpiarTodo(): void {
    this.funcionId.set('');
    this.butacasIds.set([]);
    this.butacas.set([]);
    this.precioBaseFuncion.set(0);
    this.itemsCandy.set([]);
    this.expiraHoldIso.set(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY_CARRITO);
    }
  }

  resumenButacasPorTipo(): {
    estandar: { cantidad: number; subtotal: number };
    vip: { cantidad: number; subtotal: number };
  } {
    const precioEstandar = this.precioBaseFuncion();
    const precioVip = this.preciosService.precioButaca(precioEstandar, TIPOS_BUTACA.VIP);
    let vipCount = 0;
    let standardCount = 0;

    for (const b of this.butacas()) {
      if (b.tipo === TIPOS_BUTACA.VIP) vipCount++;
      else standardCount++;
    }

    return {
      estandar: { cantidad: standardCount, subtotal: standardCount * precioEstandar },
      vip: { cantidad: vipCount, subtotal: vipCount * precioVip },
    };
  }

  private ajustarCombosAlLimiteDeButacas(maxEntradas: number): void {
    let entradasAcumuladas = 0;
    const ajustados: ItemCarritoCandy[] = [];

    for (const item of this.itemsCandy()) {
      if (item.tipo !== 'combo' || item.incluyeEntradas === 0) {
        ajustados.push(item);
        continue;
      }
      const maxUnidadesPermitidas = Math.floor(
        Math.max(0, maxEntradas - entradasAcumuladas) / item.incluyeEntradas
      );
      const cantidadFinal = Math.min(item.cantidad, maxUnidadesPermitidas);
      if (cantidadFinal > 0) {
        entradosPush(ajustados, item, cantidadFinal);
        entradasAcumuladas += cantidadFinal * item.incluyeEntradas;
      }
    }

    this.itemsCandy.set(ajustados);
  }

  private sincronizarItemsConCatalogoBD(
    productos: Producto[],
    combos: ComboPublico[]
  ): void {
    const mapaProds = new Map(productos.map((p) => [p.id, p]));
    const mapaCombos = new Map(combos.map((c) => [c.id, c]));

    const sincronizados: ItemCarritoCandy[] = [];
    for (const item of this.itemsCandy()) {
      if (item.tipo === 'producto') {
        const prodBD = mapaProds.get(item.id);
        if (prodBD) {
          sincronizados.push({
            tipo: 'producto',
            id: prodBD.id,
            nombre: prodBD.nombre,
            cantidad: item.cantidad,
            precioUnitario: Number(prodBD.precio),
            incluyeEntradas: 0,
          });
        }
      } else {
        const comboBD = mapaCombos.get(item.id);
        if (comboBD) {
          sincronizados.push({
            tipo: 'combo',
            id: comboBD.id,
            nombre: comboBD.nombre,
            cantidad: item.cantidad,
            precioUnitario: Number(comboBD.precio),
            incluyeEntradas: Math.max(0, Number(comboBD.incluye_entradas) || 0),
          });
        }
      }
    }

    this.itemsCandy.set(sincronizados);
    this.guardarContextoEnSession();
  }

  private guardarContextoEnSession(): void {
    if (typeof sessionStorage === 'undefined') return;
    if (!this.funcionId() || this.butacasIds().length === 0) {
      sessionStorage.removeItem(STORAGE_KEY_CARRITO);
      return;
    }
    const ctx: ContextoCarritoPersistido = {
      funcionId: this.funcionId(),
      butacasIds: this.butacasIds(),
      items: this.itemsCandy().map((i) => ({
        tipo: i.tipo,
        id: i.id,
        cantidad: i.cantidad,
      })),
    };
    sessionStorage.setItem(STORAGE_KEY_CARRITO, JSON.stringify(ctx));
  }

  private restaurarContextoDesdeSession(): void {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(STORAGE_KEY_CARRITO);
    if (!raw) return;

    try {
      const ctx = JSON.parse(raw) as ContextoCarritoPersistido;
      if (ctx.funcionId && Array.isArray(ctx.butacasIds) && ctx.butacasIds.length > 0) {
        this.funcionId.set(ctx.funcionId);
        this.butacasIds.set(ctx.butacasIds);
        this.itemsCandy.set(
          (ctx.items ?? []).map((i) => ({
            tipo: i.tipo,
            id: i.id,
            nombre: '',
            cantidad: Math.max(1, Number(i.cantidad) || 1),
            precioUnitario: 0, // Se completa desde la BD en rehidratarYValidarHold
            incluyeEntradas: 0,
          }))
        );
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY_CARRITO);
    }
  }
}

function entradosPush(
  lista: ItemCarritoCandy[],
  item: ItemCarritoCandy,
  cantidad: number
): void {
  lista.push({ ...item, cantidad });
}