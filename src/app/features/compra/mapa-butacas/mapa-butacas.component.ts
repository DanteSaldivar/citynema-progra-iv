import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal, } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MAX_BUTACAS_POR_COMPRA, TIPOS_BUTACA, TIPO_BUTACA_ETIQUETAS, } from '../../../core/models/constantes';
import { Butaca } from '../../../core/models/database.types';
import { FuncionesService } from '../../../core/services/funciones.service';
import { PreciosService } from '../../../core/services/precios.service';
import { ToastService } from '../../../core/services/toast.service';
import { ButacaOcupada, ReservasService } from '../reserva.service';
import { CarritoService } from '../carrito.service';

interface FilaAgrupada {
  letra: string;
  izquierda: Butaca[];
  centro: Butaca[];
  derecha: Butaca[];
}

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-mapa-butacas',
  styleUrl: './mapa-butacas.component.css',
  templateUrl: './mapa-butacas.component.html',
})
export class MapaButacasComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reservasService = inject(ReservasService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly preciosService = inject(PreciosService);
  private readonly toast = inject(ToastService);
  private readonly carritoService = inject(CarritoService);

  funcionId = '';
  salaId = '';

  readonly maxButacas = MAX_BUTACAS_POR_COMPRA;
  readonly pelicula = signal<{ titulo: string } | null>(null);
  readonly precioBase = signal<number>(0);
  readonly cargando = signal<boolean>(true);
  readonly mensajeError = signal<string | null>(null);

  readonly butacasFisicas = signal<Butaca[]>([]);
  readonly continuandoCompra = signal<boolean>(false);
  readonly procesando = signal<string[]>([]);

  // Contador regresivo visible del tiempo restante de reserva
  readonly segundosRestantes = signal<number>(0);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private avisoVencimientoMostrado = false;

  readonly misSeleccionadas = computed(() => this.reservasService.misReservasActivas());

  readonly butacasSeleccionadasLista = computed(() => {
    const ids = new Set(this.misSeleccionadas());
    return this.butacasFisicas()
      .filter((b) => ids.has(b.id))
      .sort((a, b) => a.fila.localeCompare(b.fila) || a.numero - b.numero);
  });

  readonly etiquetasSeleccionadas = computed(() =>
    this.butacasSeleccionadasLista()
      .map((b) => `${b.fila}${b.numero}`)
      .join(', ')
  );

  readonly precioEntradas = computed(() =>
    this.preciosService.calcularSubtotalButacas(
      this.precioBase(),
      this.butacasSeleccionadasLista()
    )
  );

  readonly tieneVIP = computed(() =>
    this.butacasSeleccionadasLista().some((b) => b.tipo === TIPOS_BUTACA.VIP)
  );

  readonly precioUnitarioVip = computed(() =>
    this.preciosService.precioButaca(this.precioBase(), TIPOS_BUTACA.VIP)
  );

  readonly recargoVipPct = computed(() => this.preciosService.obtenerRecargoVipPct());

  /** Mapa indexado de ocupación para evitar búsquedas lineales en 532 elementos */
  readonly mapaBloqueadas = computed(() => {
    const mapa = new Map<string, ButacaOcupada['estado']>();
    for (const item of this.reservasService.butacasBloqueadas()) {
      mapa.set(item.id, item.estado);
    }
    return mapa;
  });

  /** Detecta si todas las butacas activas están vendidas o retenidas por otros */
  readonly funcionAgotada = computed(() => {
    const totalActivas = this.butacasFisicas().length;
    if (totalActivas === 0) return false;
    return this.mapaBloqueadas().size >= totalActivas && this.misSeleccionadas().length === 0;
  });

  /** Reconstruye grilla de 20 filas (A-T) con bloques izquierda/centro/derecha desde la tabla butacas */
  readonly filasAgrupadas = computed<FilaAgrupada[]>(() => {
    const butacas = this.butacasFisicas();
    if (!butacas.length) return [];

    const agrupadas: Record<string, FilaAgrupada> = {};
    for (const b of butacas) {
      if (!agrupadas[b.fila]) {
        agrupadas[b.fila] = { letra: b.fila, izquierda: [], centro: [], derecha: [] };
      }
      if (b.columna === 'izquierda') agrupadas[b.fila].izquierda.push(b);
      if (b.columna === 'centro') agrupadas[b.fila].centro.push(b);
      if (b.columna === 'derecha') agrupadas[b.fila].derecha.push(b);
    }

    return Object.values(agrupadas)
      .sort((a, b) => a.letra.localeCompare(b.letra))
      .map((f) => ({
        ...f,
        izquierda: [...f.izquierda].sort((a, b) => a.numero - b.numero),
        centro: [...f.centro].sort((a, b) => a.numero - b.numero),
        derecha: [...f.derecha].sort((a, b) => a.numero - b.numero),
      }));
  });

  readonly tiempoRestanteFormateado = computed(() => {
    const total = Math.max(0, this.segundosRestantes());
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }) 
  constructor() {
    effect(() => {
      const expiraIso = this.reservasService.vencimientoProximo();
      this.detenerCountdown();

      if (!expiraIso) {
        this.segundosRestantes.set(0);
        return;
      }

      this.avisoVencimientoMostrado = false;
      const actualizar = () => {
        const diffSeg = Math.ceil((new Date(expiraIso).getTime() - Date.now()) / 1000);
        if (diffSeg <= 0) {
          this.segundosRestantes.set(0);
          this.detenerCountdown();
          if (!this.avisoVencimientoMostrado) {
            this.avisoVencimientoMostrado = true;
            this.toast.info('El tiempo de reserva de tus butacas venció y fueron liberadas.');
            void this.reservasService
              .limpiarReservasVencidasDeFuncion(this.funcionId)
              .then(() => this.reservasService.cargarOcupacionInicial(this.funcionId));
          }
          return;
        }
        this.segundosRestantes.set(diffSeg);
      };

      actualizar();
      this.countdownInterval = setInterval(actualizar, 1000);
    });
  }

  @HostListener('window:beforeunload')
  alCerrarPestana(): void {
    if (!this.continuandoCompra() && this.funcionId) {
      void this.reservasService.liberarPropiasDeFuncion(this.funcionId);
    }
  }

  async ngOnInit(): Promise<void> {
    this.funcionId = this.route.snapshot.paramMap.get('funcionId') ?? '';
    if (!this.funcionId) {
      this.mensajeError.set('Función no especificada.');
      this.cargando.set(false);
      return;
    }

    await this.cargarMapa();
  }

  async cargarMapa(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);

    try {
      const [datosSala, peli, funcion] = await Promise.all([
        this.funcionesService.getButacasDeFuncion(this.funcionId),
        this.funcionesService.getNombrePelicula(this.funcionId),
        this.funcionesService.getFuncion(this.funcionId),
      ]);

      this.salaId = datosSala.salaId;
      this.butacasFisicas.set(datosSala.butacas);
      this.pelicula.set(peli.length ? { titulo: peli[0].titulo } : null);
      this.precioBase.set(Number(funcion.precio_base) || 0);

      const resRt = await this.reservasService.inicializarTiempoReal(this.funcionId);
      if (!resRt.ok) {
        this.mensajeError.set(resRt.error);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al cargar el mapa de butacas.';
      this.mensajeError.set(msg);
    } finally {
      this.cargando.set(false);
    }
  }

  estadoButaca(butacaId: string): 'libre' | 'reservada' | 'ocupada' {
    return this.mapaBloqueadas().get(butacaId) ?? 'libre';
  }

  ariaLabelButaca(butaca: Butaca): string {
    const tipo = TIPO_BUTACA_ETIQUETAS[butaca.tipo] ?? butaca.tipo;
    if (this.misSeleccionadas().includes(butaca.id)) {
      return `Fila ${butaca.fila}, butaca ${butaca.numero}, ${tipo}, seleccionada por vos`;
    }
    const estado = this.estadoButaca(butaca.id);
    const textoEstado =
      estado === 'ocupada'
        ? 'vendida'
        : estado === 'reservada'
          ? 'retenida por otro usuario'
          : 'libre';
    return `Fila ${butaca.fila}, butaca ${butaca.numero}, ${tipo}, ${textoEstado}`;
  }

  async toggleButaca(butaca: Butaca): Promise<void> {
    if (this.procesando().includes(butaca.id)) return;

    this.mensajeError.set(null);
    this.procesando.update((p) => [...p, butaca.id]);

    try {
      if (this.misSeleccionadas().includes(butaca.id)) {
        const res = await this.reservasService.liberarButaca(this.funcionId, butaca.id);
        if (!res.ok) {
          this.toast.error(res.error);
        }
        return;
      }

      if (this.misSeleccionadas().length >= this.maxButacas) {
        this.toast.info(`Podés seleccionar hasta ${this.maxButacas} butacas por compra.`);
        return;
      }

      const resultado = await this.reservasService.reservarButaca(this.funcionId, butaca.id);
      if (resultado.estado === 'conflicto') {
        this.toast.error('Esa butaca ya fue tomada por otra persona.');
      } else if (resultado.estado === 'error') {
        this.toast.error(resultado.mensaje);
      }
    } finally {
      this.procesando.update((p) => p.filter((id) => id !== butaca.id));
    }
  }

  continuarCompra(): void {
    if (this.misSeleccionadas().length === 0) return;
    this.continuandoCompra.set(true);
    this.carritoService.establecerSeleccionButacas(this.funcionId, this.misSeleccionadas());
    void this.router.navigate(['/compra/candy'], {
      state: {
        funcionId: this.funcionId,
        butacasIds: this.misSeleccionadas(),
      },
    });
  }

  private detenerCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.detenerCountdown();
    this.reservasService.limpiarSuscripcion();

    if (!this.continuandoCompra() && this.funcionId) {
      void this.reservasService.liberarPropiasDeFuncion(this.funcionId);
    }
  }
}