import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoService } from '../../catalogo.service';

@Component({
  imports: [CommonModule, RouterLink],
  selector: 'app-pelicula-carrusel',
  styleUrl: './pelicula-carrusel.component.css',
  templateUrl: './pelicula-carrusel.component.html',
})
export class PeliculaCarruselComponent implements OnInit, OnDestroy {


   private catalogoService = inject(CatalogoService);
   resenas = signal<{ promedio: number, total: number }>({ promedio: 0, total: 0 });

  peliculas = input<any[]>([]);

  currentIndex = signal<number>(0);

  // Computed properties
  peliculaActual = computed(() => {
    const items = this.peliculas();
    return items.length > 0 ? items[this.currentIndex()] : null;
  });

  private slideInterval: any;

  async ngOnInit() {
    if (this.peliculas().length > 0) {
      this.iniciarAutoplay();
    }
    this.resenas.set( await this.catalogoService.getResumenResenas(this.peliculaActual().id));
  }

  ngOnDestroy() {
    this.limpiarIntervalo();
  }

  setSlide(index: number) {
    this.currentIndex.set(index);
    this.limpiarIntervalo();
    this.iniciarAutoplay();
  }

  private siguienteSlide() {
    const total = this.peliculas().length;
    if (total > 0) {
      this.currentIndex.update(i => (i + 1) % total);
    }
  }

  private iniciarAutoplay() {
    this.slideInterval = setInterval(() => {
      this.siguienteSlide();
    }, 6000);
  }

  private limpiarIntervalo() {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
    }
  }

}
