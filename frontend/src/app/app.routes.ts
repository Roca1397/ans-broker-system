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
        path: 'predicciones',
        loadComponent: () => import('./solicitudes/predicciones/predicciones.component').then(m => m.PrediccionesComponent),
      },

      // ── Sólo admin ──────────────────────────────────────────────
      {
        path: 'admin/unauthorized',
        loadComponent: () => import('./admin/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
      },
      {
        path: 'admin/clientes-remitentes',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/clientes-remitentes/clientes-remitentes.component').then(m => m.ClientesRemitentesComponent),
      },

      // Catálogos simples: comparten el mismo componente genérico, cada uno con su configuración
      {
        path: 'admin/tipos-solicitud',
        canActivate: [adminGuard],
        data: { catalog: { key: 'tipos-solicitud', label: 'Tipos de solicitud', hint: 'Inclusión, Exclusión, Renovación, Emisión...' } },
        loadComponent: () => import('./admin/catalogo-simple/catalogo-simple.component').then(m => m.CatalogoSimpleComponent),
      },
      {
        path: 'admin/estados',
        canActivate: [adminGuard],
        data: { catalog: { key: 'estados-solicitud', label: 'Estados', hint: 'Pendiente, En Proceso, Finalizado...' } },
        loadComponent: () => import('./admin/catalogo-simple/catalogo-simple.component').then(m => m.CatalogoSimpleComponent),
      },
      {
        path: 'admin/prioridades',
        canActivate: [adminGuard],
        data: { catalog: { key: 'prioridades', label: 'Prioridades', hint: 'Baja, Media, Alta...' } },
        loadComponent: () => import('./admin/catalogo-simple/catalogo-simple.component').then(m => m.CatalogoSimpleComponent),
      },
      {
        path: 'admin/ramos',
        canActivate: [adminGuard],
        data: { catalog: { key: 'ramos', label: 'Ramos', hint: 'EPS, FOLA, SCTR-S, SCTR-P...' } },
        loadComponent: () => import('./admin/catalogo-simple/catalogo-simple.component').then(m => m.CatalogoSimpleComponent),
      },
      {
        path: 'admin/clientes',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/clientes/clientes.component').then(m => m.AdminClientesComponent),
      },
      {
        path: 'admin/aseguradoras',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/aseguradoras/aseguradoras.component').then(m => m.AdminAseguradorasComponent),
      },
      {
        path: 'admin/usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/usuarios/usuarios.component').then(m => m.AdminUsuariosComponent),
      },
    ],
  },
  { path: '**', redirectTo: '/dashboard' },
];
