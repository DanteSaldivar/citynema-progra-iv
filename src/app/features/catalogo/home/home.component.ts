import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoService, PeliculaConGeneros, PeliculaVentas, } from '../catalogo.service';
import { PeliculaCarruselComponent } from './pelicula-carrusel/pelicula-carrusel.component';
import { PeliculaCardComponent } from '../../../shared/ui/pelicula-card/pelicula-card.component';
import { SliderComponent } from '../../../shared/utilidades/slider/slider.component';

@Component({
  imports: [RouterLink, PeliculaCarruselComponent, PeliculaCardComponent, SliderComponent],
  selector: 'app-home.component',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly catalogoService = inject(CatalogoService);

  readonly top3 = signal<PeliculaVentas[]>([]);
  readonly destacadas = signal<PeliculaConGeneros[]>([]);
  readonly enCartelera = signal<PeliculaConGeneros[]>([]);
  readonly proximamente = signal<PeliculaConGeneros[]>([]);

  readonly cargandoTop = signal<boolean>(true);
  readonly cargandoDestacadas = signal<boolean>(true);
  readonly cargandoCartelera = signal<boolean>(true);
  readonly cargandoProximamente = signal<boolean>(true);

  readonly errorGeneral = signal<string | null>(null);

  /** Películas en cartelera excluyendo las que ya están destacadas arriba para no duplicar en home. */
  readonly restoEnCartelera = computed(() => {
    const idsDestacadas = new Set(this.destacadas().map((d) => d.id));
    const filtradas = this.enCartelera().filter((p) => !idsDestacadas.has(p.id));
    return filtradas.length > 0 ? filtradas : this.enCartelera();
  });

  ngOnInit(): void {
    void Promise.all([
      this.cargarTop3(),
      this.cargarDestacadas(),
      this.cargarCartelera(),
      this.cargarProximamente(),
    ]);
  }

  private async cargarTop3(): Promise<void> {
    const res = await this.catalogoService.getTop3Vendidas();
    if (res.ok) {
      this.top3.set(res.data);
    } else {
      this.errorGeneral.set(res.error);
    }
    this.cargandoTop.set(false);
  }

  private async cargarDestacadas(): Promise<void> {
    const res = await this.catalogoService.getPeliculasDestacadas();
    if (res.ok) {
      this.destacadas.set(res.data);
    }
    this.cargandoDestacadas.set(false);
  }

  private async cargarCartelera(): Promise<void> {
    const res = await this.catalogoService.getPeliculasEnCartelera();
    if (res.ok) {
      this.enCartelera.set(res.data);
    }
    this.cargandoCartelera.set(false);
  }

  private async cargarProximamente(): Promise<void> {
    const res = await this.catalogoService.getPeliculasProximamente();
    if (res.ok) {
      this.proximamente.set(res.data);
    }
    this.cargandoProximamente.set(false);
  } 
}