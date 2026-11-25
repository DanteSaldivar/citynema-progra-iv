import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { CuentaService } from '../../../features/cuenta/cuenta.service';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { ModalComponent } from '../../utilidades/modal/modal.component';
import { LoginComponent } from '../../../features/auth/login/login.component';
import { RegistroComponent } from '../../../features/auth/registro/registro.component';

@Component({
  imports: [RouterLink, RouterLinkActive, SlicePipe, ModalComponent, LoginComponent, RegistroComponent],
  selector: 'app-navbar',
  styleUrl: './navbar.component.css',
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {

  private auth = inject(AuthService);
  private cuentaService = inject(CuentaService);
  private router = inject(Router);

  // Signals para manejar la UI
  saldos = signal({ saldoPuntos: 0, saldoCredito: 0 });
  userEmail = signal<string>('');
  modalActivo: 'login' | 'register' | null = null;


  userInitials = signal<string>('U');
  mostrarMenu = signal<boolean>(false);


  abrirModal(tipo: 'login' | 'register') {
    this.modalActivo = tipo;
  }

  cerrarModal() {
    this.modalActivo = null;
  }

  constructor(){
    effect(() => {
    this.cargarSaldos();
  });
  }

  async ngOnInit() {

    if (this.auth.estaAutenticado()) {
      const perfil = this.auth.perfil();

      if (perfil?.email) {
        this.userEmail.set(perfil.email);
        this.userInitials.set(perfil.email.substring(0, 2));
      }

      try {
        this.cargarSaldos();
      } catch (error) {
        console.error('Error al cargar saldos en el Navbar', error);
      }
    }
  }

  async cargarSaldos() {
    const datosLedger = await this.cuentaService.getDatosPerfil();
    this.saldos.set({
      saldoPuntos: datosLedger.saldoPuntos || 0,
      saldoCredito: datosLedger.saldoCredito || 0
    });
  }

  async cerrarSesion() {
    await this.auth.cerrarSesion();
    this.router.navigate(['/']);
    window.location.reload();
  }

}
