import { SlicePipe } from '@angular/common';
import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ClavePermisoAdmin } from '../../../core/auth/permisos';
import { LoginComponent } from '../../../features/auth/login/login.component';
import { RegistroComponent } from '../../../features/auth/registro/registro.component';
import { CuentaService } from '../../../features/cuenta/cuenta.service';
import { ModalComponent } from '../../utilidades/modal/modal.component';
import { NotificacionesCampanaComponent } from '../notificaciones-campana/notificaciones-campana.component';

const RUTAS_ADMIN_HABILITADAS: readonly ClavePermisoAdmin[] = [
  'reportes',
  'peliculas',
  'salas',
  'funciones',
  'productos',
  'config',
];

@Component({
  imports: [
    RouterLink,
    RouterLinkActive,
    SlicePipe,
    ModalComponent,
    LoginComponent,
    RegistroComponent,
    NotificacionesCampanaComponent,
  ],
  selector: 'app-navbar',
  styleUrl: './navbar.component.css',
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly cuentaService = inject(CuentaService);
  private readonly router = inject(Router);

  saldos = signal({ saldoPuntos: 0, saldoCredito: 0 });
  modalActivo = signal<'login' | 'register' | null>(null);
  mostrarMenu = signal<boolean>(false);
  mostrarMenuAdmin = signal<boolean>(false);

  readonly userEmail = computed(() => this.auth.perfil()?.email ?? '');
  readonly userInitials = computed(() => {
    const email = this.userEmail();
    return email ? email.substring(0, 2).toUpperCase() : 'U';
  });

  readonly menuAdmin = computed(() =>
    this.auth
      .obtenerMenuAdmin()
      .filter((item) => RUTAS_ADMIN_HABILITADAS.includes(item.clave))
  );

  constructor() {
    effect(() => {
      if (this.auth.estaAutenticado()) {
        void this.cargarSaldos();
      } else {
        this.saldos.set({ saldoPuntos: 0, saldoCredito: 0 });
      }
    });
  }

  @HostListener('document:click', ['$event'])
  cerrarMenusAlClickAfuera(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.user-menu-container')) {
      this.mostrarMenu.set(false);
    }
    if (!target?.closest('.admin-dropdown-container')) {
      this.mostrarMenuAdmin.set(false);
    }
  }

  toggleMenuAdmin(event: Event): void {
    event.stopPropagation();
    this.mostrarMenu.set(false);
    this.mostrarMenuAdmin.update((v) => !v);
  }

  toggleMenuUsuario(event: Event): void {
    event.stopPropagation();
    this.mostrarMenuAdmin.set(false);
    this.mostrarMenu.update((v) => !v);
  }

  abrirModal(tipo: 'login' | 'register'): void {
    this.modalActivo.set(tipo);
  }

  cerrarModal(): void {
    this.modalActivo.set(null);
  }

  async cargarSaldos(): Promise<void> {
    try {
      const datosLedger = await this.cuentaService.getDatosPerfil();
      this.saldos.set({
        saldoPuntos: datosLedger.saldoPuntos || 0,
        saldoCredito: datosLedger.saldoCredito || 0,
      });
    } catch (error) {
      console.error('Error al cargar saldos en el Navbar', error);
    }
  }

  async cerrarSesion(): Promise<void> {
    this.mostrarMenu.set(false);
    this.mostrarMenuAdmin.set(false);
    await this.auth.cerrarSesion();
    await this.router.navigate(['/']);
  }
}