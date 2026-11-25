import { Routes } from '@angular/router';

export const STAFF_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./staff-validacion/staff-validacion.component').then(m => m.StaffValidacionComponent)
  }
];