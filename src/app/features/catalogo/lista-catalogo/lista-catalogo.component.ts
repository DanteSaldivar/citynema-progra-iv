import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CatalogoService } from '../catalogo.service';
import { Genero, Pelicula } from '../../../core/models/database.types';
import { RouterLink } from '@angular/router';
import { UpperCasePipe } from '@angular/common';

@Component({
  imports: [RouterLink, UpperCasePipe],
  selector: 'app-lista-catalogo.component',
  styleUrl: './lista-catalogo.component.css',
  templateUrl: './lista-catalogo.component.html',
})
export class ListaCatalogoComponent implements OnInit {

  private catalogoService = inject(CatalogoService);

  // Estado reactivo
  generos = signal<Genero[]>([]);
  peliculas = signal<Pelicula[]>([]);
  cargando = signal<boolean>(true);

  // Filtros
  terminoBusqueda = signal<string>('');
  seleccionados = signal<string[]>([]);

  constructor() {
    // Este effect() se dispara automáticamente cada vez que el usuario escribe o tilda un género
    effect(() => {
      const termino = this.terminoBusqueda();
      const generosIds = this.seleccionados();
      
      // Pequeño debounce rudimentario para no saturar Supabase al tipear rápido
      const timeoutId = setTimeout(() => {
        this.ejecutarBusqueda(termino, generosIds);
      }, 300);

      return () => clearTimeout(timeoutId);
    });
  }

  ngOnInit() {
    this.cargarGeneros();
  }

  async cargarGeneros() {
    try {
      const data = await this.catalogoService.getGeneros();
      this.generos.set(data);
    } catch (error) {
      console.error('Error cargando géneros', error);
    }
  }

  async ejecutarBusqueda(termino: string, generosIds: string[]) {
    this.cargando.set(true);
    try {
      const resultados = await this.catalogoService.buscarPeliculas(termino, generosIds);
      this.peliculas.set(resultados);
    } catch (error) {
      console.error('Error en búsqueda', error);
    } finally {
      this.cargando.set(false);
    }
  }

  toggleGenero(generoId: string) {
    const actuales = this.seleccionados();
    if (actuales.includes(generoId)) {
      this.seleccionados.set(actuales.filter(id => id !== generoId));
    } else {
      this.seleccionados.set([...actuales, generoId]);
    }
  }

  limpiarFiltros() {
    this.terminoBusqueda.set('');
    this.seleccionados.set([]);
  }

}
