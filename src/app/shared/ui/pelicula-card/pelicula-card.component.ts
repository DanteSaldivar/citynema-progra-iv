import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CLASIFICACIONES } from '../../../core/models/constantes';
import { ClasificacionPelicula } from '../../../core/models/database.types';
import { PeliculaConGeneros } from '../../../features/catalogo/catalogo.service';
import { ResenasService } from '../../../features/reseñas/resenas.service';

@Component({
  imports: [],
  selector: 'app-pelicula-card',
  styleUrl: './pelicula-card.component.css',
  templateUrl: './pelicula-card.component.html',
})
export class PeliculaCardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly resenasService = inject(ResenasService);

  readonly pelicula = input.required<PeliculaConGeneros>();
  readonly resenas = signal<{ promedio: number; total: number }>({ promedio: 0, total: 0 });

  readonly etiquetaClasificacion = computed(() => {
    const c = this.pelicula().clasificacion;
    if (c === CLASIFICACIONES.ATP) return 'ATP';
    if (c === CLASIFICACIONES.MAS_13) return '+13';
    if (c === CLASIFICACIONES.MAS_18) return '+18';
    return String(c).toUpperCase();
  });

  readonly esSoloAdultos = computed(
    () => this.pelicula().clasificacion === (CLASIFICACIONES.MAS_18 as ClasificacionPelicula)
  );

  async ngOnInit(): Promise<void> {
    const res = await this.resenasService.obtenerResumen(this.pelicula().id);
    if (res.ok) {
      this.resenas.set(res.data);
    }
  }

  comprarEntradas(): void {
    void this.router.navigate(['/pelicula', this.pelicula().id]);
  }
}