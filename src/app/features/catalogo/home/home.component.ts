import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { CatalogoService, PeliculaVentas } from '../catalogo.service';
import { Pelicula } from '../../../core/models/database.types';
import { PeliculaCarruselComponent } from './pelicula-carrusel/pelicula-carrusel.component';
import { PeliculaCardComponent } from '../../../shared/ui/pelicula-card/pelicula-card.component';
import { SliderComponent } from '../../../shared/utilidades/slider/slider.component';

@Component({
  imports: [PeliculaCarruselComponent, PeliculaCardComponent, SliderComponent],
  selector: 'app-home.component',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {

  private catalogoService = inject(CatalogoService);

  top3 = signal<PeliculaVentas[]>([]);
  destacadas = signal<Pelicula[]>([]);
  proximamente = signal<Pelicula[]>([]);
  
  cargandoTop = signal<boolean>(true);
  cargandoDestacadas = signal<boolean>(true);
  cargandoProximamente = signal<boolean>(true);

  destacadasRow = viewChild<ElementRef<HTMLDivElement>>('destacadasRow');

  ngOnInit() {
    this.cargarTop3();
    this.cargarDestacadas()
    this.cargarPreventa();
  }

  async cargarTop3() {
    try {
      const data = await this.catalogoService.getTop3Vendidas();
      this.top3.set(data);
    } catch (error) {
      console.error('Error al cargar top 3:', error);
    } finally {
      this.cargandoTop.set(false);
    }
  }

  async cargarDestacadas() {
    try {
      const data = await this.catalogoService.getPeliculasDestacadas();
      this.destacadas.set(data);
    } catch (error) {
      console.error('Error al cargar destacadas:', error);
    } finally {
      this.cargandoDestacadas.set(false);
    }
  }

  async cargarPreventa(){
    try {
      const data = await this.catalogoService.getPeliculasPreventa();
      this.proximamente.set(data);
      console.log(data);
      
    } catch (error) {
      console.error('Error al cargar preventa:', error);
    } finally {
      this.cargandoProximamente.set(false);
    }
  }

  deslizarDestacadas(direccion: 'izquierda' | 'derecha') {
  const row = this.destacadasRow()?.nativeElement;

  if (!row) return;

  const desplazamiento = row.clientWidth * 0.8;

  row.scrollBy({
    left: direccion === 'derecha'
      ? desplazamiento
      : -desplazamiento,
    behavior: 'smooth'
  });
}
}
