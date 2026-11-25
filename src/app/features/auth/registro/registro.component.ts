import { Component, inject, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { FechaHoraSelectComponent } from '../../../shared/ui/fecha-hora-select/fecha-hora-select.component';

export const fechaNoFuturaValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const valor = control.value;

  if (!valor) return null; // Validators.required se ocupa de los vacíos.

  const fecha = new Date(`${valor}T00:00:00`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return !Number.isNaN(fecha.getTime()) && fecha <= hoy
    ? null
    : { fechaFutura: true };
};

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-registro',
  styleUrl: './registro.component.css',
  templateUrl: './registro.component.html',
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  solicitarLogin = output<void>();
  registroExitoso = output<void>();

  // RF-AUT-01: Formulario con los 7 campos obligatorios
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    fecha_nacimiento: ['', [Validators.required, fechaNoFuturaValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    tipo_sangre: ['', [Validators.required]],
    color_ojos: ['', [Validators.required, Validators.maxLength(40)]],
    dias_vacaciones: [0, [Validators.required, Validators.min(0), Validators.max(365), Validators.pattern(/^\d+$/)]]
  });

  async onSubmit() {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.cargando.set(true);
    this.mensajeError.set(null);

    try {
      await this.auth.registrar(this.form.value as any);
      this.registroExitoso.emit();
      this.router.navigate(['/']);
    } catch (err: any) {
      this.mensajeError.set('Error al registrar el usuario.');
    } finally {
      this.cargando.set(false);
      this.form.reset();
    }
  }

}