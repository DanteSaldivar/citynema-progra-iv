export type ClavePermisoAdmin =
  | 'reportes'
  | 'funciones'
  | 'peliculas'
  | 'generos'
  | 'salas'
  | 'productos'
  | 'cupones'
  | 'recompensas'
  | 'auditoria'
  | 'config';

export interface DefinicionPermisoAdmin {
  etiqueta: string;
  ruta: string;
}

export const PERMISOS_ADMIN: Record<ClavePermisoAdmin, DefinicionPermisoAdmin> = {
  reportes: { etiqueta: 'Reportes y Métricas', ruta: '/admin' },
  funciones: { etiqueta: 'Programación de Funciones', ruta: '/admin/funciones' },
  peliculas: { etiqueta: 'Películas', ruta: '/admin/peliculas' },
  generos: { etiqueta: 'Géneros', ruta: '/admin/generos' },
  salas: { etiqueta: 'Salas y Butacas', ruta: '/admin/salas' },
  productos: { etiqueta: 'Candy Bar y Combos', ruta: '/admin/productos' },
  cupones: { etiqueta: 'Cupones y Promociones', ruta: '/admin/cupones' },
  recompensas: { etiqueta: 'Recompensas y Puntos', ruta: '/admin/recompensas' },
  auditoria: { etiqueta: 'Log de Auditoría', ruta: '/admin/auditoria' },
  config: { etiqueta: 'Configuración General', ruta: '/admin/configuracion' },
};

export interface ItemMenuAdmin {
  clave: ClavePermisoAdmin;
  etiqueta: string;
  ruta: string;
}