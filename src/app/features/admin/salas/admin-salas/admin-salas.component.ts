import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalaAdminItem, SalasService } from '../salas.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalService } from '../../../../core/services/modal.service';
import { Butaca } from '../../../../core/models/database.types';
import { ModalComponent } from '../../../../shared/utilidades/modal/modal.component';
import { SalaPreviewMapaComponent } from '../sala-preview-mapa/sala-preview-mapa.component';

@Component({
  imports: [ReactiveFormsModule, ModalComponent, SalaPreviewMapaComponent],
  selector: 'app-admin-salas',
  styleUrl: './admin-salas.component.css',
  templateUrl: './admin-salas.component.html',
})
export class AdminSalasComponent implements OnInit {
  
  private readonly salasService = inject(SalasService);
  private readonly toast = inject(ToastService);
  private readonly modal = inject(ModalService);
  private readonly fb = inject(FormBuilder);

  readonly tamanioPagina = 7;
  readonly salas = signal<SalaAdminItem[]>([]);
  readonly pagina = signal<number>(1);
  readonly cargando = signal<boolean>(true);
  readonly creando = signal<boolean>(false);
  readonly errorCarga = signal<string | null>(null);

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.salas().length / this.tamanioPagina))
  );

  readonly salasPaginadas = computed(() => {
    const inicio = (this.pagina() - 1) * this.tamanioPagina;
    return this.salas().slice(inicio, inicio + this.tamanioPagina);
  });

  // Modal vista previa
  readonly salaPreview = signal<SalaAdminItem | null>(null);
  readonly butacasPreview = signal<Butaca[]>([]);
  readonly cargandoPreview = signal<boolean>(false);

  readonly formAlta = this.fb.nonNullable.group({
    numero: [1, [Validators.required, Validators.min(1), Validators.max(99), Validators.pattern(/^\d+$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/.*\S.*/)]],
  });

  ngOnInit(): void {
    void this.cargarSalas();
  }

  async cargarSalas(): Promise<void> {
    this.cargando.set(true);
    this.errorCarga.set(null);

    const res = await this.salasService.listarConConteo();
    if (res.ok) {
      this.salas.set(res.data);
      const maxNum = res.data.reduce((max, s) => Math.max(max, s.numero), 0);
      this.formAlta.patchValue({
        numero: maxNum + 1,
        nombre: `Sala ${maxNum + 1}`,
      });
    } else {
      this.errorCarga.set(res.error);
    }

    this.cargando.set(false);
  }

  async crearSala(): Promise<void> {
    if (this.formAlta.invalid || this.creando()) {
      this.formAlta.markAllAsTouched();
      return;
    }

    this.creando.set(true);
    const { numero, nombre } = this.formAlta.getRawValue();

    const res = await this.salasService.crearConButacas(nombre, Number(numero));
    this.creando.set(false);

    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(
      `Sala "${res.data.nombre}" creada con ${res.data.cantidad_butacas} butacas.`
    );
    await this.cargarSalas();
  }

  async toggleActiva(sala: SalaAdminItem): Promise<void> {
    const nuevoEstado = !sala.activa;

    if (!nuevoEstado) {
      const resFuturas = await this.salasService.contarFuncionesFuturas(sala.id);
      if (!resFuturas.ok) {
        this.toast.error(resFuturas.error);
        return;
      }

      const cant = resFuturas.data;
      const mensaje =
        cant > 0
          ? `La sala "${sala.nombre}" tiene ${cant} función(es) futura(s) programada(s). Si la desactivás dejará de asignarse a nuevas funciones, pero las funciones ya programadas NO se cancelarán automáticamente. ¿Deseás desactivarla igual?`
          : `¿Deseás desactivar la sala "${sala.nombre}"?`;

      const confirmado = await this.modal.confirmar({
        titulo: 'Desactivar sala',
        mensaje,
        textoConfirmar: 'Desactivar',
        peligroso: true,
      });

      if (!confirmado) return;
    }

    const res = await this.salasService.cambiarEstadoActiva(sala.id, nuevoEstado);
    if (!res.ok) {
      this.toast.error(res.error);
      return;
    }

    this.toast.exito(
      nuevoEstado
        ? `Sala "${sala.nombre}" reactivada.`
        : `Sala "${sala.nombre}" desactivada.`
    );
    void this.cargarSalas();
  }

  async abrirVistaPrevia(sala: SalaAdminItem): Promise<void> {
    this.salaPreview.set(sala);
    this.butacasPreview.set([]);
    this.cargandoPreview.set(true);

    const res = await this.salasService.obtenerButacasDeSala(sala.id);
    if (res.ok) {
      this.butacasPreview.set(res.data);
    } else {
      this.toast.error(res.error);
    }
    this.cargandoPreview.set(false);
  }

  cerrarVistaPrevia(): void {
    this.salaPreview.set(null);
    this.butacasPreview.set([]);
  }
}