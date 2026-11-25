import { Component, inject, OnDestroy, output, signal } from '@angular/core';
import { CrearPeliculaDTO, PeliculasService } from '../peliculas.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FechaHoraSelectComponent } from '../../../../shared/ui/fecha-hora-select/fecha-hora-select.component';


type Clasificacion = 'atp' | '13' | '18';
type EstadoPelicula = 'en_cartelera' | 'proximamente' | 'finalizado';

@Component({
  imports: [ReactiveFormsModule, FechaHoraSelectComponent],
  selector: 'app-alta-pelicula',
  styleUrl: './alta-pelicula.component.css',
  templateUrl: './alta-pelicula.component.html',
})
export class AltaPeliculaComponent {

  private readonly peliculasService = inject(PeliculasService);
  private readonly fb = inject(FormBuilder);
  private readonly ahora = new Date();

  readonly cancelar = output<void>();
  readonly peliculaCreada = output<void>();

  readonly guardando = signal(false);
  readonly errorMensaje = signal<string | null>(null);
  readonly exitoMensaje = signal<string | null>(null);
  readonly vistaPrevia = signal<string | null>(null);

  archivoSeleccionado: File | null = null;

  readonly peliculaForm = this.fb.nonNullable.group({
    titulo: ['', [Validators.required,Validators.maxLength(150),Validators.pattern(/.*\S.*/)]],
    sinopsis: ['', [Validators.required,Validators.maxLength(3000),Validators.pattern(/.*\S.*/)]],
    duracion_min: [120, [Validators.required,Validators.min(1),Validators.pattern(/^\d+$/) ]],
    fecha_estreno: ['', Validators.required],
    clasificacion: ['atp' as Clasificacion, Validators.required],
    estado: ['proximamente' as EstadoPelicula, Validators.required]
  });

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];

    this.errorMensaje.set(null);
    this.exitoMensaje.set(null);

    if (!archivo) return;

    const tiposValidos = ['image/jpeg', 'image/png', 'image/webp'];

    if (!tiposValidos.includes(archivo.type)) {
      this.limpiarArchivo();
      input.value = '';
      this.errorMensaje.set('Formato no válido. Usá JPG, PNG o WebP.');
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      this.limpiarArchivo();
      input.value = '';
      this.errorMensaje.set('El póster no puede superar los 5 MB.');
      return;
    }

    this.limpiarArchivo();
    this.archivoSeleccionado = archivo;
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  limpiarArchivo(): void {
    const previa = this.vistaPrevia();

    if (previa) {
      URL.revokeObjectURL(previa);
    }

    this.archivoSeleccionado = null;
    this.vistaPrevia.set(null);
  }

  async onSubmit(): Promise<void> {
    this.errorMensaje.set(null);
    this.exitoMensaje.set(null);

    if (this.peliculaForm.invalid) {
      this.peliculaForm.markAllAsTouched();
      this.errorMensaje.set('Revisá los campos marcados antes de continuar.');
      return;
    }

    if (!this.archivoSeleccionado) {
      this.errorMensaje.set('Tenés que seleccionar el póster de la película.');
      return;
    }

    if (this.guardando()) return;

    this.guardando.set(true);

    try {
      const valores = this.peliculaForm.getRawValue();

      const dto: CrearPeliculaDTO = {
        titulo: valores.titulo.trim(),
        sinopsis: valores.sinopsis.trim(),
        duracion_min: valores.duracion_min,
        fecha_estreno: valores.fecha_estreno,
        clasificacion: valores.clasificacion,
        estado: valores.estado
      };

      await this.peliculasService.crear(dto, this.archivoSeleccionado);

      this.exitoMensaje.set('¡Película agregada al catálogo con éxito!');
      this.peliculaCreada.emit();

    } catch (error: unknown) {
      console.error('Error al guardar la película:', error);

      this.errorMensaje.set(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error inesperado al guardar la película.'
      );
    } finally {
      this.guardando.set(false);
    }
  }

  ngOnDestroy(): void {
    this.limpiarArchivo();
  }

  ///SELECTOR FECHA PERSO

  onFechaCambio(fecha: Date): void {
  const fechaFormateada = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');

  this.peliculaForm.controls.fecha_estreno.setValue(fechaFormateada);
  this.peliculaForm.controls.fecha_estreno.markAsTouched();
}

}
