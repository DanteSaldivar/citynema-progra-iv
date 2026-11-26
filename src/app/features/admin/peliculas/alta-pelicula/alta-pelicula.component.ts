import { Component, effect, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import {  GuardarPeliculaDTO, PeliculaAdminItem, PeliculasService } from '../peliculas.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FechaHoraSelectComponent } from '../../../../shared/ui/fecha-hora-select/fecha-hora-select.component';
import { GenerosService } from '../../../../core/services/generos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CLASIFICACIONES, CLASIFICACIONES_OPCIONES, ESTADOS_PELICULA, ESTADOS_PELICULA_OPCIONES } from '../../../../core/models/constantes';
import { ClasificacionPelicula, EstadoPelicula, Genero } from '../../../../core/models/database.types';
import { obtenerPartesAR, parsearFechaLocalAR } from '../../../../core/utils/fechas';



@Component({
  imports: [ReactiveFormsModule, FechaHoraSelectComponent],
  selector: 'app-alta-pelicula',
  styleUrl: './alta-pelicula.component.css',
  templateUrl: './alta-pelicula.component.html',
})
export class AltaPeliculaComponent implements OnInit, OnDestroy {
  private readonly peliculasService = inject(PeliculasService);
  private readonly generosService = inject(GenerosService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** Si se recibe una película, el formulario funciona en modo edición; si es null, en modo alta. */
  readonly peliculaEditar = input<PeliculaAdminItem | null>(null);

  readonly cancelar = output<void>();
  readonly peliculaCreada = output<void>();

  readonly clasificacionesOpciones = CLASIFICACIONES_OPCIONES;
  readonly estadosOpciones = ESTADOS_PELICULA_OPCIONES;

  readonly generosDisponibles = signal<Genero[]>([]);
  readonly generosSeleccionados = signal<string[]>([]);
  readonly cargandoGeneros = signal<boolean>(true);

  readonly guardando = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly vistaPrevia = signal<string | null>(null);
  readonly fechaInicialSelector = signal<Date>(new Date());

  archivoSeleccionado: File | null = null;
  private urlObjetoTemporal: string | null = null;

  readonly peliculaForm = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/.*\S.*/)]],
    sinopsis: ['', [Validators.required, Validators.maxLength(3000), Validators.pattern(/.*\S.*/)]],
    duracion_min: [120, [Validators.required, Validators.min(1), Validators.max(600), Validators.pattern(/^\d+$/)]],
    fecha_estreno: ['', Validators.required],
    clasificacion: [CLASIFICACIONES.ATP as ClasificacionPelicula, Validators.required],
    estado: [ESTADOS_PELICULA.PROXIMAMENTE as EstadoPelicula, Validators.required],
    destacada: [false],
    orden_destacada: [1 as number | null, [Validators.min(1), Validators.max(99)]],
    preventa_habilitada: [false],
    preventa_dias: [7, [Validators.min(1), Validators.max(90)]],
    preventa_pct: [10 as number | null, [Validators.min(0), Validators.max(90)]],
  });

  constructor() {
    effect(() => {
      const editando = this.peliculaEditar();
      this.limpiarUrlTemporal();
      this.archivoSeleccionado = null;
      this.errorMensaje.set(null);

      if (editando) {
        const partes = parsearFechaLocalAR(editando.fecha_estreno);
        this.fechaInicialSelector.set(new Date(partes.anio, partes.mes - 1, partes.dia));

        this.peliculaForm.reset({
          titulo: editando.titulo,
          sinopsis: editando.sinopsis,
          duracion_min: editando.duracion_min,
          fecha_estreno: editando.fecha_estreno,
          clasificacion: editando.clasificacion,
          estado: editando.estado,
          destacada: editando.destacada,
          orden_destacada: editando.orden_destacada ?? 1,
          preventa_habilitada: editando.preventa_habilitada,
          preventa_dias: editando.preventa_dias ?? 7,
          preventa_pct: editando.preventa_pct ?? 10,
        });

        this.generosSeleccionados.set(editando.generos.map((g) => g.id));
        this.vistaPrevia.set(editando.poster_url);
      } else {
        const hoy = new Date();
        this.fechaInicialSelector.set(hoy);
        const p = obtenerPartesAR(hoy);
        const hoyYMD = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;

        this.peliculaForm.reset({
          titulo: '',
          sinopsis: '',
          duracion_min: 120,
          fecha_estreno: hoyYMD,
          clasificacion: CLASIFICACIONES.ATP,
          estado: ESTADOS_PELICULA.PROXIMAMENTE,
          destacada: false,
          orden_destacada: 1,
          preventa_habilitada: false,
          preventa_dias: 7,
          preventa_pct: 10,
        });

        this.generosSeleccionados.set([]);
        this.vistaPrevia.set(null);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const res = await this.generosService.listarConConteo();
    if (res.ok) {
      this.generosDisponibles.set(res.data);
    } else {
      this.toast.error(res.error);
    }
    this.cargandoGeneros.set(false);
  }

  toggleGenero(generoId: string): void {
    this.generosSeleccionados.update((actuales) =>
      actuales.includes(generoId)
        ? actuales.filter((id) => id !== generoId)
        : [...actuales, generoId]
    );
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];

    this.errorMensaje.set(null);
    if (!archivo) return;

    const tiposValidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposValidos.includes(archivo.type)) {
      input.value = '';
      this.errorMensaje.set('Formato no válido. Usá JPG, PNG o WebP.');
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      input.value = '';
      this.errorMensaje.set('El póster no puede superar los 5 MB.');
      return;
    }

    this.limpiarUrlTemporal();
    this.archivoSeleccionado = archivo;
    this.urlObjetoTemporal = URL.createObjectURL(archivo);
    this.vistaPrevia.set(this.urlObjetoTemporal);
  }

  private limpiarUrlTemporal(): void {
    if (this.urlObjetoTemporal) {
      URL.revokeObjectURL(this.urlObjetoTemporal);
      this.urlObjetoTemporal = null;
    }
  }

  onFechaCambio(fecha: Date): void {
    const p = obtenerPartesAR(fecha);
    const fechaFormateada = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
    this.peliculaForm.controls.fecha_estreno.setValue(fechaFormateada);
    this.peliculaForm.controls.fecha_estreno.markAsTouched();
  }

  async onSubmit(): Promise<void> {
    this.errorMensaje.set(null);

    if (this.peliculaForm.invalid) {
      this.peliculaForm.markAllAsTouched();
      this.errorMensaje.set('Revisá los campos marcados antes de continuar.');
      return;
    }

    if (this.generosSeleccionados().length === 0) {
      this.errorMensaje.set('Seleccioná al menos un género para la película.');
      return;
    }

    const editando = this.peliculaEditar();
    if (!editando && !this.archivoSeleccionado) {
      this.errorMensaje.set('Tenés que seleccionar el póster de la película.');
      return;
    }

    if (this.guardando()) return;
    this.guardando.set(true);

    try {
      const v = this.peliculaForm.getRawValue();

      const dto: GuardarPeliculaDTO = {
        titulo: v.titulo.trim(),
        sinopsis: v.sinopsis.trim(),
        duracion_min: Number(v.duracion_min),
        fecha_estreno: v.fecha_estreno,
        clasificacion: v.clasificacion,
        estado: v.estado,
        destacada: v.destacada,
        orden_destacada: v.destacada ? Number(v.orden_destacada ?? 1) : null,
        preventa_habilitada: v.preventa_habilitada,
        preventa_dias: v.preventa_habilitada ? Number(v.preventa_dias ?? 7) : 7,
        preventa_pct: v.preventa_habilitada ? Number(v.preventa_pct ?? 0) : null,
        generos_ids: this.generosSeleccionados(),
      };

      const resultado = editando
        ? await this.peliculasService.editar(editando.id, dto, this.archivoSeleccionado)
        : await this.peliculasService.crear(dto, this.archivoSeleccionado!);

      if (!resultado.ok) {
        this.errorMensaje.set(resultado.error);
        this.toast.error(resultado.error);
        return;
      }

      this.toast.exito(
        editando
          ? `Película "${resultado.data.titulo}" actualizada correctamente.`
          : `Película "${resultado.data.titulo}" agregada al catálogo.`
      );
      this.peliculaCreada.emit();
    } finally {
      this.guardando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.limpiarUrlTemporal();
  }
}
