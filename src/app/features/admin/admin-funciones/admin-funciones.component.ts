import { Component, inject, OnInit, signal } from '@angular/core';
import { AdminFuncionesService } from '../admin-funciones.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/utilidades/modal/modal.component';
import { AltaPeliculaComponent } from '../peliculas/alta-pelicula/alta-pelicula.component';
import { FechaHoraSelectComponent } from '../../../shared/ui/fecha-hora-select/fecha-hora-select.component';

@Component({
  imports: [CommonModule, FormsModule, ModalComponent, AltaPeliculaComponent, FechaHoraSelectComponent],
  selector: 'app-admin-funciones',
  styleUrl: './admin-funciones.component.css',
  templateUrl: './admin-funciones.component.html',
})
export class AdminFuncionesComponent implements OnInit {

  private funcionesService = inject(AdminFuncionesService);

  peliculas = signal<any[]>([]);
  procesando = signal(false);
  mensajeError = signal<string | null>(null);
  resultadoExito = signal<string | null>(null);
  fechaMinima = new Date();

  readonly mostrarAltaPelicula = signal(false);

  abrirAltaPelicula(): void {
    this.mostrarAltaPelicula.set(true);
  }

  cerrarAltaPelicula(): void {
    this.mostrarAltaPelicula.set(false);
  }

  alCrearPelicula(): void {
    this.cerrarAltaPelicula();
    this.cargarPeliculas()
  }

  formulario: {
    peliculaId: string;
    fechaHora: string | Date;
    precioBase: number;
    formato: string;
    idioma: string;
  } = {
    peliculaId: '',
    fechaHora: '',
    precioBase: 5000,
    formato: '2D',
    idioma: 'Castellano'
  };

  ngOnInit() {
    this.cargarPeliculas();
  }

  async cargarPeliculas() {
    try {
      const data = await this.funcionesService.getPeliculasActivas();
      this.peliculas.set(data);
    } catch (e) {
      console.error(e);
    }
  }

  async crearFuncion() {
    this.procesando.set(true);
    this.mensajeError.set(null);
    this.resultadoExito.set(null);

    try {
      const peliculaSeleccionada = this.peliculas().find(p => p.id === this.formulario.peliculaId);
      if (!peliculaSeleccionada) throw new Error("Película inválida");

      const fechaInicio = new Date(this.formulario.fechaHora);

      const resultado = await this.funcionesService.programarFuncion(
        this.formulario.peliculaId,
        peliculaSeleccionada.duracion_min,
        fechaInicio,
        this.formulario.formato,
        this.formulario.idioma,
        this.formulario.precioBase
      );

      this.resultadoExito.set(resultado.sala.nombre);

      // Limpiar formulario parcialmente
      this.formulario.fechaHora = '';

    } catch (e: any) {
      this.mensajeError.set(e.message);
    } finally {
      this.procesando.set(false);
    }
  }

  onFechaHoraCambio(fecha: Date): void {
    this.formulario.fechaHora = fecha;
}

}
