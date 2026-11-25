import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogoService } from '../catalogo.service';
import { Pelicula } from '../../../core/models/database.types';

@Component({
  imports: [CommonModule],
  selector: 'app-pelicula-detalle.component',
  styleUrl: './pelicula-detalle.component.css',
  templateUrl: './pelicula-detalle.component.html',
})
export class PeliculaDetalleComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private catalogoService = inject(CatalogoService);

  pelicula = signal<Pelicula | null>(null);
  cargando = signal<boolean>(true);
  resenas = signal<{ promedio: number, total: number }>({ promedio: 0, total: 0 });

  // Array agrupado por día para iterar fácilmente en el HTML
  funcionesAgrupadas = signal<{ fecha: string, funciones: any[] }[]>([]);
  fechaSeleccionada = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarDatos(id);
    }

  }
  fechaActiva = computed(() => {
  const grupos = this.funcionesAgrupadas();
  const seleccionada = this.fechaSeleccionada();
  
  return grupos.find(g => g.fecha === seleccionada)?.fecha
    ?? grupos[0]?.fecha
    ?? null;
  });

  funcionesFechaSeleccionada = computed(() => {
  const fecha = this.fechaActiva();

  return this.funcionesAgrupadas()
    .find(g => g.fecha === fecha)
    ?? null;
});


  async cargarDatos(id: string) {
    this.cargando.set(true);
    try {
      // Cargamos en paralelo para mayor velocidad
      const [peliculaData, resenasData, funcionesData] = await Promise.all([
        this.catalogoService.getPeliculaById(id),
        this.catalogoService.getResumenResenas(id),
        this.catalogoService.getFuncionesDisponibles(id)
      ]);

      this.pelicula.set(peliculaData);
      this.resenas.set(resenasData);
      this.agruparFuncionesPorDia(funcionesData || []);
    } catch (error) {
      console.error('Error cargando la ficha', error);
    } finally {
      this.cargando.set(false);
    }
  }

  private agruparFuncionesPorDia(funciones: any[]) {
    const agrupado = funciones.reduce((acc: any, funcion: any) => {
      // Extraemos solo la fecha (YYYY-MM-DD)
      const fecha = new Date(funcion.inicio).toISOString().split('T')[0];
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(funcion);
      return acc;
    }, {});

    // Convertimos el objeto en array y ordenamos por fecha
    const arrayAgrupado = Object.keys(agrupado).map(fecha => ({
      fecha,
      funciones: agrupado[fecha]
    })).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    this.funcionesAgrupadas.set(arrayAgrupado);
  }

  comprar(funcionId: string) {
    // Navegación al mapa de butacas
    this.router.navigate(['/compra/asientos', funcionId]);
  }

  seleccionarFecha(fecha: string) {
    this.fechaSeleccionada.set(fecha);
  }

}
