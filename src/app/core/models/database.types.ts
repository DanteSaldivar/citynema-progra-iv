export type RolUsuario = 'cliente' | 'empleado' | 'admin';
export type TipoButaca = 'estandar' | 'accesible' | 'vip';
export type FormatoPelicula = '2D' | '3D' | '4D' | '5D';
export type IdiomaPelicula = 'castellano' | 'subtitulada';
export type ClasificacionEdad = 'atp' | '13' | '18';
export type EstadoOrden = 'pendiente' | 'pagada' | 'cancelada' | 'expirada';
export type EstadoEntrada = 'valida' | 'usada' | 'cancelada';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string; 
  tipo_sangre: 'A+'|'A-'|'B+'|'B-'|'AB+'|'AB-'|'O+'|'O-' | null;
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
  created_at?: string;
}

export interface Butaca {
  id: string;
  sala_id: string;
  fila: string;
  columna: 'izquierda' | 'centro' | 'derecha';
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
  clasificacion: ClasificacionEdad;
  fecha_estreno: string;
  estado: 'proximamente' | 'en_cartelera' | 'finalizada';
  destacada: boolean;
  orden_destacada: number | null;
  preventa_habilitada: boolean;
  preventa_dias: number;
  preventa_pct: number | null;
  activa: boolean;
  created_at?: string;
  updated_at?: string;
  pelicula_generos?: string[];
}

export interface Genero {
  id: string;
  nombre: string;
  slug: string;
}

export interface Funcion {
  id: string;
  pelicula_id: string;
  sala_id: string;
  inicio: string; // ISO string timestamptz
  fin: string;    // ISO string timestamptz
  formato: FormatoPelicula;
  idioma: IdiomaPelicula;
  precio_base: number;
  estado: 'programada' | 'cancelada' | 'finalizada';
  created_by?: string | null;
  created_at?: string;
}