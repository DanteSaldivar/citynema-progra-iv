import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { FuncionesService } from '../../../core/services/funciones.service';
import { ToastService } from '../../../core/services/toast.service';
import { CandyCatalogoService } from '../../admin/admin-catalogo.service';
import { CarritoService } from '../carrito.service';
import { ComprasService } from '../compras.service';

@Component({
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe, RouterLink],
  selector: 'app-checkout',
  styleUrl: './checkout.component.css',
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly carrito = inject(CarritoService);
  private readonly comprasService = inject(ComprasService);
  private readonly candyCatalogo = inject(CandyCatalogoService);
  private readonly funcionesService = inject(FuncionesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  emailInvitado = '';
  cargando = signal<boolean>(true);
  procesando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);

  pelicula = signal<any | null>(null);
  funcion = signal<any | null>(null);

  readonly resumenButacas = computed(() => this.carrito.resumenButacasPorTipo());
  readonly desglose = computed(() => this.carrito.desgloseSubtotal());

  constructor() {
    const state = history.state as {
      funcionId?: string;
      butacasIds?: string[];
    };

    if (state?.funcionId && state?.butacasIds?.length) {
      this.carrito.establecerSeleccionButacas(state.funcionId, state.butacasIds);
    }
  }

  async ngOnInit(): Promise<void> {
    this.cargando.set(true);

    // Rehidratar precios reales desde BD (soporta F5 y entrada directa desde mapa o desde /compra/candy)
    const resCatalogo = await this.candyCatalogo.obtenerCatalogoActivo();
    const validacion = await this.carrito.rehidratarYValidarHold(
      resCatalogo.ok ? resCatalogo.data.productos : [],
      resCatalogo.ok ? resCatalogo.data.combos : []
    );

    if (!validacion.ok) {
      this.toast.error(validacion.motivo);
      this.cargando.set(false);
      void this.router.navigate(['/catalogo']);
      return;
    }

    try {
      const fId = this.carrito.funcionId();
      const [peli, func] = await Promise.all([
        this.funcionesService.getNombrePelicula(fId),
        this.funcionesService.getFuncion(fId),
      ]);
      this.pelicula.set(peli);
      this.funcion.set(func);
    } catch (error: unknown) {
      this.mensajeError.set(
        error instanceof Error ? error.message : 'Error al cargar los detalles de la función.'
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async pagar(): Promise<void> {
    if (!this.auth.estaAutenticado() && !this.emailInvitado.trim()) {
      this.mensajeError.set('Por favor ingresá un email para enviarte las entradas.');
      return;
    }

    this.procesando.set(true);
    this.mensajeError.set(null);

    try {
      const ordenId = await this.comprasService.confirmarCompra({
        funcionId: this.carrito.funcionId(),
        butacasIds: this.carrito.butacasIds(),
        emailInvitado: this.emailInvitado,
        itemsCandy: this.carrito.itemsCandy(),
      });

      this.carrito.limpiarTodo();
      await this.router.navigate(['/compra/exito', ordenId]);
    } catch (e: unknown) {
      this.mensajeError.set(
        e instanceof Error ? e.message : 'No se pudo completar la compra.'
      );
    } finally {
      this.procesando.set(false);
    }
  }
}