import { Component, effect, inject, signal } from '@angular/core';
import { ModalService } from '../../../core/services/modal.service';

@Component({
  imports: [],
  selector: 'app-modal-host',
  styleUrl: './modal-host.component.css',
  templateUrl: './modal-host.component.html',
})
export class ModalHostComponent {

  readonly modal = inject(ModalService);
  readonly valores = signal<Record<string, string | number>>({});

  constructor() {
    effect(() => {
      const cfg = this.modal.activo();
      if (cfg?.tipo === 'formulario' && cfg.campos) {
        const init: Record<string, string | number> = {};
        for (const c of cfg.campos) {
          init[c.clave] = c.valorInicial ?? (c.opciones?.[0]?.valor ?? '');
        }
        this.valores.set(init);
      } else {
        this.valores.set({});
      }
    });
  }

  actualizarCampo(clave: string, event: Event): void {
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const val = el.type === 'number' ? Number(el.value) : el.value;
    this.valores.update((prev) => ({ ...prev, [clave]: val }));
  }

  onConfirmar(): void {
    const cfg = this.modal.activo();
    if (!cfg) return;
    this.modal.cerrarConResultado(cfg.tipo === 'confirmar' ? true : undefined);
  }

  onCancelar(): void {
    const cfg = this.modal.activo();
    if (!cfg) return;
    if (cfg.tipo === 'informar') {
      this.modal.cerrarConResultado(undefined);
    } else if (cfg.tipo === 'confirmar') {
      this.modal.cerrarConResultado(false);
    } else {
      this.modal.cerrarConResultado(null);
    }
  }

  onSubmitForm(event: Event): void {
    event.preventDefault();
    this.modal.cerrarConResultado({ ...this.valores() });
  }

}
