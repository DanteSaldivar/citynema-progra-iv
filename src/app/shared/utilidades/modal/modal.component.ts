import { Component, HostListener, input, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-modal',
  styleUrl: './modal.component.css',
  templateUrl: './modal.component.html',
})
export class ModalComponent {

  titulo = input<string>('');
  clase = input<string>('');
  cerrar = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrar.emit();
  }

}
