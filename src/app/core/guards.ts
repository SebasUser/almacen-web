import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Exige sesión iniciada; si no, manda al login recordando a dónde iba. */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

/** Exige rol ADMIN (lo usaremos en el panel de usuarios). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.esAdmin() ? true : router.createUrlTree(['/inventario']);
};

/** El login solo se muestra a quien aún no inició sesión. */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() ? router.createUrlTree(['/inventario']) : true;
};