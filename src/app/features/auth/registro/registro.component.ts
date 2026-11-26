import { Component, inject, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators, } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegistroDTO } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TIPOS_SANGRE } from '../../../core/models/constantes';
import { ahoraAR, obtenerPartesAR } from '../../../core/utils/fechas';
import { FechaHoraSelectComponent } from '../../../shared/ui/fecha-hora-select/fecha-hora-select.component';

export const fechaNoFuturaValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const valor = control.value as string;
  if (!valor) return null;

  const { fechaISO } = ahoraAR();
  return valor <= fechaISO ? null : { fechaFutura: true };
};

@Component({
  imports: [ReactiveFormsModule, FechaHoraSelectComponent],
  selector: 'app-registro',
  styleUrl: './registro.component.css',
  templateUrl: './registro.component.html',
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly tiposSangre = TIPOS_SANGRE;
  readonly fechaMinNacimiento = new Date(1905, 0, 1);
  readonly fechaMaxNacimiento = new Date();
  readonly fechaInicialNacimiento = new Date(2000, 0, 1);

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  solicitarLogin = output<void>();
  registroExitoso = output<void>();

  // RF-AUT-01: Formulario con los 7 campos obligatorios + contraseña
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    fecha_nacimiento: ['2000-01-01', [Validators.required, fechaNoFuturaValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    tipo_sangre: ['', [Validators.required]],
    color_ojos: ['', [Validators.required, Validators.maxLength(40)]],
    dias_vacaciones: [
      14,
      [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)],
    ],
  });

  onFechaNacimientoCambio(fecha: Date): void {
    const p = obtenerPartesAR(fecha);
    const ymd = `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
    const ctrl = this.form.controls.fecha_nacimiento;
    ctrl.setValue(ymd);
    ctrl.markAsTouched();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    try {
      const resultado = await this.auth.registrar(this.form.value as unknown as RegistroDTO);

      if (!resultado.ok) {
        // Si falla: NO limpiar el formulario; mostrar el error traducido en alerta + toast
        this.mensajeError.set(resultado.error);
        this.toast.error(resultado.error);
        return;
      }

      // Si funciona: aviso claro de éxito antes de redirigir
      this.toast.exito(`¡Bienvenido/a, ${resultado.data.nombre}! Tu cuenta fue creada.`);
      this.registroExitoso.emit();
      await this.router.navigate(['/']);
    } finally {
      this.cargando.set(false);
    }
  }
}