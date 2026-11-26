export const ZONA_AR = 'America/Argentina/Buenos_Aires';
const OFFSET_AR = '-03:00'; 

export interface PartesFechaAR {
  anio: number;
  mes: number; // 1..12
  dia: number; // 1..31
  hora: number; // 0..23
  minuto: number; // 0..59
  segundo: number; // 0..59
}

const formateadorPartesAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_AR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const formateadorVisualAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formateadorSoloFechaAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Extrae año, mes, día, hora, minuto y segundo reales en zona horaria Argentina. */
export function obtenerPartesAR(fecha: Date | string = new Date()): PartesFechaAR {
  const dateObj = typeof fecha === 'string' ? parsearFechaSegura(fecha) : fecha;
  const parts = formateadorPartesAR.formatToParts(dateObj);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const horaRaw = get('hour');
  return {
    anio: get('year'),
    mes: get('month'),
    dia: get('day'),
    hora: horaRaw === 24 ? 0 : horaRaw,
    minuto: get('minute'),
    segundo: get('second'),
  };
}

/** Devuelve la fecha/hora actual como Date y su representación YYYY-MM-DD en Argentina. */
export function ahoraAR(): { date: Date; fechaISO: string; horaHM: string } {
  const date = new Date();
  const p = obtenerPartesAR(date);
  return {
    date,
    fechaISO: `${p.anio}-${pad2(p.mes)}-${pad2(p.dia)}`,
    horaHM: `${pad2(p.hora)}:${pad2(p.minuto)}`,
  };
}

/** Parsea 'YYYY-MM-DD' sin pasar por UTC medianoche (evita corrimiento al día anterior en UTC-3). */
export function parsearFechaLocalAR(fechaYMD: string): { anio: number; mes: number; dia: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaYMD.trim());
  if (!match) {
    throw new Error(`Formato de fecha inválido (esperado YYYY-MM-DD): ${fechaYMD}`);
  }
  return {
    anio: Number(match[1]),
    mes: Number(match[2]),
    dia: Number(match[3]),
  };
}

function parsearFechaSegura(valor: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return new Date(`${valor.trim()}T12:00:00${OFFSET_AR}`);
  }
  return new Date(valor);
}

/** Construye un string timestamptz ISO con offset -03:00 a partir de fecha local AR ('YYYY-MM-DD') y hora ('HH:mm'). */
export function construirTimestamptzAR(fechaYMD: string, horaHM: string): string {
  const { anio, mes, dia } = parsearFechaLocalAR(fechaYMD);
  const matchHora = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(horaHM.trim());
  if (!matchHora) {
    throw new Error(`Formato de hora inválido (esperado HH:mm): ${horaHM}`);
  }
  const hh = Number(matchHora[1]);
  const mm = Number(matchHora[2]);
  const ss = Number(matchHora[3] ?? 0);

  return `${anio}-${pad2(mes)}-${pad2(dia)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${OFFSET_AR}`;
}

/** Inicio inclusivo del día en Argentina (00:00:00.000-03:00). */
export function inicioDelDiaAR(fecha: Date | string = new Date()): string {
  const fechaYMD =
    typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())
      ? fecha.trim()
      : (() => {
          const p = obtenerPartesAR(fecha);
          return `${p.anio}-${pad2(p.mes)}-${pad2(p.dia)}`;
        })();

  return `${fechaYMD}T00:00:00.000${OFFSET_AR}`;
}

/** Fin inclusivo del día en Argentina (23:59:59.999-03:00). */
export function finDelDiaAR(fecha: Date | string = new Date()): string {
  const fechaYMD =
    typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())
      ? fecha.trim()
      : (() => {
          const p = obtenerPartesAR(fecha);
          return `${p.anio}-${pad2(p.mes)}-${pad2(p.dia)}`;
        })();

  return `${fechaYMD}T23:59:59.999${OFFSET_AR}`;
}

/** Formatea una fecha/hora a 'DD/MM/YYYY HH:mm' en hora de Buenos Aires. */
export function formatearFechaHora(fecha: Date | string): string {
  const dateObj = typeof fecha === 'string' ? parsearFechaSegura(fecha) : fecha;
  return formateadorVisualAR.format(dateObj).replace(',', '');
}

/** Formatea solo la fecha 'DD/MM/YYYY' respetando calendario de Buenos Aires. */
export function formatearFecha(fecha: Date | string): string {
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
    const { anio, mes, dia } = parsearFechaLocalAR(fecha);
    return `${pad2(dia)}/${pad2(mes)}/${anio}`;
  }
  const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return formateadorSoloFechaAR.format(dateObj);
}

/** Calcula edad cumplida en años enteros en una fecha de referencia según calendario AR. */
export function edadEn(fechaNacimientoYMD: string, fechaReferencia: Date | string = new Date()): number {
  const nac = parsearFechaLocalAR(fechaNacimientoYMD);
  const ref =
    typeof fechaReferencia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaReferencia.trim())
      ? parsearFechaLocalAR(fechaReferencia)
      : obtenerPartesAR(fechaReferencia);

  let edad = ref.anio - nac.anio;
  if (ref.mes < nac.mes || (ref.mes === nac.mes && ref.dia < nac.dia)) {
    edad--;
  }
  return edad;
}

