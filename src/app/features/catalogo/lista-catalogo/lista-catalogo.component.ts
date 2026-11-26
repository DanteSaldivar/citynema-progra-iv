import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoService, PeliculaConGeneros } from '../catalogo.service';
import { CLASIFICACIONES } from '../../../core/models/constantes';
import { ClasificacionPelicula, Genero } from '../../../core/models/database.types';

@Component({
  imports: [RouterLink],
  selector: 'app-lista-catalogo.component',
  styleUrl: './lista-catalogo.component.css',
  templateUrl: './lista-catalogo.component.html',
})
export class ListaCatalogoComponent implements OnInit {
  private readonly catalogoService = inject(CatalogoService);

  readonly generos = signal<Genero[]>([]);
  readonly peliculas = signal<PeliculaConGeneros[]>([]);
  readonly cargando = signal<boolean>(true);
  readonly errorCarga = signal<string | null>(null);

  readonly terminoBusqueda = signal<string>('');
  readonly seleccionados = signal<string[]>([]);

  constructor() {
    effect(() => {
      const termino = this.terminoBusqueda();
      const generosIds = this.seleccionados();

      const timeoutId = setTimeout(() => {
        void this.ejecutarBusqueda(termino, generosIds);
      }, 250);

      return () => clearTimeout(timeoutId);
    });
  }

  ngOnInit(): void {
    void this.cargarGeneros();
  }

  private async cargarGeneros(): Promise<void> {
    const res = await this.catalogoService.getGeneros();
    if (res.ok) {
      this.generos.set(res.data);
    }
  }

  async ejecutarBusqueda(termino: string, generosIds: string[]): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);

    const res = await this.catalogoService.buscarPeliculas(termino, generosIds);
    if (res.ok) {
      this.peliculas.set(res.data);
    } else {
      this.errorCarga.set(res.error);
    }
    this.cargando.set(false);
  }

  toggleGenero(generoId: string): void {
    this.seleccionados.update((actuales) =>
      actuales.includes(generoId)
        ? actuales.filter((id) => id !== generoId)
        : [...actuales, generoId]
    );
  }

  limpiarFiltros(): void {
    this.terminoBusqueda.set('');
    this.seleccionados.set([]);
  }

  etiquetaClasificacion(clasificacion: ClasificacionPelicula): string {
    if (clasificacion === CLASIFICACIONES.ATP) return 'ATP';
    if (clasificacion === CLASIFICACIONES.MAS_13) return '+13';
    if (clasificacion === CLASIFICACIONES.MAS_18) return '+18';
    return String(clasificacion).toUpperCase();
  }
}