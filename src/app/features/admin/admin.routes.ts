import { Routes } from '@angular/router';
import { permisoGuard } from '../../core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permisoGuard('reportes')],
    data: { permiso: 'reportes' },
    loadComponent: () =>
      import('./admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
  },
  {
    path: 'peliculas',
    canActivate: [permisoGuard('peliculas')],
    data: { permiso: 'peliculas' },
    loadComponent: () =>
      import('./peliculas/admin-peliculas/admin-peliculas.component').then(
        (m) => m.AdminPeliculasComponent
      ),
  },
  {
    path: 'salas',
    canActivate: [permisoGuard('salas')],
    data: { permiso: 'salas' },
    loadComponent: () =>
      import('./salas/admin-salas/admin-salas.component').then(
        (m) => m.AdminSalasComponent
      ),
  },
  {
    path: 'productos',
    canActivate: [permisoGuard('productos')],
    data: { permiso: 'productos' },
    loadComponent: () =>
      import('./admin-candy/admin-candy.component').then(
        (m) => m.AdminCandyComponent
      ),
  },
  {
    path: 'configuracion',
    canActivate: [permisoGuard('config')],
    data: { permiso: 'config' },
    loadComponent: () =>
      import('./admin-config/admin-config.component').then(
        (m) => m.AdminConfigComponent
      ),
  },
  {
    path: 'funciones',
    canActivate: [permisoGuard('funciones')],
    data: { permiso: 'funciones' },
    loadComponent: () =>
      import('./admin-funciones/admin-funciones.component').then(
        (m) => m.AdminFuncionesComponent
      ),
  },
];