import { Component, inject, signal } from '@angular/core';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { Notificacion } from '../../../core/models/database.types';
import { TIPO_NOTIFICACION_ETIQUETAS, TIPOS_NOTIFICACION } from '../../../core/models/constantes';
import { formatearFechaHora } from '../../../core/utils/fechas';

@Component({
  imports: [],
  selector: 'app-notificaciones-campana',
  styleUrl: './notificaciones-campana.component.css',
  templateUrl: './notificaciones-campana.component.html',
})
export class NotificacionesCampanaComponent {

  readonly notifService = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly abierto = signal<boolean>(false);

  togglePanel(): void {
    this.abierto.update((v) => !v);
  }

  etiquetaTipo(n: Notificacion): string {
    return TIPO_NOTIFICACION_ETIQUETAS[n.tipo] ?? 'Aviso';
  }

  formatearFecha(iso: string): string {
    return formatearFechaHora(iso);
  }

  async marcarTodas(): Promise<void> {
    const res = await this.notifService.marcarTodasLeidas();
    if (!res.ok) {
      this.toast.error(res.error);
    }
  }

  async abrirNotificacion(n: Notificacion): Promise<void> {
    if (!n.leida) {
      await this.notifService.marcarLeida(n.id);
    }

    this.abierto.set(false);

    const datos = n.datos ?? {};
    const funcionId = datos['funcion_id'];
    const ordenId = datos['orden_id'];

    if (typeof funcionId === 'string' && funcionId) {
      await this.router.navigate(['/compra/asientos', funcionId]);
    } else if (typeof ordenId === 'string' && ordenId) {
      // TODO(Bloque 5): cuando exista /cuenta/ordenes/:id navegar directo al detalle de orden
      await this.router.navigate(['/cuenta']);
    }
  }

  /** TODO(BORRAR ANTES DE ENTREGA): prueba en vivo de Realtime */
  async probarNotificacionRealtime(): Promise<void> {
    const res = await this.notifService.crearNotificacionPropia(
      TIPOS_NOTIFICACION.GENERAL,
      'Notificación de prueba en tiempo real desde la campanita.'
    );
    if (!res.ok) {
      this.toast.error(res.error);
    }
  }

}
