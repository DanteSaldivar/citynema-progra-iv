import { Injectable, computed, signal } from '@angular/core';

export type TipoToast = 'exito' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tipo: TipoToast;
  mensaje: string;
  duracionMs: number;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastsSignal = signal<ToastItem[]>([]);
  readonly toasts = computed(() => this.toastsSignal());

  exito(mensaje: string, duracionMs = 4000): void {
    this.mostrar('exito', mensaje, duracionMs);
  }

  error(mensaje: string, duracionMs = 5500): void {
    this.mostrar('error', mensaje, duracionMs);
  }

  info(mensaje: string, duracionMs = 4000): void {
    this.mostrar('info', mensaje, duracionMs);
  }

  mostrar(tipo: TipoToast, mensaje: string, duracionMs = 4000): void {
    const id = crypto.randomUUID();
    const item: ToastItem = { id, tipo, mensaje, duracionMs };

    this.toastsSignal.update((lista) => [...lista, item]);

    if (duracionMs > 0) {
      setTimeout(() => this.cerrar(id), duracionMs);
    }
  }

  cerrar(id: string): void {
    this.toastsSignal.update((lista) => lista.filter((t) => t.id !== id));
  }
}