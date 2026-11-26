import { Sala } from '../../../core/models/database.types';
import { construirTimestamptzAR, parsearFechaLocalAR } from '../../../core/utils/fechas';

export interface ItemPrevisualizacionRecurrente {
  fechaYMD: string;
  inicio: Date;
  fin: Date;
  disponible: boolean;
  salaAsignada: Sala | null;
  motivoNoDisponible: string | null;
}

export interface RangoOcupacionSala {
  sala_id: string;
  inicioMs: number;
  finMs: number;
}

/** Suma días sobre fecha civil YYYY-MM-DD sin corrimiento horario. */
export function sumarDiasCivilYMD(fechaYMD: string, dias: number): string {
  const { anio, mes, dia } = parsearFechaLocalAR(fechaYMD);
  const utc = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

/** Devuelve día de semana (0 = Dom .. 6 = Sáb) para YYYY-MM-DD. */
export function diaSemanaCivilYMD(fechaYMD: string): number {
  const { anio, mes, dia } = parsearFechaLocalAR(fechaYMD);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/** Genera las fechas YYYY-MM-DD dentro de [desde, hasta] que coinciden con diasSemana. */
export function listarFechasCandidatas(
  desdeYMD: string,
  hastaYMD: string,
  diasSemana: number[]
): string[] {
  const candidatas: string[] = [];
  let cursor = desdeYMD;
  while (cursor <= hastaYMD) {
    if (diasSemana.includes(diaSemanaCivilYMD(cursor))) {
      candidatas.push(cursor);
    }
    cursor = sumarDiasCivilYMD(cursor, 1);
  }
  return candidatas;
}

/** Simula en memoria la asignación de salas activas para cada fecha candidata. */
export function simularAsignacionLote(params: {
  fechasCandidatas: string[];
  horaHHMM: string;
  duracionMin: number;
  fechaEstrenoYMD: string;
  margenMin: number;
  salasActivas: Sala[];
  ocupacionesIniciales: RangoOcupacionSala[];
  validarHorario: (inicio: Date, fechaEstrenoYMD: string) => string | null;
}): ItemPrevisualizacionRecurrente[] {
  const margenMs = params.margenMin * 60 * 1000;
  const ocupaciones = [...params.ocupacionesIniciales];
  const resultado: ItemPrevisualizacionRecurrente[] = [];

  for (const fechaYMD of params.fechasCandidatas) {
    const inicio = new Date(construirTimestamptzAR(fechaYMD, params.horaHHMM));
    const fin = new Date(inicio.getTime() + params.duracionMin * 60 * 1000);

    const errHorario = params.validarHorario(inicio, params.fechaEstrenoYMD);
    if (errHorario) {
      resultado.push({
        fechaYMD,
        inicio,
        fin,
        disponible: false,
        salaAsignada: null,
        motivoNoDisponible:
          fechaYMD < params.fechaEstrenoYMD
            ? `Anterior al estreno (${params.fechaEstrenoYMD})`
            : 'Horario pasado',
      });
      continue;
    }

    const inicioMs = inicio.getTime();
    const finMs = fin.getTime();
    const salaLibre = params.salasActivas.find(
      (sala) =>
        !ocupaciones.some(
          (oc) =>
            oc.sala_id === sala.id &&
            oc.inicioMs < finMs + margenMs &&
            oc.finMs > inicioMs - margenMs
        )
    );

    if (salaLibre) {
      ocupaciones.push({ sala_id: salaLibre.id, inicioMs, finMs });
      resultado.push({
        fechaYMD,
        inicio,
        fin,
        disponible: true,
        salaAsignada: salaLibre,
        motivoNoDisponible: null,
      });
    } else {
      resultado.push({
        fechaYMD,
        inicio,
        fin,
        disponible: false,
        salaAsignada: null,
        motivoNoDisponible: `Sin sala libre (margen ${params.margenMin} min)`,
      });
    }
  }

  return resultado;
}