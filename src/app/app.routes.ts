import { Routes } from '@angular/router';
import { adminGuard, authGuard, invitadoGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inventario' },
      {
        path: 'inventario',
        loadComponent: () => import('./pages/inventario/inventario').then((m) => m.Inventario),
      },
      {
        path: 'inventario/nuevo',
        loadComponent: () => import('./pages/equipo-form/equipo-form').then((m) => m.EquipoForm),
      },
      {
        path: 'inventario/:id',
        loadComponent: () => import('./pages/equipo-detalle/equipo-detalle').then((m) => m.EquipoDetalle),
      },
      {
        path: 'inventario/:id/editar',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/equipo-form/equipo-form').then((m) => m.EquipoForm),
      },
      {
        path: 'ingreso',
        loadComponent: () => import('./pages/ingreso/ingreso').then((m) => m.Ingreso),
      },
      {
        path: 'escanear',
        loadComponent: () => import('./pages/escanear/escanear').then((m) => m.Escanear),
      },
      {
        path: 'lote',
        loadComponent: () => import('./pages/lote/lote').then((m) => m.Lote),
      },
      {
        path: 'movimientos',
        loadComponent: () => import('./pages/movimientos/movimientos').then((m) => m.Movimientos),
      },
      {
        path: 'eliminados',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/eliminados/eliminados').then((m) => m.Eliminados),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./pages/cuenta/cuenta').then((m) => m.Cuenta),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];