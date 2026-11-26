import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../models/database.types';
import { AuthService } from './auth.service';
import { ClavePermisoAdmin } from './permisos';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.esperarInicializacion();

  if (auth.estaAutenticado()) {
    return true;
  }

  return router.parseUrl('/auth/login');
};

export const roleGuard = (rolesPermitidos: RolUsuario[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.esperarInicializacion();

    if (!auth.estaAutenticado()) {
      return router.parseUrl('/auth/login');
    }

    const rolActual = auth.rol();
    if (rolActual && rolesPermitidos.includes(rolActual)) {
      return true;
    }

    return router.parseUrl('/sin-permiso');
  };
};

export const permisoGuard = (permiso: ClavePermisoAdmin): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.esperarInicializacion();

    if (!auth.estaAutenticado()) {
      return router.parseUrl('/auth/login');
    }

    if (auth.tienePermiso(permiso)) {
      return true;
    }

    return router.parseUrl('/sin-permiso');
  };
};