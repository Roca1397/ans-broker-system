import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * ARCHIVO NUEVO: frontend/src/app/guards/admin.guard.ts
 *
 * Sólo permite el paso a usuarios con rol = 'admin'.
 * Si no es admin redirige al dashboard (no al login, porque ya está logueado).
 */
export const adminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.isAdmin()) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
