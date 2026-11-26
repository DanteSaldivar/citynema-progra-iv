import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { PeliculaAdminItem, PeliculasService } from '../peliculas.service';
import { GeneroConConteo, GenerosService } from '../../../../core/services/generos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalService } from '../../../../core/services/modal.service';
import { CLASIFICACION_ETIQUETAS, ESTADO_PELICULA_ETIQUETAS, ESTADOS_PELICULA_OPCIONES } from '../../../../core/models/constantes';
import { EstadoPelicula } from '../../../../core/models/database.types';
import { formatearFecha } from '../../../../core/utils/fechas';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/utilidades/modal/modal.component';
import { AltaPeliculaComponent } from '../alta-pelicula/alta-pelicula.component';

@Component({
  imports: [FormsModule, ModalComponent, AltaPeliculaComponent],
  selector: 'app-admin-peliculas',
  styleUrl: './admin-peliculas.component.css',
  templateUrl: './admin-peliculas.component.html',
})
export class AdminPeliculasComponent implements OnInit {
private readonly peliculasService = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);

  readonly estadosOpciones = ESTADOS_PELICULA_OPCIONES;
  readonly tamanioPagina = 7;
  readonly tamanioPaginaGeneros = 6;

  readonly peliculas = signal<PeliculaAdminItem[]>([]);
  readonly totalRegistros = signal<number>(0);
  readonly pagina = signal<number>(1);
  readonly busqueda = signal<string>('');
  readonly filtroEstado = signal<EstadoPelicula | 'todos'>('todos');
  readonly soloActivas = signal<boolean>(false);

  readonly cargando = signal<boolean>(true);
  readonly errorCarga = signal<string | null>(null);

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalRegistros() / this.tamanioPagina))
  );

  // Modal Película
  readonly modalPeliculaAbierto = signal<boolean>(false);
  readonly peliculaEnEdicion = signal<PeliculaAdminItem | null>(null);

  // Modal Géneros (con paginación sin scroll)
  readonly modalGenerosAbierto = signal<boolean>(false);
  readonly generos = signal<GeneroConConteo[]>([]);
  readonly paginaGeneros = signal<number>(1);
  readonly cargandoGeneros = signal<boolean>(false);
  readonly guardandoGenero = signal<boolean>(false);
  readonly nombreGeneroForm = signal<string>('');
  readonly generoEditandoId = signal<string | null>(null);

  readonly totalPaginasGeneros = computed(() =>
    Math.max(1, Math.ceil(this.generos().length / this.tamanioPaginaGeneros))
  );

  readonly generosPaginados = computed(() => {
    const inicio = (this.paginaGeneros() - 1) * this.tamanioPaginaGeneros;
    return this.generos().slice(inicio, inicio + this.tamanioPaginaGeneros);
  });

  ngOnInit(): void {
    void this.cargarPeliculas();
  }

  async cargarPeliculas(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);

    const res = await this.peliculasService.listarAdmin({
      busqueda: this.busqueda(),
      estado: this.filtroEstado(),
      soloActivas: this.soloActivas(),
      pagina: this.pagina(),
      tamanioPagina: this.tamanioPagina,
    });

    if (res.ok) {
      this.peliculas.set(res.data.items);
      this.totalRegistros.set(res.data.total);
    } else {
      this.errorCarga.set(res.error);
    }

    this.cargando.set(false);
  }

  onBusquedaChange(valor: string): void {
    this.busqueda.set(valor);
    this.pagina.set(1);
    void this.cargarPeliculas();
  }

  onEstadoChange(valor: EstadoPelicula | 'todos'): void {
    this.filtroEstado.set(valor);
    this.pagina.set(1);
    void this.cargarPeliculas();
  }

  onSoloActivasChange(valor: boolean): void {
    this.soloActivas.set(valor);
    this.pagina.set(1);
    void this.cargarPeliculas();
  }

  cambiarPagina(nueva: number): void {
    if (nueva < 1 || nueva > this.totalPaginas()) return;
    this.pagina.set(nueva);
    void this.cargarPeliculas();
  }

  etiquetaClasif(p: PeliculaAdminItem): string {
    return CLASIFICACION_ETIQUETAS[p.clasificacion] ?? p.clasificacion;
  }

  etiquetaEstado(p: PeliculaAdminItem): string {
    return ESTADO_PELICULA_ETIQUETAS[p.estado] ?? p.estado;
  }

  formatearEstreno(fechaYMD: string): string {
    return formatearFecha(fechaYMD);
  }

  abrirNuevaPelicula(): void {
    this.peliculaEnEdicion.set(null);
    this.modalPeliculaAbierto.set(true);
  }

  abrirEditarPelicula(pelicula: PeliculaAdminItem): void {
    this.peliculaEnEdicion.set(pelicula);
    this.modalPeliculaAbierto.set(true);
  }

  cerrarModalPelicula(): void {
    this.modalPeliculaAbierto.set(false);
    this.peliculaEnEdicion.set(null);
  }

  onPeliculaGuardada(): void {
    this.cerrarModalPelicula();
    void this.cargarPeliculas();
  }

  async toggleActiva(pelicula: PeliculaAdminItem): Promise<void> {
    const nuevoEstado = !pelicula.activa;

    if (!nuevoEstado) {
      const resFuturas = await this.peliculasService.contarFuncionesFuturas(pelicula.id);
      if (!resFuturas.ok) {
        this.toast.error(resFuturas.error);
        return;
      }

      const cant = resFuturas.data;
      const mensaje =
        cant > 0
          ? `La película "${pelicula.titulo}" tiene ${cant} función(es) futura(s) programada(s). Si la desactivás dejará de mostrarse en el catálogo público, pero sus funciones existentes NO se cancelarán automáticamente. ¿Deseás desactivarla igual?`
          : `¿Deseás desactivar "${pelicula.titulo}" del catálogo público?`;

      const confirmado = await this.modal.confirmar({
        titulo: 'Desactivar película',
        mensaje,
        textoConfirmar: 'Desactivar',
        peligroso: true,
      });

      if (!confirmado) return;
    }

    const res = await this.peliculasService.cambiarEstadoActiva(pelicula.id, nuevoEstado);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(
      nuevoEstado
        ? `"${pelicula.titulo}" fue reactivada.`
        : `"${pelicula.titulo}" fue desactivada.`
    );
    void this.cargarPeliculas();
  }

  // --- ABM DE GÉNEROS ---

  async abrirGestionGeneros(): Promise<void> {
    this.modalGenerosAbierto.set(true);
    this.paginaGeneros.set(1);
    this.cancelarEdicionGenero();
    await this.cargarGeneros();
  }

  cerrarGestionGeneros(): void {
    this.modalGenerosAbierto.set(false);
  }

  async cargarGeneros(): Promise<void> {
    this.cargandoGeneros.set(true);
    const res = await this.generosService.listarConConteo();
    if (res.ok) {
      this.generos.set(res.data);
      if (this.paginaGeneros() > this.totalPaginasGeneros()) {
        this.paginaGeneros.set(this.totalPaginasGeneros());
      }
    } else {
      this.toast.error(res.error);
    }
    this.cargandoGeneros.set(false);
  }

  cambiarPaginaGeneros(nueva: number): void {
    if (nueva < 1 || nueva > this.totalPaginasGeneros()) return;
    this.paginaGeneros.set(nueva);
  }

  iniciarEdicionGenero(g: GeneroConConteo): void {
    this.generoEditandoId.set(g.id);
    this.nombreGeneroForm.set(g.nombre);
  }

  cancelarEdicionGenero(): void {
    this.generoEditandoId.set(null);
    this.nombreGeneroForm.set('');
  }

  async guardarGenero(event: Event): Promise<void> {
    event.preventDefault();
    const nombre = this.nombreGeneroForm().trim();
    if (!nombre || this.guardandoGenero()) return;

    this.guardandoGenero.set(true);
    const editId = this.generoEditandoId();

    const res = editId
      ? await this.generosService.editar(editId, nombre)
      : await this.generosService.crear(nombre);

    this.guardandoGenero.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(editId ? 'Género actualizado.' : 'Género creado.');
    this.cancelarEdicionGenero();
    await this.cargarGeneros();
    await this.cargarPeliculas();
  }

  async eliminarGenero(g: GeneroConConteo): Promise<void> {
    if (g.cantidad_peliculas > 0) {
      await this.modal.informar({
        titulo: 'No se puede eliminar el género',
        mensaje: `El género "${g.nombre}" está asignado actualmente a ${g.cantidad_peliculas} película(s). Quitáselo primero desde la edición de esas películas antes de eliminarlo.`,
      });
      return;
    }

    const confirmado = await this.modal.confirmar({
      titulo: 'Eliminar género',
      mensaje: `¿Seguro que querés eliminar el género "${g.nombre}"?`,
      textoConfirmar: 'Eliminar',
      peligroso: true,
    });

    if (!confirmado) return;

    const res = await this.generosService.eliminar(g.id);
    if (!res.ok) {
      await this.modal.informar({
        titulo: 'No se pudo eliminar',
        mensaje: res.error,
      });
      return;
    }

    this.toast.exito(`Género "${g.nombre}" eliminado.`);
    await this.cargarGeneros();
  }
}