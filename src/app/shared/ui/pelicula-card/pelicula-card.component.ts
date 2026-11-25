import { CommonModule } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogoService } from '../../../features/catalogo/catalogo.service';

@Component({
  imports: [CommonModule],
  selector: 'app-pelicula-card',
  styleUrl: './pelicula-card.component.css',
  templateUrl: './pelicula-card.component.html',
})
export class PeliculaCardComponent implements OnInit {

  private router = inject(Router);
  private catalogoService = inject(CatalogoService);

  pelicula = input<any>();
  resenas = signal<{ promedio: number, total: number }>({ promedio: 0, total: 0 });
  comprarEntradas() {
    this.router.navigate(['/pelicula', this.pelicula()?.id]);
  }

  async ngOnInit() {
    this.resenas.set( await this.catalogoService.getResumenResenas(this.pelicula().id));
  }

}
