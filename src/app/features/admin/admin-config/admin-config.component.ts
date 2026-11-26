import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { AdminConfigService, Cupon } from '../admin-config.service';

@Component({
  imports: [CommonModule, FormsModule, RouterLink],
  selector: 'app-admin-config',
  styleUrl: './admin-config.component.css',
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent implements OnInit {
  private readonly configService = inject(AdminConfigService);
  private readonly toast = inject(ToastService);

  procesando = signal(false);
  cupones = signal<Cupon[]>([]);

  nuevoCupon: Cupon = {
    codigo: '',
    porcentaje: 20,
    tipo: 'primera_compra',
    edad_minima: null,
    activo: true,
  };

  ngOnInit() {
    void this.cargarDatos();
  }

  async cargarDatos() {
    try {
      const cups = await this.configService.getCupones();
      this.cupones.set(cups);
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al cargar cupones.');
    }
  }

  async crearCupon() {
    this.procesando.set(true);
    try {
      await this.configService.guardarCupon(this.nuevoCupon);
      await this.cargarDatos();
      this.nuevoCupon = {
        codigo: '',
        porcentaje: 20,
        tipo: 'primera_compra',
        edad_minima: null,
        activo: true,
      };
      this.toast.exito('Cupón guardado.');
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error guardando el cupón.');
    } finally {
      this.procesando.set(false);
    }
  }

  async toggleCupon(cupon: Cupon) {
    if (!cupon.id) return;
    try {
      await this.configService.toggleEstadoCupon(cupon.id, cupon.activo);
      await this.cargarDatos();
    } catch (e: unknown) {
      this.toast.error(e instanceof Error ? e.message : 'Error al actualizar el cupón.');
    }
  }
}