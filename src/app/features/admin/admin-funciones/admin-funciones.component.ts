import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AdminFuncionesService, FuncionAdminItem, ItemPrevisualizacionRecurrente, sumarDiasCivilYMD } from '../admin-funciones.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/utilidades/modal/modal.component';
import { AltaPeliculaComponent } from '../peliculas/alta-pelicula/alta-pelicula.component';
import { FechaHoraSelectComponent } from '../../../shared/ui/fecha-hora-select/fecha-hora-select.component';
import { FuncionesService } from '../../../core/services/funciones.service';
import { SupabaseService } from '../../../core/supabase.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalService } from '../../../core/services/modal.service';
import { EstadoFuncion, FormatoFuncion, IdiomaFuncion, Pelicula, Sala } from '../../../core/models/database.types';
import { ESTADO_FUNCION_ETIQUETAS, ESTADOS_FUNCION, FORMATOS_FUNCION, FORMATOS_OPCIONES, IDIOMAS_FUNCION, IDIOMAS_OPCIONES, OpcionCatalogo } from '../../../core/models/constantes';
import { ahoraAR, formatearFecha, formatearFechaHora } from '../../../core/utils/fechas';


type PeliculaOpcion = Pick<
  Pelicula,
  'id' | 'titulo' | 'duracion_min' | 'fecha_estreno' | 'estado' | 'activa'
>;

