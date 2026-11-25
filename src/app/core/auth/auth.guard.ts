import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../models/database.types';
import { AuthService } from './auth.service';

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
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const rolActual = auth.rol();

    if (rolActual && rolesPermitidos.includes(rolActual)) {
      return true;
    }

    // Si no tiene el rol, redirige a inicio
    return router.parseUrl('/');
  };
};