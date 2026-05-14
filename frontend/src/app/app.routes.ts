/**
 * REEMPLAZA: frontend/src/app/app.routes.ts
 * Cambios respecto a v1: agregadas rutas /admin/* protegidas por adminGuard
 */
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'solicitudes',
        loadComponent: () => import('./solicitudes/lista/lista.component').then(m => m.ListaSolicitudesComponent),
      },
      {
        path: 'solicitudes/nueva',
        loadComponent: () => import('./solicitudes/nueva/nueva.component').then(m => m.NuevaSolicitudComponent),
      },
      {
        path: 'solicitudes/carga-masiva',
        loadComponent: () => import('./solicitudes/carga-masiva/carga-masiva.component').then(m => m.CargaMasivaComponent),
      },
      {
        path: 'predicciones',
        loadComponent: () => import('./solicitudes/predicciones/predicciones.component').then(m => m.PrediccionesComponent),
      },
      // ── Sólo admin ──────────────────────────────────────────
      {
        path: 'admin/clientes-remitentes',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/clientes-remitentes/clientes-remitentes.component').then(m => m.ClientesRemitentesComponent),
      },
      {
        path: 'admin/catalogos',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/catalogos/catalogos.component').then(m => m.AdminCatalogosComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
