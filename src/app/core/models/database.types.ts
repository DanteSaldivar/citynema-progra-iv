export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RolUsuario = 'cliente' | 'empleado' | 'admin';
export type TipoSangre = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type ColumnaButaca = 'izquierda' | 'centro' | 'derecha';
export type TipoButaca = 'estandar' | 'accesible' | 'vip';
export type ClasificacionPelicula = 'atp' | '13' | '18';
export type EstadoPelicula = 'proximamente' | 'en_cartelera' | 'finalizada';
export type EstadoFuncion = 'programada' | 'cancelada' | 'finalizada';
export type FormatoFuncion = '2D' | '3D' | '4D' | '5D';
export type IdiomaFuncion = 'castellano' | 'subtitulada';
export type TipoCupon = 'primera_compra' | 'edad_minima' | 'general';
export type EstadoOrden = 'pendiente' | 'pagada' | 'cancelada' | 'expirada';
export type EstadoCandy = 'pendiente' | 'entregado' | 'cancelado';
export type EstadoEntrada = 'valida' | 'usada' | 'cancelada';
export type TipoMovimientoPuntos = 'acumulacion' | 'canje' | 'ajuste';
export type TipoRecompensa = 'entrada' | 'producto';
export type TipoMovimientoCredito = 'acreditacion' | 'uso' | 'ajuste';
export type TipoNotificacion =
  | 'orden_cancelada'
  | 'venta_abierta'
  | 'funcion_cancelada'
  | 'turno_lista_espera'
  | 'general';

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string;
  tipo_sangre: TipoSangre | null;
  color_ojos: string | null;
  dias_vacaciones: number | null;
  rol: RolUsuario;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sala {
  id: string;
  nombre: string;
  numero: number;
  activa: boolean;
  created_at: string;
}

export interface Butaca {
  id: string;
  sala_id: string;
  fila: string;
  columna: ColumnaButaca;
  numero: number;
  tipo: TipoButaca;
  activa: boolean;
}

export interface Pelicula {
  id: string;
  titulo: string;
  sinopsis: string;
  duracion_min: number;
  poster_url: string | null;
  clasificacion: ClasificacionPelicula;
  fecha_estreno: string;
  estado: EstadoPelicula;
  destacada: boolean;
  orden_destacada: number | null;
  preventa_habilitada: boolean;
  preventa_dias: number;
  preventa_pct: number | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Genero {
  id: string;
  nombre: string;
  slug: string;
}

export interface PeliculaGenero {
  pelicula_id: string;
  genero_id: string;
}

export interface Resenia {
  id: string;
  pelicula_id: string;
  user_id: string;
  puntaje: number;
  comentario: string | null;
  created_at: string;
  updated_at: string;
}

export interface Funcion {
  id: string;
  pelicula_id: string;
  sala_id: string;
  inicio: string;
  fin: string;
  formato: FormatoFuncion;
  idioma: IdiomaFuncion;
  precio_base: number;
  estado: EstadoFuncion;
  created_by: string | null;
  created_at: string;
}

export interface CategoriaProducto {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
}

export interface Producto {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  precio: number;
  activo: boolean;
  created_at: string;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  precio: number;
  incluye_entradas: number;
  destacado: boolean;
  activo: boolean;
  created_at: string;
}

export interface ComboItem {
  combo_id: string;
  producto_id: string;
  cantidad: number;
}

export interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: TipoCupon;
  porcentaje: number;
  edad_minima: number | null;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  usos_maximos: number | null;
  usos_por_usuario: number;
  activo: boolean;
  created_at: string;
}

export interface CuponUso {
  id: string;
  cupon_id: string;
  user_id: string | null;
  orden_id: string;
  created_at: string;
}

export interface Orden {
  id: string;
  numero: number;
  user_id: string | null;
  email_invitado: string | null;
  nombre_invitado: string | null;
  subtotal: number;
  descuento_cupon: number;
  credito_aplicado: number;
  puntos_aplicados: number;
  total: number;
  cupon_id: string | null;
  metodo_pago: string | null;
  estado: EstadoOrden;
  codigo_candy: string | null;
  candy_estado: EstadoCandy | null;
  candy_entregado_at: string | null;
  candy_entregado_por: string | null;
  pagada_at: string | null;
  cancelada_at: string | null;
  created_at: string;
}

export interface Entrada {
  id: string;
  orden_id: string;
  funcion_id: string;
  butaca_id: string;
  precio: number;
  tipo_butaca: TipoButaca;
  es_preventa: boolean;
  requiere_adulto: boolean;
  codigo_qr: string;
  estado: EstadoEntrada;
  validada_at: string | null;
  validada_por: string | null;
  created_at: string;
}

export interface OrdenProducto {
  id: string;
  orden_id: string;
  producto_id: string | null;
  combo_id: string | null;
  cantidad: number;
  precio_unitario: number;
}

export interface ReservaButaca {
  id: string;
  funcion_id: string;
  butaca_id: string;
  user_id: string | null;
  session_id: string;
  expira_at: string;
  created_at: string;
}

export interface PuntoMovimiento {
  id: string;
  user_id: string;
  tipo: TipoMovimientoPuntos;
  puntos: number;
  orden_id: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface Recompensa {
  id: string;
  tipo: TipoRecompensa;
  producto_id: string | null;
  descripcion: string;
  costo_puntos: number;
  activa: boolean;
}

export interface Canje {
  id: string;
  user_id: string;
  recompensa_id: string;
  costo_puntos: number;
  orden_id: string | null;
  created_at: string;
}

export interface CreditoMovimiento {
  id: string;
  user_id: string;
  tipo: TipoMovimientoCredito;
  monto: number;
  orden_id: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface Cancelacion {
  id: string;
  orden_id: string;
  user_id: string | null;
  monto_acreditado: number;
  motivo: string | null;
  created_at: string;
}

export interface AlertaEstreno {
  id: string;
  user_id: string;
  pelicula_id: string;
  notificada: boolean;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export interface Configuracion {
  clave: string;
  valor: Json;
  descripcion: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_rol: string | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  datos_antes: Json | null;
  datos_despues: Json | null;
  created_at: string;
}

export interface Notificacion {
  id: string;
  user_id: string;
  tipo: TipoNotificacion;
  mensaje: string;
  datos: Record<string, Json> | null;
  leida: boolean;
  created_at: string;
}

// Alias de compatibilidad si algún servicio existente importaba Perfil
export type Perfil = Profile;