import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for startup user-refresh so the role is always current from DB.
  await auth.isReady$;

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  if (auth.isAdmin()) {
    return true;
  }
  return router.createUrlTree(['/admin/unauthorized']);
};
