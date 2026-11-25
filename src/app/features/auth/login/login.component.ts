import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { Router } from '@angular/router';


@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-login',
  styleUrl: './login.component.css',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  cargando = signal<boolean>(false);
  mensajeError = signal<string | null>(null);
  solicitarRegistro = output<void>();
  loginExitoso = output<void>();

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['',[ Validators.required, Validators.minLength(8)]]
  });

  async onSubmit() {
    if (this.form.invalid || this.cargando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);

    try {
      const { email, password } = this.form.value;
      const perfil = await this.auth.iniciarSesion(email!, password!);

      // Redirección inteligente por rol (RF-AUT-03)
      if (perfil.rol === 'admin') {
        this.router.navigate(['/admin']);
      } else if (perfil.rol === 'empleado') {
        this.router.navigate(['/staff']);
      } else {
        this.router.navigate(['/']);
      }
      this.loginExitoso.emit();
    } catch (err: any) {
      this.mensajeError.set('Error al iniciar sesión.');
    } finally {
      this.cargando.set(false);
    }
  }
}
