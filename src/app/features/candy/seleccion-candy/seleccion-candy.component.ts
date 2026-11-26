import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CategoriaProducto, Producto } from '../../../core/models/database.types';
import { FuncionesService } from '../../../core/services/funciones.service';
import { ToastService } from '../../../core/services/toast.service';
import { CarritoService } from '../../compra/carrito.service';
import { CandyCatalogoService, ComboPublico } from '../../admin/admin-catalogo.service';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-seleccion-candy',
  styleUrl: './seleccion-candy.component.css',
  templateUrl: './seleccion-candy.component.html',
})
export class SeleccionCandyComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly candyCatalogo = inject(CandyCatalogoService);
  readonly carrito = inject(CarritoService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly toast = inject(ToastService);

  readonly cargando = signal<boolean>(true);
  readonly mensajeError = signal<string | null>(null);
  readonly peliculaTitulo = signal<string>('');

  readonly categorias = signal<CategoriaProducto[]>([]);
  readonly productos = signal<Producto[]>([]);
  readonly combos = signal<ComboPublico[]>([]);
  readonly categoriaSeleccionadaId = signal<string>('todas');

  readonly segundosRestantes = signal<number>(0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  /** Combos destacados arriba y bien visibles (Regla 4B.6) */
  readonly combosDestacados = computed(() =>
    this.combos().filter((c) => c.destacado)
  );

  /** Combos regulares (no destacados) */
  readonly combosRegulares = computed(() =>
    this.combos().filter((c) => !c.destacado)
  );

  /** Productos filtrados por la categoría activa seleccionada en chips */
  readonly productosFiltrados = computed(() => {
    const catId = this.categoriaSeleccionadaId();
    if (catId === 'todas') return this.productos();
    return this.productos().filter((p) => p.categoria_id === catId);
  });

  readonly tiempoRestanteFormateado = computed(() => {
    const total = Math.max(0, this.segundosRestantes());
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  });

  readonly etiquetasButacas = computed(() =>
    this.carrito
      .butacas()
      .map((b) => `${b.fila}${b.numero}`)
      .join(', ')
  );

  async ngOnInit(): Promise<void> {
    const navState = history.state as { funcionId?: string; butacasIds?: string[] };
    if (navState?.funcionId && navState?.butacasIds?.length) {
      this.carrito.establecerSeleccionButacas(navState.funcionId, navState.butacasIds);
    }

    await this.inicializarPantalla();
  }

  private async inicializarPantalla(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);

    const resCatalogo = await this.candyCatalogo.obtenerCatalogoActivo();
    if (!resCatalogo.ok) {
      this.mensajeError.set(resCatalogo.error);
      this.cargando.set(false);
      return;
    }

    this.categorias.set(resCatalogo.data.categorias);
    this.productos.set(resCatalogo.data.productos);
    this.combos.set(resCatalogo.data.combos);

    if (resCatalogo.data.categorias.length > 0) {
      this.categoriaSeleccionadaId.set(resCatalogo.data.categorias[0].id);
    }

    const validacionHold = await this.carrito.rehidratarYValidarHold(
      resCatalogo.data.productos,
      resCatalogo.data.combos
    );

    if (!validacionHold.ok) {
      this.toast.error(validacionHold.motivo);
      this.cargando.set(false);
      void this.router.navigate(['/catalogo']);
      return;
    }

    try {
      const peli = await this.funcionesService.getNombrePelicula(this.carrito.funcionId());
      this.peliculaTitulo.set((peli as { titulo?: string })?.titulo ?? '');
    } catch {
      // Si falla solo el título, no bloqueamos el flujo
    }

    this.iniciarCountdown();
    this.cargando.set(false);
  }

  private iniciarCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    const expiraIso = this.carrito.expiraHoldIso();
    if (!expiraIso) return;

    const tick = () => {
      const diff = Math.ceil((new Date(expiraIso).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        this.segundosRestantes.set(0);
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.toast.info('El tiempo de reserva de tus butacas venció.');
        const fId = this.carrito.funcionId();
        this.carrito.limpiarTodo();
        void this.router.navigate(fId ? ['/compra/asientos', fId] : ['/catalogo']);
        return;
      }
      this.segundosRestantes.set(diff);
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  async extenderTiempo(): Promise<void> {
  const res = await this.carrito.extenderTiempoReserva();
  if (!res.ok) {
    this.toast.error(res.error);
    return;
  }
  this.toast.exito('Tiempo de reserva extendido.');
}

  seleccionarCategoria(categoriaId: string): void {
    this.categoriaSeleccionadaId.set(categoriaId);
  }

  sumarProducto(prod: Producto): void {
    this.carrito.agregarProducto(prod);
  }

  restarProducto(prod: Producto): void {
    this.carrito.decrementarItem('producto', prod.id);
  }

  sumarCombo(combo: ComboPublico): void {
    const res = this.carrito.agregarCombo(combo);
    if (!res.ok) {
      this.toast.info(res.error);
    }
  }

  restarCombo(combo: ComboPublico): void {
    this.carrito.decrementarItem('combo', combo.id);
  }

  continuarSinCandy(): void {
    this.carrito.limpiarCandy();
    void this.irACheckout();
  }

  continuarConCandy(): void {
    void this.irACheckout();
  }

  private async irACheckout(): Promise<void> {
    await this.router.navigate(['/compra/checkout'], {
      state: {
        funcionId: this.carrito.funcionId(),
        butacasIds: this.carrito.butacasIds(),
      },
    });
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}