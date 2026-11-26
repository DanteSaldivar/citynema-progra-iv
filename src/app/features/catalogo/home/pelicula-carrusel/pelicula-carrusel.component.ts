import { Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeliculaVentas } from '../../catalogo.service';
import { ResenasService } from '../../../reseñas/resenas.service';

@Component({
  imports: [RouterLink],
  selector: 'app-pelicula-carrusel',
  styleUrl: './pelicula-carrusel.component.css',
  templateUrl: './pelicula-carrusel.component.html',
})
export class PeliculaCarruselComponent implements OnDestroy {
  private readonly resenasService = inject(ResenasService);

  readonly peliculas = input<PeliculaVentas[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly resenas = signal<{ promedio: number; total: number }>({ promedio: 0, total: 0 });

  readonly peliculaActual = computed<PeliculaVentas | null>(() => {
    const items = this.peliculas();
    if (!items.length) return null;
    const idx = this.currentIndex() % items.length;
    return items[idx] ?? null;
  });

  readonly generosTexto = computed(() => {
    const actual = this.peliculaActual();
    return actual?.generos?.map((g) => g.nombre).join(' • ') ?? '';
  });

  private slideInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const lista = this.peliculas();
      this.limpiarIntervalo();
      if (lista.length > 1) {
        this.slideInterval = setInterval(() => {
          this.currentIndex.update((i) => (i + 1) % lista.length);
        }, 6000);
      }
    });

    effect(() => {
      const actual = this.peliculaActual();
      if (!actual) {
        this.resenas.set({ promedio: 0, total: 0 });
        return;
      }
      void this.cargarResumenResenas(actual.id);
    });
  }

  private async cargarResumenResenas(peliculaId: string): Promise<void> {
    const res = await this.resenasService.obtenerResumen(peliculaId);
    if (res.ok && this.peliculaActual()?.id === peliculaId) {
      this.resenas.set(res.data);
    }
  }

  setSlide(index: number): void {
    this.currentIndex.set(index);
  }

  ngOnDestroy(): void {
    this.limpiarIntervalo();
  }

  private limpiarIntervalo(): void {
    if (this.slideInterval) {
      clearInterval(this.slideInterval);
      this.slideInterval = null;
    }
  }
}