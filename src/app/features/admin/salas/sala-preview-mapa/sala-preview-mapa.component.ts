import { Component, computed, input } from '@angular/core';
import { Butaca } from '../../../../core/models/database.types';
import { TIPOS_BUTACA } from '../../../../core/models/constantes';

interface FilaAgrupadaPreview {
  letra: string;
  izquierda: Butaca[];
  centro: Butaca[];
  derecha: Butaca[];
}

@Component({
  imports: [],
  selector: 'app-sala-preview-mapa',
  styleUrl: './sala-preview-mapa.component.css',
  templateUrl: './sala-preview-mapa.component.html',
})
export class SalaPreviewMapaComponent {

  readonly butacas = input.required<Butaca[]>();
  readonly tipos = TIPOS_BUTACA;

  readonly conteos = computed(() => {
    let estandar = 0;
    let accesible = 0;
    let vip = 0;

    for (const b of this.butacas()) {
      if (b.tipo === TIPOS_BUTACA.ACCESIBLE) accesible++;
      else if (b.tipo === TIPOS_BUTACA.VIP) vip++;
      else estandar++;
    }

    return { estandar, accesible, vip };
  });

  readonly filasAgrupadas = computed<FilaAgrupadaPreview[]>(() => {
    const lista = this.butacas();
    if (!lista.length) return [];

    const mapa: Record<string, FilaAgrupadaPreview> = {};

    for (const b of lista) {
      if (!mapa[b.fila]) {
        mapa[b.fila] = { letra: b.fila, izquierda: [], centro: [], derecha: [] };
      }
      if (b.columna === 'izquierda') mapa[b.fila].izquierda.push(b);
      else if (b.columna === 'centro') mapa[b.fila].centro.push(b);
      else mapa[b.fila].derecha.push(b);
    }

    return Object.values(mapa).sort((a, b) => a.letra.localeCompare(b.letra));
  });
}
