import { Component, inject, OnInit, signal } from '@angular/core';
import { CuentaService } from '../cuenta.service';
import { CommonModule } from '@angular/common';
import { MisPeliculasComponent } from '../mis-peliculas/mis-peliculas.component';
import { Perfil } from '../../../core/models/database.types';
import { AuthService } from '../../../core/auth/auth.service';
import { ModalComponent } from '../../../shared/utilidades/modal/modal.component';

@Component({
  imports: [CommonModule, MisPeliculasComponent, ModalComponent],
  selector: 'app-cuenta-dashboard',
  styleUrl: './cuenta-dashboard.component.css',
  templateUrl: './cuenta-dashboard.component.html',
})
export class CuentaDashboardComponent implements OnInit {

  private cuentaService = inject(CuentaService);
  private auth = inject(AuthService);

  cargando = signal(true);
  procesandoCancelacion = signal(false);

  perfilDatos = signal<{ saldoPuntos: number; saldoCredito: number } | null>(null);
  perfil = signal<Perfil | null>(null);
  historial = signal<any[]>([]);

  mostrarModalCancelacion = false;
  estadoModal = 'confirmacion';
  mensajeModal = '';
  ordenSeleccionada: any = null;


  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    try {
      const [perfil, compras] = await Promise.all([
        this.cuentaService.getDatosPerfil(),
        this.cuentaService.getHistorialCompras()
      ]);
      this.perfilDatos.set(perfil);
      this.historial.set(compras);
      this.perfil.set(this.auth.perfil());
    } catch (e) {
      console.error("Error al cargar la cuenta", e);
    } finally {
      this.cargando.set(false);
    }
  }

  abrirModalCancelacion(orden: any) {
    this.ordenSeleccionada = orden;
    this.estadoModal = 'confirmacion';
    this.mensajeModal = '';
    this.mostrarModalCancelacion = true;
  }

  cerrarModalCancelacion() {
    this.mostrarModalCancelacion = false;
    this.ordenSeleccionada = null;
  }

  async confirmarCancelacion() {
    if (!this.ordenSeleccionada) return;

    const orden = this.ordenSeleccionada;

    this.procesandoCancelacion.set(true);

    try {
      const nuevoCredito = await this.cuentaService.cancelarOrden(orden);

      this.perfilDatos.update(p =>
        p ? { ...p, saldoCredito: nuevoCredito } : null
      );

      this.historial.update(h =>
        h.map(o =>
          o.id === orden.id
            ? { ...o, estado: 'cancelada' }
            : o
        )
      );

      this.cerrarModalCancelacion();

    } catch (e: any) {
      this.mensajeModal = e.message || 'Ocurrió un error al intentar cancelar la compra.';

      this.estadoModal = 'error';

    } finally {
      this.procesandoCancelacion.set(false);
    }
  }

}
