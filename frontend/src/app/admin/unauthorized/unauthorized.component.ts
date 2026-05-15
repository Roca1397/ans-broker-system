import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="unauthorized">
      <div class="icon">
        <svg viewBox="0 0 64 64" fill="none" width="64" height="64">
          <circle cx="32" cy="32" r="30" stroke="#F97316" stroke-width="3"/>
          <path d="M32 20v16M32 40h.01" stroke="#F97316" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h1>Acceso no autorizado</h1>
      <p>No tienes permisos para ver esta sección. Solo los administradores pueden acceder a esta área.</p>
      <a routerLink="/dashboard" class="btn btn-primary">Volver al Dashboard</a>
    </div>
  `,
  styles: [`
    .unauthorized {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 60vh; text-align: center; gap: 18px; padding: 40px;
    }
    .icon { margin-bottom: 8px; }
    h1 { font-size: 1.6rem; color: var(--text-primary); margin: 0; }
    p { color: var(--text-muted); font-size: 0.95rem; max-width: 420px; line-height: 1.6; margin: 0; }
    .btn { display: inline-flex; align-items: center; padding: 10px 22px; border-radius: var(--radius); font-size: 0.9rem; font-weight: 600; text-decoration: none; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { opacity: 0.9; }
  `],
})
export class UnauthorizedComponent {}
