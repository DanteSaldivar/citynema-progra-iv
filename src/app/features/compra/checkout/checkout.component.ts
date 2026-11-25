import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { CarritoCandy, ComprasService } from '../compras.service';
import { Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Butaca, Pelicula } from '../../../core/models/database.types';
import { ReservasService } from '../reserva.service';
import { FuncionesService } from '../../../core/services/funciones/funciones.service';
import { CuentaService } from '../../cuenta/cuenta.service';

@Component({
  imports: [CommonModule, FormsModule, DatePipe],
  selector: 'app-checkout',
  styleUrl: './checkout.component.css',
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit, OnDestroy {

  private auth = inject(AuthService);
  private comprasService = inject(ComprasService);
  private router = inject(Router);
  private reservaService = inject(ReservasService);
  private funcionesService = inject(FuncionesService);
  private cuentaService = inject(CuentaService);

  emailInvitado = '';
  productosCandy = signal<any[]>([]);
  carritoCandy = signal<CarritoCandy[]>([]);

  procesando = signal(false);
  mensajeError = signal<string | null>(null);

  funcionId: string = '';
  butacasIds: string[] = [];
  butacasSeleccionadas = signal<Butaca[]>([]);
  precioBase = signal<number>(0);
  compraFinalizadaExitosamente = signal<boolean>(false);
  pelicula = signal<any | null>(null);
  funcion = signal<any | null>(null);


  constructor() {
    const state = history.state as {
      funcionId?: string;
      butacasIds?: string[];
    };

    if (state.funcionId && state.butacasIds) {
      this.funcionId = state.funcionId;
      this.butacasIds = state.butacasIds;
    } else {
      // No llegaron los datos necesarios
      this.router.navigate(['/']);
    }
  }

  resumenButacas = computed(() => {
    const butacas = this.butacasSeleccionadas();
    let vipCount = 0;
    let standardCount = 0; 

    const precioEstandar = this.funcion()?.precio_base; 
    const precioVip = precioEstandar * 0.5;

    butacas.forEach(butaca => {

      if (butaca.tipo === 'vip') {
        vipCount++;
      } else {
        standardCount++;
      }
    });

    return {
      vip: { cantidad: vipCount, subtotal: vipCount * precioVip },
      estandar: { cantidad: standardCount, subtotal: standardCount * precioEstandar }
    };
  });

  @HostListener('window:beforeunload')
  alCerrarPestana() {
    if (!this.compraFinalizadaExitosamente) {
      this.reservaService.limpiarMisReservas();
    }
  }

  async ngOnInit() {
    if (!this.funcionId || !this.butacasIds || this.butacasIds.length === 0) {
      this.router.navigate(['/']);
      return;
    }
    this.cargarCandy();
    await this.cargarDatosDeCompraReales();
    this.pelicula.set(await this.funcionesService.getNombrePelicula(this.funcionId));
    this.funcion.set(await this.funcionesService.getFuncion(this.funcionId));
    
  }

  /**
   * Obtiene de la base de datos el precio de la función y los detalles físicos
   * de las butacas (para saber cuáles son VIP y calcular el total).
   */
  async cargarDatosDeCompraReales() {
    this.procesando.set(true);
    try {
      const datos = await this.comprasService.getDatosCheckout(this.funcionId, this.butacasIds);

      this.precioBase.set(datos.precioBase);
      this.butacasSeleccionadas.set(datos.butacas);
    } catch (error: any) {
      this.mensajeError.set(error.message || "Error al cargar los detalles de la compra.");
    } finally {
      this.procesando.set(false);
    }
  }

  async cargarCandy() {
    const prods = await this.comprasService.getProductosCandy();
    this.productosCandy.set(prods);
  }

  agregarCandy(prod: any) {
    const actual = this.carritoCandy();
    const existe = actual.find(c => c.productoId === prod.id);

    if (existe) {
      this.carritoCandy.set(actual.map(c =>
        c.productoId === prod.id ? { ...c, cantidad: c.cantidad + 1 } : c
      ));
    } else {
      this.carritoCandy.set([...actual, {
        productoId: prod.id,
        nombre: prod.nombre,
        cantidad: 1,
        precioUnitario: prod.precio
      }]);
    }
  }

  calcularTotal(): number {
    const subtotalEntradas = this.comprasService.calcularSubtotal(this.precioBase(), this.butacasSeleccionadas());
    const totalCandy = this.carritoCandy().reduce((acc, c) => acc + (c.cantidad * c.precioUnitario), 0);
    return subtotalEntradas + totalCandy;
  }

  async pagar() {
    if (!this.auth.estaAutenticado() && !this.emailInvitado) {
      this.mensajeError.set("Por favor ingresá un email para enviarte las entradas.");
      return;
    }

    this.procesando.set(true);
    this.mensajeError.set(null);

    try {

      const ordenId = await this.comprasService.confirmarCompra({
        funcionId: this.funcionId,
        butacas: this.butacasSeleccionadas(),
        precioBase: this.precioBase(),
        emailInvitado: this.emailInvitado,
        candy: this.carritoCandy(),
        totalPagado: this.calcularTotal()
      });

      // 2. Si todo sale bien (sin colisiones en la BD), redirigimos al PDF
      this.compraFinalizadaExitosamente.set(true);
      this.router.navigate(['/compra/exito', ordenId]);
    } catch (e: any) {
      this.mensajeError.set(e.message);
    } finally {
      this.procesando.set(false);
    }
  }

  ngOnDestroy() {
    const paginaAnterior = this.router.url.includes('compra/asientos');

    if (!this.compraFinalizadaExitosamente() && !paginaAnterior) {
      this.reservaService.limpiarMisReservas();
    }
  }



}