const ESTADOS_FUNCION_FILTRO_OPCIONES: readonly OpcionCatalogo<EstadoFuncion>[] = [
  { valor: 'programada', etiqueta: 'Programada' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
  { valor: 'finalizada', etiqueta: 'Finalizada' },
];

const DIAS_SEMANA_OPCIONES = [
  { valor: 1, corto: 'Lun' },
  { valor: 2, corto: 'Mar' },
  { valor: 3, corto: 'Mié' },
  { valor: 4, corto: 'Jue' },
  { valor: 5, corto: 'Vie' },
  { valor: 6, corto: 'Sáb' },
  { valor: 0, corto: 'Dom' },
] as const;

@Component({
  imports: [CommonModule, FormsModule, ModalComponent, AltaPeliculaComponent, FechaHoraSelectComponent],
  selector: 'app-admin-funciones',
  styleUrl: './admin-funciones.component.css',
  templateUrl: './admin-funciones.component.html',
})
export class AdminFuncionesComponent implements OnInit {
  private readonly funcionesCore = inject(FuncionesService);
  private readonly adminFunciones = inject(AdminFuncionesService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);

  readonly formatosOpciones = FORMATOS_OPCIONES;
  readonly idiomasOpciones = IDIOMAS_OPCIONES;
  readonly estadosFuncionOpciones = ESTADOS_FUNCION_FILTRO_OPCIONES;
  readonly estadosFuncion = ESTADOS_FUNCION;
  readonly diasSemanaOpciones = DIAS_SEMANA_OPCIONES;
  readonly tamanioPagina = 5;

  readonly peliculas = signal<PeliculaOpcion[]>([]);
  readonly todasPeliculas = signal<PeliculaOpcion[]>([]);
  readonly salas = signal<Sala[]>([]);
  readonly margenMin = signal<number>(30);

  // Formulario común
  readonly modoProgramacion = signal<'unica' | 'recurrente'>('unica');
  readonly peliculaId = signal<string>('');
  readonly formato = signal<FormatoFuncion>(FORMATOS_FUNCION.D2);
  readonly idioma = signal<IdiomaFuncion>(IDIOMAS_FUNCION.CASTELLANO);
  readonly precioBase = signal<number>(5000);
  readonly guardando = signal<boolean>(false);
  readonly modalAltaPelicula = signal<boolean>(false);

  // Modo único
  readonly fechaHoraUnica = signal<Date>(new Date(Date.now() + 2 * 60 * 60 * 1000));

  readonly fechaMinimaUnica = computed<Date>(() => {
    const ahora = new Date();
    const sel = this.peliculas().find((p) => p.id === this.peliculaId());
    if (!sel) return ahora;

    const [y, m, d] = sel.fecha_estreno.split('-').map(Number);
    const estrenoLocal = new Date(y, m - 1, d, 0, 0, 0);
    return estrenoLocal.getTime() > ahora.getTime() ? estrenoLocal : ahora;
  });

  // Modo recurrente
  readonly recDesde = signal<string>('');
  readonly recHasta = signal<string>('');
  readonly recHora = signal<string>('18:00');
  readonly recDias = signal<number[]>([1, 2, 5]); // Lun, Mar, Vie
  readonly previsualizando = signal<boolean>(false);
  readonly previewRecurrente = signal<ItemPrevisualizacionRecurrente[]>([]);

  readonly cantidadDisponiblesPreview = computed(
    () => this.previewRecurrente().filter((i) => i.disponible).length
  );
  readonly cantidadOmitidasPreview = computed(
    () => this.previewRecurrente().filter((i) => !i.disponible).length
  );

  // Listado y filtros
  readonly funciones = signal<FuncionAdminItem[]>([]);
  readonly totalFunciones = signal<number>(0);
  readonly pagina = signal<number>(1);
  readonly cargandoLista = signal<boolean>(true);
  readonly errorCarga = signal<string | null>(null);
  readonly filtroFechaYMD = signal<string>('');
  readonly filtroPeliculaId = signal<string>('');
  readonly filtroSalaId = signal<string>('');
  readonly filtroEstado = signal<EstadoFuncion | 'todos'>('todos');

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalFunciones() / this.tamanioPagina))
  );

  // Edición de precio
  readonly editandoPrecioId = signal<string | null>(null);
  readonly precioEditValor = signal<number>(0);

  async ngOnInit(): Promise<void> {
    const hoyYMD = ahoraAR().fechaISO;
    this.recDesde.set(hoyYMD);
    this.recHasta.set(sumarDiasCivilYMD(hoyYMD, 13));

    await Promise.all([
      this.cargarCatalogos(),
      this.cargarFunciones(),
      this.cargarMargen(),
    ]);
  }

  private async cargarMargen(): Promise<void> {
    const m = await this.funcionesCore.obtenerMargenMinutos();
    this.margenMin.set(m);
  }

  async cargarCatalogos(): Promise<void> {
    try {
      const [pelisActivas, pelisTodas, salas] = await Promise.all([
        this.adminFunciones.obtenerPeliculasActivas(),
        this.adminFunciones.obtenerTodasLasPeliculas(),
        this.adminFunciones.obtenerSalasActivas(),
      ]);
      this.peliculas.set(pelisActivas);
      this.todasPeliculas.set(pelisTodas);
      this.salas.set(salas);
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Error al cargar catálogos.');
    }
  }

  async cargarFunciones(): Promise<void> {
    this.cargandoLista.set(true);
    this.errorCarga.set(null);

    const res = await this.adminFunciones.listarAdmin({
      fechaYMD: this.filtroFechaYMD() || undefined,
      peliculaId: this.filtroPeliculaId() || undefined,
      salaId: this.filtroSalaId() || undefined,
      estado: this.filtroEstado(),
      pagina: this.pagina(),
      tamanioPagina: this.tamanioPagina,
    });

    if (res.ok) {
      this.funciones.set(res.data.items);
      this.totalFunciones.set(res.data.total);
    } else {
      this.errorCarga.set(res.error);
    }
    this.cargandoLista.set(false);
  }

  onPeliculaChange(id: string): void {
    this.peliculaId.set(id);
    this.previewRecurrente.set([]);

    const peli = this.peliculas().find((p) => p.id === id);
    if (peli) {
      const hoyYMD = ahoraAR().fechaISO;
      const baseDesde = peli.fecha_estreno > hoyYMD ? peli.fecha_estreno : hoyYMD;
      this.recDesde.set(baseDesde);
      this.recHasta.set(sumarDiasCivilYMD(baseDesde, 13));
    }
  }

  async crearFuncionUnica(): Promise<void> {
    if (!this.peliculaId() || this.guardando()) return;

    this.guardando.set(true);
    try {
      const { data: userData, error: userErr } = await this.supabaseService.client.auth.getUser();
      if (userErr || !userData.user) {
        this.toast.error('No se pudo identificar al usuario autenticado.');
        return;
      }

      const creada = await this.funcionesCore.crearFuncionAutomatica({
        peliculaId: this.peliculaId(),
        inicio: this.fechaHoraUnica(),
        formato: this.formato(),
        idioma: this.idioma(),
        precioBase: Number(this.precioBase()),
        userId: userData.user.id,
      });

      const sala = this.salas().find((s) => s.id === creada.sala_id);
      this.toast.exito(
        `Función programada en ${sala ? sala.nombre : 'sala asignada'} correctamente.`
      );
      this.pagina.set(1);
      await this.cargarFunciones();
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Error al programar la función.');
    } finally {
      this.guardando.set(false);
    }
  }

  toggleDiaSemana(dia: number): void {
    this.previewRecurrente.set([]);
    this.recDias.update((actuales) =>
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia]
    );
  }

  onRecParamChange(campo: 'desde' | 'hasta' | 'hora', valor: string): void {
    this.previewRecurrente.set([]);
    if (campo === 'desde') this.recDesde.set(valor);
    else if (campo === 'hasta') this.recHasta.set(valor);
    else this.recHora.set(valor);
  }

  async generarVistaPreviaRecurrente(): Promise<void> {
    if (!this.peliculaId() || this.previsualizando()) return;

    this.previsualizando.set(true);
    const res = await this.adminFunciones.previsualizarProgramacionRecurrente({
      peliculaId: this.peliculaId(),
      fechaDesdeYMD: this.recDesde(),
      fechaHastaYMD: this.recHasta(),
      diasSemana: this.recDias(),
      horaHHMM: this.recHora(),
    });
    this.previsualizando.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      this.previewRecurrente.set([]);
      return;
    }

    this.previewRecurrente.set(res.data);
  }

  async confirmarRecurrente(): Promise<void> {
    if (!this.peliculaId() || this.guardando()) return;

    this.guardando.set(true);
    try {
      const { data: userData, error: userErr } = await this.supabaseService.client.auth.getUser();
      if (userErr || !userData.user) {
        this.toast.error('No se pudo identificar al usuario autenticado.');
        return;
      }

      const res = await this.adminFunciones.crearProgramacionRecurrente({
        peliculaId: this.peliculaId(),
        fechaDesdeYMD: this.recDesde(),
        fechaHastaYMD: this.recHasta(),
        diasSemana: this.recDias(),
        horaHHMM: this.recHora(),
        formato: this.formato(),
        idioma: this.idioma(),
        precioBase: Number(this.precioBase()),
        userId: userData.user.id,
      });

      if (!res.ok) {
        this.toast.error(res.error);
        return;
      }

      this.toast.exito(
        `Resumen: ${res.data.creadas.length} creada(s), ${res.data.omitidas.length} rechazada(s).`
      );
      this.previewRecurrente.set([]);
      this.pagina.set(1);
      await this.cargarFunciones();
    } finally {
      this.guardando.set(false);
    }
  }

  onFiltroChange(tipo: 'fecha' | 'pelicula' | 'sala' | 'estado', valor: string): void {
    if (tipo === 'fecha') this.filtroFechaYMD.set(valor);
    else if (tipo === 'pelicula') this.filtroPeliculaId.set(valor);
    else if (tipo === 'sala') this.filtroSalaId.set(valor);
    else this.filtroEstado.set(valor as EstadoFuncion | 'todos');

    this.pagina.set(1);
    void this.cargarFunciones();
  }

  cambiarPagina(nueva: number): void {
    if (nueva < 1 || nueva > this.totalPaginas()) return;
    this.pagina.set(nueva);
    void this.cargarFunciones();
  }

  iniciarEdicionPrecio(f: FuncionAdminItem): void {
    this.editandoPrecioId.set(f.id);
    this.precioEditValor.set(f.precio_base);
  }

  async guardarPrecio(f: FuncionAdminItem): Promise<void> {
    const res = await this.adminFunciones.actualizarPrecioBase(
      f.id,
      Number(this.precioEditValor())
    );
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito('Precio actualizado y auditado.');
    this.editandoPrecioId.set(null);
    await this.cargarFunciones();
  }

  async cancelarFuncion(f: FuncionAdminItem): Promise<void> {
    const confirmado = await this.modal.confirmar({
      titulo: 'Desactivar función',
      mensaje: `¿Seguro que querés desactivar la función de "${f.pelicula_titulo}" en ${f.sala_nombre} (${formatearFechaHora(f.inicio)})?`,
      textoConfirmar: 'Desactivar función',
      peligroso: true,
    });

    if (!confirmado) return;

    const res = await this.adminFunciones.cancelarFuncionSiSinEntradas(f.id);
    if (!res.ok) {
      await this.modal.informar({
        titulo: 'No se puede desactivar la función',
        mensaje: res.error,
      });
      return;
    }

    this.toast.exito('Función desactivada correctamente.');
    await this.cargarFunciones();
  }

  async onPeliculaCreadaDesdeModal(): Promise<void> {
    this.modalAltaPelicula.set(false);
    await this.cargarCatalogos();
  }

  formatearEstreno(fechaYMD: string): string {
    return formatearFecha(fechaYMD);
  }

  formatearInicio(iso: string): string {
    return formatearFechaHora(iso);
  }

  etiquetaEstado(estado: EstadoFuncion): string {
    return ESTADO_FUNCION_ETIQUETAS[estado] ?? estado;
  }
}
