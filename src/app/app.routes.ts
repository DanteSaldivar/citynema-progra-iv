import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // ==========================================
  // BLOQUE 2: RUTAS PÚBLICAS (Catálogo)
  // ==========================================
  {
    path: '',
    loadComponent: () => import('./features/catalogo/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'catalogo',
    loadComponent: () => import('./features/catalogo/lista-catalogo/lista-catalogo.component').then(m => m.ListaCatalogoComponent)
  },
  {
    path: 'pelicula/:id',
    loadComponent: () => import('./features/catalogo/pelicula-detalle/pelicula-detalle.component').then(m => m.PeliculaDetalleComponent)
  },

  // ==========================================
  // BLOQUE 1: RUTAS DE AUTENTICACIÓN
  // ==========================================
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'compra/asientos/:funcionId',
    loadComponent: () => import('./features/compra/mapa-butacas/mapa-butacas.component').then(m => m.MapaButacasComponent)
  },

  // ==========================================
  // BLOQUE 3: RUTAS DE COMPRA
  // ==========================================
  {
    path: 'compra/asientos/:funcionId',
    loadComponent: () => import('./features/compra/mapa-butacas/mapa-butacas.component').then(m => m.MapaButacasComponent)
  },
  {
    path: 'compra/checkout',
    loadComponent: () => import('./features/compra/checkout/checkout.component').then(m => m.CheckoutComponent)
  },
  {
    path: 'compra/exito/:ordenId',
    loadComponent: () => import('./features/compra/exito-compra/exito-compra.component').then(m => m.ExitoCompraComponent)
  },


  // ==========================================
  // BLOQUES FUTUROS: RUTAS PROTEGIDAS
  // ==========================================

  // Área del Cliente Registrado (Perfil, Puntos, Historial)
  {
    path: 'cuenta',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cuenta/cuenta-dashboard/cuenta-dashboard.component').then(m => m.CuentaDashboardComponent)
  },
  {
    path: 'cuenta/mis-peliculas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cuenta/mis-peliculas/mis-peliculas.component').then(m => m.MisPeliculasComponent)
  },

  // Área del Empleado (Escáner QR)
  {
    path: 'staff',
    canActivate: [authGuard, roleGuard(['empleado', 'admin'])],
    loadChildren: () => import('./features/staff/staff.routes').then(m => m.STAFF_ROUTES)
  },

  // Área de Administración (ABMs, Reportes)
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },

  // Ruta comodín: redirige al Home si la URL no existe
  {
    path: '**',
    redirectTo: ''
  }
];