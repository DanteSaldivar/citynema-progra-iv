import { Component, inject, signal } from '@angular/core';
import { ValidacionService } from '../validacion.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


type TipoValidacion = 'entrada' | 'candy';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-staff-validacion.component',
  styleUrl: './staff-validacion.component.css',
  templateUrl: './staff-validacion.component.html',
})
export class StaffValidacionComponent {

  private validacionService = inject(ValidacionService);

  tipo = signal<TipoValidacion>('entrada');
  codigoManual = '';
  
  procesando = signal(false);
  resultadoExito = signal(false);
  mensajeError = signal<string | null>(null);
  
  datosEntrada = signal<any>(null);
  datosCandy = signal<any>(null);

  async validarCodigo() {
    if (!this.codigoManual.trim()) return;
    
    this.procesando.set(true);
    this.resultadoExito.set(false);
    this.mensajeError.set(null);
    this.datosEntrada.set(null);
    this.datosCandy.set(null);

    try {
      if (this.tipo() === 'entrada') {
        const entrada = await this.validacionService.validarEntrada(this.codigoManual.trim());
        this.datosEntrada.set(entrada);
      } else {
        const orden = await this.validacionService.validarRetiroCandy(this.codigoManual.trim());
        this.datosCandy.set(orden);
      }
      this.resultadoExito.set(true);
      this.codigoManual = ''; // Limpiar para el siguiente escaneo
    } catch (e: any) {
      this.mensajeError.set(e.message);
    } finally {
      this.procesando.set(false);
    }
  }

}
