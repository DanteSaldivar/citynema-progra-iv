import { Injectable, computed, signal } from '@angular/core';

export interface CampoModalFormulario {
  clave: string;
  etiqueta: string;
  tipo: 'text' | 'textarea' | 'number' | 'select';
  requerido?: boolean;
  placeholder?: string;
  valorInicial?: string | number;
  opciones?: { valor: string; etiqueta: string }[];
}

export interface ConfiguracionModal {
  tipo: 'confirmar' | 'informar' | 'formulario';
  titulo: string;
  mensaje?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligroso?: boolean;
  campos?: CampoModalFormulario[];
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private readonly activoSignal = signal<ConfiguracionModal | null>(null);
  readonly activo = computed(() => this.activoSignal());

  private resolverActual: ((valor: unknown) => void) | null = null;

  confirmar(opciones: {
    titulo: string;
    mensaje: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    peligroso?: boolean;
  }): Promise<boolean> {
    return this.abrir<boolean>({
      tipo: 'confirmar',
      titulo: opciones.titulo,
      mensaje: opciones.mensaje,
      textoConfirmar: opciones.textoConfirmar ?? 'Confirmar',
      textoCancelar: opciones.textoCancelar ?? 'Cancelar',
      peligroso: opciones.peligroso ?? false,
    });
  }

  informar(opciones: {
    titulo: string;
    mensaje: string;
    textoConfirmar?: string;
  }): Promise<void> {
    return this.abrir<void>({
      tipo: 'informar',
      titulo: opciones.titulo,
      mensaje: opciones.mensaje,
      textoConfirmar: opciones.textoConfirmar ?? 'Entendido',
    });
  }

  formulario(opciones: {
    titulo: string;
    mensaje?: string;
    campos: CampoModalFormulario[];
    textoConfirmar?: string;
    textoCancelar?: string;
  }): Promise<Record<string, string | number> | null> {
    return this.abrir<Record<string, string | number> | null>({
      tipo: 'formulario',
      titulo: opciones.titulo,
      mensaje: opciones.mensaje,
      campos: opciones.campos,
      textoConfirmar: opciones.textoConfirmar ?? 'Guardar',
      textoCancelar: opciones.textoCancelar ?? 'Cancelar',
    });
  }

  private abrir<T>(config: ConfiguracionModal): Promise<T> {
    // Si hubiera un modal previo abierto, lo cerramos devolviendo falso/null
    if (this.resolverActual) {
      this.resolverActual(config.tipo === 'confirmar' ? false : null);
    }

    this.activoSignal.set(config);
    return new Promise<T>((resolve) => {
      this.resolverActual = resolve as (valor: unknown) => void;
    });
  }

  cerrarConResultado(resultado: unknown): void {
    const resolver = this.resolverActual;
    this.resolverActual = null;
    this.activoSignal.set(null);
    if (resolver) {
      resolver(resultado);
    }
  }
}