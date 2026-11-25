import { Component, inject, OnInit, signal } from '@angular/core';
import { CuentaService } from '../cuenta.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SliderComponent } from '../../../shared/utilidades/slider/slider.component';
import { ModalComponent } from '../../../shared/utilidades/modal/modal.component';

@Component({
  imports: [CommonModule, FormsModule, SliderComponent, ModalComponent],
  selector: 'app-mis-peliculas',
  styleUrl: './mis-peliculas.component.css',
  templateUrl: './mis-peliculas.component.html',
})
export class MisPeliculasComponent implements OnInit {

  private cuentaService = inject(CuentaService);

  peliculas = signal<any[]>([]);
  cargando = signal(true);
  guardando = signal<string | null>(null);

  mostrarModalResena = false;
  estadoModalResena: 'exito' | 'error' = 'exito';
  mensajeModalResena = '';

  ngOnInit() {
    this.cargarHistorial();
  }

  async cargarHistorial() {
    try {
      const data = await this.cuentaService.getMisPeliculasVistas();
      this.peliculas.set(data);
    } catch (e) {
      console.error(e);
    } finally {
      this.cargando.set(false);
    }
  }

  seleccionarEstrella(peli: any, puntaje: number) {
    peli.calificacion = puntaje;
    this.peliculas.set([...this.peliculas()]);
  }

  async enviarResena(peli: any) {
    if (!peli.calificacion || this.guardando() !== null) return;

    this.guardando.set(peli.id);

    try {
      await this.cuentaService.guardarResena(
        peli.id,
        peli.calificacion,
        peli.comentario
      );

      this.estadoModalResena = 'exito';
      this.mensajeModalResena = '¡Gracias por compartir tu opinión!';

    } catch (e: any) {
      this.estadoModalResena = 'error';
      this.mensajeModalResena =
        e.message || 'No se pudo guardar tu reseña. Intentá nuevamente.';

    } finally {
      this.guardando.set(null);
      this.mostrarModalResena = true;
    }
  }

  cerrarModalResena() {
    this.mostrarModalResena = false;
  }

}
