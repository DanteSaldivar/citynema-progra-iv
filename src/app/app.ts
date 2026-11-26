import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/ui/navbar/navbar.component';
import { ToastContainerComponent } from './shared/ui/toast-container/toast-container.component';
import { ModalHostComponent } from './shared/ui/modal-host/modal-host.component';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, ToastContainerComponent, ModalHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly auth = inject(AuthService);
  protected readonly title = signal('citynema-progra-iv');
}
