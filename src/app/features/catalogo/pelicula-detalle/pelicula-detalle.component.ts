import { CurrencyPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CatalogoService, FuncionCatalogoItem, PeliculaConGeneros, } from '../catalogo.service';
import { ReseniaItem, ResenasService, ResumenResenas, } from '../../reseñas/resenas.service';
import { CLASIFICACIONES, CLASIFICACION_ETIQUETAS, IDIOMA_ETIQUETAS, } from '../../../core/models/constantes';
import { ClasificacionPelicula, IdiomaFuncion, } from '../../../core/models/database.types';
import { ZONA_AR, formatearFecha, obtenerPartesAR, parsearFechaLocalAR, } from '../../../core/utils/fechas';

interface GrupoFuncionesDia {
  fechaYMD: string;
  etiquetaCorta: string;
  etiquetaLarga: string;
  funciones: FuncionCatalogoItem[];
}

const formateadorDiaCortoAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const formateadorDiaLargoAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

@Component({
  imports: [CurrencyPipe, UpperCasePipe],
  selector: 'app-pelicula-detalle.component',
  styleUrl: './pelicula-detalle.component.css',
  templateUrl: './pelicula-detalle.component.html',
})
export class PeliculaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogoService = inject(CatalogoService);
  private readonly resenasService = inject(ResenasService);

  readonly pelicula = signal<PeliculaConGeneros | null>(null);
  readonly cargando = signal<boolean>(true);
  readonly errorCarga = signal<string | null>(null);

  // Reseñas (solo lectura en Bloque 3; alta/edición va en Bloque 8)
  readonly resumenResenas = signal<ResumenResenas>({ promedio: 0, total: 0 });
  readonly listaResenas = signal<ReseniaItem[]>([]);
  readonly totalResenas = signal<number>(0);
  readonly cargandoMasResenas = signal<boolean>(false);
  private readonly limiteResenasPagina = 5;

  // Funciones agrupadas por día en zona America/Argentina/Buenos_Aires
  readonly funcionesAgrupadas = signal<GrupoFuncionesDia[]>([]);
  readonly fechaSeleccionada = signal<string | null>(null);

  readonly etiquetaClasificacion = computed(() => {
    const c = this.pelicula()?.clasificacion;
    if (!c) return 'ATP';
    return CLASIFICACION_ETIQUETAS[c] ?? String(c).toUpperCase();
  });

  readonly requiereAdulto = computed(() => {
    const c = this.pelicula()?.clasificacion;
    return Boolean(c && c !== (CLASIFICACIONES.ATP as ClasificacionPelicula));
  });

  readonly esSoloAdultos = computed(
    () => this.pelicula()?.clasificacion === (CLASIFICACIONES.MAS_18 as ClasificacionPelicula)
  );

  readonly fechaActiva = computed(() => {
    const grupos = this.funcionesAgrupadas();
    const sel = this.fechaSeleccionada();
    return grupos.find((g) => g.fechaYMD === sel)?.fechaYMD ?? grupos[0]?.fechaYMD ?? null;
  });

  readonly funcionesFechaSeleccionada = computed(
    () => this.funcionesAgrupadas().find((g) => g.fechaYMD === this.fechaActiva()) ?? null
  );

  readonly hayMasResenas = computed(() => this.listaResenas().length < this.totalResenas());

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.cargarDatos(id);
    } else {
      this.errorCarga.set('Identificador de película inválido.');
      this.cargando.set(false);
    }
  }

  async cargarDatos(peliculaId: string): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);

    const [resPeli, resResumen, resListaResenas, resFunciones] = await Promise.all([
      this.catalogoService.getPeliculaById(peliculaId),
      this.resenasService.obtenerResumen(peliculaId),
      this.resenasService.listarPorPelicula(peliculaId, 0, this.limiteResenasPagina),
      this.catalogoService.getFuncionesDisponibles(peliculaId),
    ]);

    if (!resPeli.ok) {
      this.errorCarga.set(resPeli.error);
      this.cargando.set(false);
      return;
    }

    this.pelicula.set(resPeli.data);

    if (resResumen.ok) {
      this.resumenResenas.set(resResumen.data);
    }
    if (resListaResenas.ok) {
      this.listaResenas.set(resListaResenas.data.items);
      this.totalResenas.set(resListaResenas.data.total);
    }
    if (resFunciones.ok) {
      this.agruparFuncionesPorDiaAR(resFunciones.data);
    }

    this.cargando.set(false);
  }

  async cargarMasResenas(): Promise<void> {
    const peli = this.pelicula();
    if (!peli || this.cargandoMasResenas() || !this.hayMasResenas()) return;

    this.cargandoMasResenas.set(true);
    const res = await this.resenasService.listarPorPelicula(
      peli.id,
      this.listaResenas().length,
      this.limiteResenasPagina
    );
    if (res.ok) {
      this.listaResenas.update((prev) => [...prev, ...res.data.items]);
      this.totalResenas.set(res.data.total);
    }
    this.cargandoMasResenas.set(false);
  }

  private agruparFuncionesPorDiaAR(funciones: FuncionCatalogoItem[]): void {
    const mapa = new Map<string, FuncionCatalogoItem[]>();

    for (const fn of funciones) {
      const p = obtenerPartesAR(fn.inicio);
      const fechaYMD = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
      const lista = mapa.get(fechaYMD) ?? [];
      lista.push(fn);
      mapa.set(fechaYMD, lista);
    }

    const grupos: GrupoFuncionesDia[] = Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fechaYMD, lista]) => {
        const { anio, mes, dia } = parsearFechaLocalAR(fechaYMD);
        const refMediodia = new Date(Date.UTC(anio, mes - 1, dia, 15, 0, 0));
        return {
          fechaYMD,
          etiquetaCorta: formateadorDiaCortoAR.format(refMediodia),
          etiquetaLarga: formateadorDiaLargoAR.format(refMediodia),
          funciones: lista,
        };
      });

    this.funcionesAgrupadas.set(grupos);
  }

  seleccionarFecha(fechaYMD: string): void {
    this.fechaSeleccionada.set(fechaYMD);
  }

  formatearHorarioAR(iso: string): string {
    const p = obtenerPartesAR(iso);
    return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
  }

  formatearFechaResenia(iso: string): string {
    return formatearFecha(iso);
  }

  etiquetaIdioma(idioma: IdiomaFuncion): string {
    return IDIOMA_ETIQUETAS[idioma] ?? idioma;
  }

  comprar(funcionId: string): void {
    void this.router.navigate(['/compra/asientos', funcionId]);
  } 
}