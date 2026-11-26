import { ClasificacionPelicula, EstadoCandy, EstadoEntrada, EstadoFuncion, EstadoOrden, EstadoPelicula, FormatoFuncion, IdiomaFuncion, RolUsuario, TipoButaca, TipoNotificacion, TipoSangre, } from './database.types';

export interface OpcionCatalogo<T extends string> {
  valor: T;
  etiqueta: string;
}
/* Tope máximo de butacas retenibles por compra.  */
export const MAX_BUTACAS_POR_COMPRA = 8;

export const ROLES_USUARIO = {
  CLIENTE: 'cliente',
  EMPLEADO: 'empleado',
  ADMIN: 'admin',
} as const satisfies Record<string, RolUsuario>;

export const TIPOS_SANGRE: readonly TipoSangre[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
] as const;

export const CLASIFICACIONES = {
  ATP: 'atp',
  MAS_13: '13',
  MAS_18: '18',
} as const satisfies Record<string, ClasificacionPelicula>;

export const CLASIFICACIONES_OPCIONES: readonly OpcionCatalogo<ClasificacionPelicula>[] = [
  { valor: 'atp', etiqueta: 'ATP (Apta todo público)' },
  { valor: '13', etiqueta: '+13 (Mayores de 13 años)' },
  { valor: '18', etiqueta: '+18 (Mayores de 18 años)' },
] as const;

export const CLASIFICACION_ETIQUETAS: Record<ClasificacionPelicula, string> = {
  atp: 'ATP',
  '13': '+13',
  '18': '+18',
};

export const FORMATOS_FUNCION = {
  D2: '2D',
  D3: '3D',
  D4: '4D',
  D5: '5D',
} as const satisfies Record<string, FormatoFuncion>;

export const FORMATOS_OPCIONES: readonly OpcionCatalogo<FormatoFuncion>[] = [
  { valor: '2D', etiqueta: '2D' },
  { valor: '3D', etiqueta: '3D' },
  { valor: '4D', etiqueta: '4D' },
  { valor: '5D', etiqueta: '5D' },
] as const;

export const IDIOMAS_FUNCION = {
  CASTELLANO: 'castellano',
  SUBTITULADA: 'subtitulada',
} as const satisfies Record<string, IdiomaFuncion>;

export const IDIOMAS_OPCIONES: readonly OpcionCatalogo<IdiomaFuncion>[] = [
  { valor: 'castellano', etiqueta: 'Castellano' },
  { valor: 'subtitulada', etiqueta: 'Subtitulada' },
] as const;

export const IDIOMA_ETIQUETAS: Record<IdiomaFuncion, string> = {
  castellano: 'Castellano',
  subtitulada: 'Subtitulada',
};

export const ESTADOS_PELICULA = {
  PROXIMAMENTE: 'proximamente',
  EN_CARTELERA: 'en_cartelera',
  FINALIZADA: 'finalizada',
} as const satisfies Record<string, EstadoPelicula>;

export const ESTADOS_PELICULA_OPCIONES: readonly OpcionCatalogo<EstadoPelicula>[] = [
  { valor: 'proximamente', etiqueta: 'Próximamente' },
  { valor: 'en_cartelera', etiqueta: 'En cartelera' },
  { valor: 'finalizada', etiqueta: 'Finalizada' },
] as const;

export const ESTADO_PELICULA_ETIQUETAS: Record<EstadoPelicula, string> = {
  proximamente: 'Próximamente',
  en_cartelera: 'En cartelera',
  finalizada: 'Finalizada',
};

export const ESTADOS_FUNCION = {
  PROGRAMADA: 'programada',
  CANCELADA: 'cancelada',
  FINALIZADA: 'finalizada',
} as const satisfies Record<string, EstadoFuncion>;

export const ESTADO_FUNCION_ETIQUETAS: Record<EstadoFuncion, string> = {
  programada: 'Programada',
  cancelada: 'Cancelada',
  finalizada: 'Finalizada',
};

export const ESTADOS_ORDEN = {
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
} as const satisfies Record<string, EstadoOrden>;

export const ESTADO_ORDEN_ETIQUETAS: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

export const ESTADOS_CANDY = {
  PENDIENTE: 'pendiente',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
} as const satisfies Record<string, EstadoCandy>;

export const ESTADOS_ENTRADA = {
  VALIDA: 'valida',
  USADA: 'usada',
  CANCELADA: 'cancelada',
} as const satisfies Record<string, EstadoEntrada>;

export const ESTADO_ENTRADA_ETIQUETAS: Record<EstadoEntrada, string> = {
  valida: 'Válida',
  usada: 'Usada',
  cancelada: 'Cancelada',
};

export const TIPOS_BUTACA = {
  ESTANDAR: 'estandar',
  ACCESIBLE: 'accesible',
  VIP: 'vip',
} as const satisfies Record<string, TipoButaca>;

export const TIPO_BUTACA_ETIQUETAS: Record<TipoButaca, string> = {
  estandar: 'Estándar',
  accesible: 'Accesible',
  vip: 'VIP',
};

export const TIPOS_NOTIFICACION = {
  ORDEN_CANCELADA: 'orden_cancelada',
  VENTA_ABIERTA: 'venta_abierta',
  FUNCION_CANCELADA: 'funcion_cancelada',
  TURNO_LISTA_ESPERA: 'turno_lista_espera',
  GENERAL: 'general',
} as const satisfies Record<string, TipoNotificacion>;

export const TIPO_NOTIFICACION_ETIQUETAS: Record<TipoNotificacion, string> = {
  orden_cancelada: 'Orden cancelada',
  venta_abierta: 'Preventa / Venta abierta',
  funcion_cancelada: 'Función cancelada',
  turno_lista_espera: 'Turno en lista de espera',
  general: 'Aviso',
};