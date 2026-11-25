import { Component, inject, OnInit, signal } from '@angular/core';
import { AdminConfigService, Combo, Cupon } from '../admin-config.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-admin-config',
  styleUrl: './admin-config.component.css',
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent implements OnInit {

  private configService = inject(AdminConfigService);

  procesando = signal(false);
  cupones = signal<Cupon[]>([]);
  combos = signal<Combo[]>([]);

  nuevoCupon: Cupon = { codigo: '', porcentaje: 20, tipo: 'primera_compra', edad_minima: null, activo: true };
  nuevoCombo: Combo = { nombre: '', descripcion: '', precio: 0, activo: true };

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    try {
      const [cups, combs] = await Promise.all([
        this.configService.getCupones(),
        this.configService.getCombos()
      ]);
      this.cupones.set(cups);
      this.combos.set(combs);
    } catch (e) {
      console.error(e);
    }
  }

  async crearCupon() {
    this.procesando.set(true);
    try {
      await this.configService.guardarCupon(this.nuevoCupon);
      await this.cargarDatos();
      this.nuevoCupon = { codigo: '', porcentaje: 20, tipo: 'primera_compra', edad_minima: null, activo: true };
    } catch (e: any) {
      alert(e.message);
    } finally {
      this.procesando.set(false);
    }
  }

  async toggleCupon(cupon: Cupon) {
    if (!cupon.id) return;
    try {
      await this.configService.toggleEstadoCupon(cupon.id, cupon.activo);
      await this.cargarDatos();
    } catch (e: any) { alert(e.message); }
  }

  async crearCombo() {
    this.procesando.set(true);
    try {
      await this.configService.guardarCombo(this.nuevoCombo);
      await this.cargarDatos();
      this.nuevoCombo = { nombre: '', descripcion: '', precio: 0, activo: true };
    } catch (e: any) {
      alert(e.message);
    } finally {
      this.procesando.set(false);
    }
  }

  async toggleCombo(combo: Combo) {
    if (!combo.id) return;
    try {
      await this.configService.toggleEstadoCombo(combo.id, combo.activo);
      await this.cargarDatos();
    } catch (e: any) { alert(e.message); }
  }

}
