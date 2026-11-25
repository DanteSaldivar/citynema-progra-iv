import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReservasService } from '../reserva.service';
import { Butaca } from '../../../core/models/database.types';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FuncionesService } from '../../../core/services/funciones/funciones.service';
import { ComprasService } from '../compras.service';

@Component({
  imports: [CommonModule, CurrencyPipe],
  selector: 'app-mapa-butacas',
  styleUrl: './mapa-butacas.component.css',
  templateUrl: './mapa-butacas.component.html',
})
export class MapaButacasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reservasService = inject(ReservasService);
  private funcionesService = inject(FuncionesService);
  private comprasService = inject(ComprasService);

  funcionId!: string;
  salaId!: string;
  pelicula: any;
  cargando = signal<boolean>(true);
  mensajeError = signal<string | null>(null);

  butacasFisicas = signal<Butaca[]>([]);
  precioEntradas = signal<number>(0);

  continuandoCompra = signal<boolean>(false);
  procesando = signal<string[]>([]); /// bloqueo optimista

  misSeleccionadas = computed(() => this.reservasService.misReservasActivas());

  // Computed que reconstruye la grilla de filas (A-T) con sus 3 columnas
  filasAgrupadas = computed(() => {
    const butacas = this.butacasFisicas();
    if (!butacas.length) return [];

    const agrupadas: Record<string, { letra: string, izquierda: Butaca[], centro: Butaca[], derecha: Butaca[] }> = {};

    butacas.forEach(b => {
      if (!agrupadas[b.fila]) agrupadas[b.fila] = { letra: b.fila, izquierda: [], centro: [], derecha: [] };
      if (b.columna === 'izquierda') agrupadas[b.fila].izquierda.push(b);
      if (b.columna === 'centro') agrupadas[b.fila].centro.push(b);
      if (b.columna === 'derecha') agrupadas[b.fila].derecha.push(b);
    });

    // Ordenar letras alfabéticamente
    return Object.values(agrupadas).sort((a, b) => a.letra.localeCompare(b.letra));
  });

  tieneVIP = computed(() => {
    const seleccionadas = this.misSeleccionadas();
    const butacas = this.butacasFisicas();
    return seleccionadas.some(id => {
      const b = butacas.find(x => x.id === id);
      // Las filas VIP definidas por negocio son R, S y T
      return b && ['R', 'S', 'T'].includes(b.fila);
    });
  });

  async actualizarPrecio() {
    const seleccionadas = this.misSeleccionadas();
    if (seleccionadas.length > 0) {
      const datos = await this.comprasService.getDatosCheckout(this.funcionId, seleccionadas);
      this.precioEntradas.set(this.comprasService.calcularSubtotal(datos.precioBase, datos.butacas));
    } else {
      this.precioEntradas.set(0);
    }

  }

  @HostListener('window:beforeunload')
  alCerrarPestana() {
    this.reservasService.limpiarMisReservas();
  }

  async ngOnInit() {
    this.funcionId = this.route.snapshot.paramMap.get('funcionId')!;
    if (this.funcionId) this.cargarMapa();
    this.pelicula = await this.funcionesService.getNombrePelicula(this.funcionId);
  }

  async cargarMapa() {
    try {
      // 1. El servicio se encarga de la lógica de BD
      const datos = await this.funcionesService.getButacasDeFuncion(this.funcionId);

      this.salaId = datos.salaId;
      this.butacasFisicas.set(datos.butacas);

      // 2. Conectar a Realtime
      await this.reservasService.inicializarTiempoReal(this.funcionId);
      // las ya seleccionadas
      if (this.misSeleccionadas().length > 0) {
        this.actualizarPrecio();
      }

    } catch (e: any) {
      this.mensajeError.set(e.message || "Error al cargar el mapa de butacas.");
    } finally {
      this.cargando.set(false);
    }
  }

  estadoButaca(butacaId: string): 'libre' | 'reservada' | 'ocupada' {
    const bloqueada = this.reservasService.butacasBloqueadas().find(b => b.id === butacaId);
    return bloqueada ? bloqueada.estado : 'libre';
  }

  async toggleButaca(butaca: Butaca) {

    if (this.procesando().includes(butaca.id)) return;

    this.mensajeError.set(null);

    this.procesando.update(p => [...p, butaca.id]);

    try {
      if (this.misSeleccionadas().includes(butaca.id)) {
        await this.reservasService.liberarButaca(this.funcionId, butaca.id);
      } else {
        if (this.misSeleccionadas().length >= 8) {
          this.mensajeError.set("Máximo 8 butacas por compra.");
          return;
        }

        const exito = await this.reservasService.reservarButaca(this.funcionId, butaca.id);
        if (!exito) {
          this.mensajeError.set("¡Alguien más acaba de seleccionar esta butaca! Elegí otra.");
        }
      }
      await this.actualizarPrecio();
      this.actualizarPrecio();
    } finally {
      this.procesando.update(p => p.filter(id => id !== butaca.id));
    }

  }

  continuarCompra() {
    // Navegamos al checkout enviando la función y las butacas por estado
    this.continuandoCompra.set(true);
    this.router.navigate(['/compra/checkout'], {
      state: {
        funcionId: this.funcionId,
        butacasIds: this.misSeleccionadas()
      }
    });
  }

  ngOnDestroy() {
    // Si el usuario sale de la página sin comprar, liberamos SUS butacas
    if (!this.continuandoCompra()) {
      this.misSeleccionadas().forEach(id => {
        this.reservasService.liberarButaca(this.funcionId, id);
      });
      this.reservasService.limpiarMisReservas();
    }
  }
}
