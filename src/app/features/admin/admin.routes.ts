import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
  path: 'configuracion',
  loadComponent: () => import('./admin-config/admin-config.component').then(m => m.AdminConfigComponent)
},
{
  path: 'funciones',
  loadComponent: () => import('./admin-funciones/admin-funciones.component').then(m => m.AdminFuncionesComponent)
}
];