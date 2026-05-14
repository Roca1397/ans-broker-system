import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AlertasService } from '../../services/api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout" [class.sidebar-collapsed]="collapsed()">

      <!-- ── SIDEBAR ────────────────────────────────────────────── -->
      <aside class="sidebar">

        <!-- Logo -->
        <div class="sidebar-header">
          <div class="logo">
            <img src="assets/images/logo.png" alt="SLAGuardian" class="logo-svg" />
            <div class="logo-text" *ngIf="!collapsed()">
              <span class="logo-title"><span class="logo-sla">SLA</span>Guardian</span>
              <span class="logo-sub">ANS Broker System</span>
            </div>
          </div>
          <button class="collapse-btn" (click)="collapsed.set(!collapsed())" [title]="collapsed() ? 'Expandir' : 'Colapsar'">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path *ngIf="!collapsed()" d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path *ngIf="collapsed()" d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <!-- Nav -->
        <nav class="sidebar-nav">
          <div class="nav-section" *ngIf="!collapsed()">Operación</div>

          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Dashboard' : ''">
            <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".7"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity=".7"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".7"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity=".7"/>
            </svg>
            <span class="nav-label" *ngIf="!collapsed()">Dashboard</span>
          </a>

          <a routerLink="/solicitudes" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="nav-item" [title]="collapsed() ? 'Solicitudes' : ''">
            <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
              <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="nav-label" *ngIf="!collapsed()">Solicitudes</span>
          </a>

          <a routerLink="/solicitudes/nueva" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Nueva Solicitud' : ''">
            <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M10 6v8M6 10h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="nav-label" *ngIf="!collapsed()">Nueva Solicitud</span>
          </a>

          <a routerLink="/solicitudes/carga-masiva" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Carga Masiva' : ''">
            <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v10M6 8l4-5 4 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="nav-label" *ngIf="!collapsed()">Carga Masiva</span>
          </a>

          <a routerLink="/predicciones" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Predicciones' : ''">
            <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M10 6v4l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <span class="nav-label" *ngIf="!collapsed()">Predicciones</span>
          </a>

          <ng-container *ngIf="auth.isAdmin()">
            <div class="nav-divider"></div>
            <div class="nav-section" *ngIf="!collapsed()">Administración</div>

            <a routerLink="/admin/clientes-remitentes" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Cliente · Remitente' : ''">
              <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
                <circle cx="8" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M2 17c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M14 4a3 3 0 010 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M17 17a6 6 0 00-3-5.19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="nav-label" *ngIf="!collapsed()">Cliente · Remitente</span>
            </a>

            <a routerLink="/admin/catalogos" routerLinkActive="active" class="nav-item" [title]="collapsed() ? 'Catálogos' : ''">
              <svg class="nav-icon" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.8"/>
                <path d="M10 2v2m0 12v2M2 10h2m12 0h2m-3.17-5.66L12 6.17M8 13.83l-1.83 1.83M3.17 14.83L5 13m8-6 1.83-1.83" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="nav-label" *ngIf="!collapsed()">Catálogos</span>
            </a>
          </ng-container>
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer" *ngIf="!collapsed()">
          <div class="user-info">
            <div class="user-avatar">{{ userInitials() }}</div>
            <div class="user-details">
              <span class="user-name">{{ auth.currentUser()?.full_name }}</span>
              <span class="user-role">{{ auth.currentUser()?.role }}</span>
            </div>
          </div>
          <button class="btn-logout" (click)="auth.logout()">
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M13 14l3-4-3-4M16 10H8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Cerrar sesión
          </button>
        </div>

        <!-- Collapsed footer: just avatar -->
        <div class="sidebar-footer-collapsed" *ngIf="collapsed()">
          <div class="user-avatar" [title]="auth.currentUser()?.full_name || ''">{{ userInitials() }}</div>
        </div>
      </aside>

      <!-- ── MAIN AREA ──────────────────────────────────────────── -->
      <div class="main-area">
        <header class="topbar">
          <button class="mobile-menu-btn" (click)="collapsed.set(!collapsed())">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>

          <div class="topbar-right">
            <button class="topbar-icon-btn" (click)="toggleAlerts()" [class.has-alerts]="alertCount > 0" title="Alertas">
              <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 16a2 2 0 004 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span class="alert-badge" *ngIf="alertCount > 0">{{ alertCount }}</span>
            </button>

            <div class="topbar-divider"></div>

            <div class="user-pill" *ngIf="auth.currentUser() as user">
              <div class="user-avatar-sm">{{ userInitials() }}</div>
              <div class="user-pill-info">
                <span class="user-pill-name">{{ user.full_name }}</span>
                <span class="user-pill-role">{{ user.role }}</span>
              </div>
            </div>

            <button class="btn-topbar-logout" (click)="auth.logout()" title="Salir">
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M13 14l3-4-3-4M16 10H8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Alert panel -->
        <div class="alert-panel" *ngIf="showAlerts" (click)="showAlerts = false">
          <div class="alert-panel-inner" (click)="$event.stopPropagation()">
            <div class="alert-panel-header">
              <div class="alert-panel-title">
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M8 16a2 2 0 004 0" stroke="currentColor" stroke-width="1.8"/>
                </svg>
                Alertas
                <span class="alert-panel-count" *ngIf="alertCount > 0">{{ alertCount }} sin leer</span>
              </div>
              <button class="btn btn-sm btn-outline" (click)="markAllRead()">Marcar todas leídas</button>
            </div>
            <div *ngFor="let a of alertas" class="alert-item" [class.unread]="!a.leida" [class.critico]="a.tipo === 'critico'">
              <div class="alert-item-icon" [class.critico]="a.tipo === 'critico'">
                <svg *ngIf="a.tipo === 'critico'" viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <path d="M10 3L2 17h16L10 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  <path d="M10 9v4M10 15h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <svg *ngIf="a.tipo !== 'critico'" viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M10 7v4M10 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <p>{{ a.mensaje }}</p>
                <small>{{ a.numero_solicitud }}</small>
              </div>
            </div>
            <div *ngIf="alertas.length === 0" class="empty-state" style="padding: 30px">
              <p>No hay alertas pendientes</p>
            </div>
          </div>
        </div>

        <main class="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* ── Layout shell ────────────────────────────────────────── */
    .layout { display: flex; min-height: 100vh; background: var(--bg-base); }

    /* ── Sidebar ─────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-width);
      background: #0B2545;
      display: flex; flex-direction: column;
      position: fixed; left: 0; top: 0; bottom: 0; z-index: 100;
      transition: width 0.25s cubic-bezier(.4,0,.2,1);
      overflow: hidden;
      box-shadow: 3px 0 20px rgba(0,0,0,.18);
    }
    .layout.sidebar-collapsed .sidebar  { width: 64px; }
    .layout.sidebar-collapsed .main-area { margin-left: 64px; }

    /* Logo header */
    .sidebar-header {
      padding: 18px 16px;
      display: flex; align-items: center; justify-content: space-between;
      min-height: var(--header-height);
      background: rgba(0,0,0,.15);
      border-bottom: 1px solid rgba(255,255,255,.06);
    }
    .logo { display: flex; align-items: center; gap: 11px; overflow: hidden; min-width: 0; }
    .logo-svg { width: 36px; height: 36px; flex-shrink: 0; object-fit: contain; }
    .logo-text { display: flex; flex-direction: column; min-width: 0; }
    .logo-title {
      font-weight: 700; font-size: 1rem; color: #fff;
      white-space: nowrap; letter-spacing: -0.2px;
    }
    .logo-sla { color: #00C8D7; }
    .logo-sub { font-size: 0.67rem; color: rgba(255,255,255,.45); white-space: nowrap; margin-top: 1px; }

    .collapse-btn {
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1);
      color: rgba(255,255,255,.7); cursor: pointer;
      padding: 5px 7px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .collapse-btn:hover { background: rgba(255,255,255,.16); color: #fff; }

    /* Nav */
    .sidebar-nav { flex: 1; padding: 10px 0; overflow-y: auto; overflow-x: hidden; }
    .sidebar-nav::-webkit-scrollbar { width: 3px; }
    .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 2px; }

    .nav-section {
      padding: 14px 20px 5px; font-size: 0.68rem; letter-spacing: 1.2px;
      text-transform: uppercase; color: rgba(255,255,255,.32); font-weight: 600;
    }
    .nav-divider { margin: 8px 16px; border-top: 1px solid rgba(255,255,255,.07); }

    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 20px; color: rgba(255,255,255,.6); text-decoration: none;
      font-size: 0.875rem; font-weight: 500;
      white-space: nowrap; border-left: 3px solid transparent;
      transition: color .15s, background .15s, border-color .15s;
    }
    .nav-item:hover {
      color: rgba(255,255,255,.9);
      background: rgba(255,255,255,.06);
    }
    .nav-item.active {
      color: #00C8D7;
      background: rgba(0,200,215,.1);
      border-left-color: #00C8D7;
      font-weight: 600;
    }
    .nav-item.active .nav-icon { color: #00C8D7; }
    .nav-icon { width: 18px; height: 18px; flex-shrink: 0; }

    /* Sidebar footer */
    .sidebar-footer {
      padding: 14px 16px; border-top: 1px solid rgba(255,255,255,.07);
      display: flex; flex-direction: column; gap: 10px;
      background: rgba(0,0,0,.12);
    }
    .sidebar-footer-collapsed {
      padding: 14px 0; border-top: 1px solid rgba(255,255,255,.07);
      display: flex; justify-content: center; background: rgba(0,0,0,.12);
    }
    .user-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .user-avatar {
      width: 34px; height: 34px; background: #00C8D7; color: #0B2545;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 0.78rem; font-weight: 700; flex-shrink: 0; cursor: default;
    }
    .user-details { display: flex; flex-direction: column; min-width: 0; }
    .user-name { font-size: 0.83rem; font-weight: 600; color: rgba(255,255,255,.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 0.7rem; color: rgba(255,255,255,.4); text-transform: capitalize; }
    .btn-logout {
      display: flex; align-items: center; gap: 7px;
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
      color: rgba(255,255,255,.55); font-size: 0.8rem; font-weight: 500;
      padding: 7px 12px; border-radius: 7px; cursor: pointer;
      transition: background .15s, color .15s; width: 100%; justify-content: center;
    }
    .btn-logout:hover { background: rgba(249,115,22,.15); border-color: rgba(249,115,22,.4); color: #F97316; }

    /* ── Main area ────────────────────────────────────────────── */
    .main-area {
      margin-left: var(--sidebar-width); flex: 1;
      display: flex; flex-direction: column;
      transition: margin-left 0.25s cubic-bezier(.4,0,.2,1);
      min-width: 0;
    }

    /* Topbar */
    .topbar {
      height: var(--header-height);
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; position: sticky; top: 0; z-index: 50;
      box-shadow: 0 1px 8px rgba(11,37,69,.05);
    }
    .topbar-right { display: flex; align-items: center; gap: 8px; }
    .mobile-menu-btn {
      display: none; background: none; border: none;
      color: var(--text-secondary); cursor: pointer; padding: 4px;
      border-radius: 6px;
    }
    .mobile-menu-btn:hover { background: var(--bg-hover); }

    .topbar-icon-btn {
      position: relative; background: none; border: none;
      color: var(--text-secondary); cursor: pointer;
      padding: 7px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, color .15s;
    }
    .topbar-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
    .topbar-icon-btn.has-alerts { color: #F97316; }
    .alert-badge {
      position: absolute; top: 2px; right: 2px;
      background: #F97316; color: #fff;
      font-size: 0.6rem; font-weight: 700;
      min-width: 15px; height: 15px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 3px; border: 1.5px solid var(--bg-card);
    }

    .topbar-divider { width: 1px; height: 24px; background: var(--border); margin: 0 4px; }

    .user-pill { display: flex; align-items: center; gap: 9px; }
    .user-avatar-sm {
      width: 30px; height: 30px;
      background: linear-gradient(135deg, #0B2545 0%, #00C8D7 100%);
      color: #fff; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 700; flex-shrink: 0;
    }
    .user-pill-info { display: flex; flex-direction: column; }
    .user-pill-name { font-size: 0.83rem; font-weight: 600; color: var(--text-primary); line-height: 1.2; }
    .user-pill-role { font-size: 0.68rem; color: var(--text-muted); text-transform: capitalize; }

    .btn-topbar-logout {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: 7px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, color .15s;
    }
    .btn-topbar-logout:hover { background: rgba(249,115,22,.1); color: #F97316; }

    /* Alert panel */
    .alert-panel { position: fixed; inset: 0; z-index: 200; background: rgba(11,37,69,.25); backdrop-filter: blur(2px); }
    .alert-panel-inner {
      position: absolute; right: 20px; top: calc(var(--header-height) + 6px);
      width: 360px; max-height: 500px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow);
      overflow-y: auto; display: flex; flex-direction: column;
    }
    .alert-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; background: var(--bg-card); z-index: 1;
    }
    .alert-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.95rem; font-weight: 600; color: var(--text-primary);
    }
    .alert-panel-count { font-size: 0.72rem; font-weight: 600; color: #F97316; background: rgba(249,115,22,.1); padding: 2px 8px; border-radius: 10px; }

    .alert-item {
      display: flex; gap: 11px; align-items: flex-start;
      padding: 13px 16px; border-bottom: 1px solid var(--border);
      font-size: 0.8rem; color: var(--text-secondary);
      transition: background .1s;
    }
    .alert-item:last-child { border-bottom: none; }
    .alert-item:hover { background: var(--bg-hover); }
    .alert-item p { color: var(--text-primary); margin-bottom: 3px; font-size: 0.82rem; line-height: 1.4; }
    .alert-item small { color: var(--text-muted); font-size: 0.72rem; }
    .alert-item.unread { background: rgba(0,200,215,.04); }
    .alert-item-icon {
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(0,200,215,.12); color: #00C8D7;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
    }
    .alert-item-icon.critico { background: rgba(249,115,22,.12); color: #F97316; }
    .alert-item.critico { border-left: 3px solid #F97316; }

    /* Main content */
    .main-content { flex: 1; padding: 28px; overflow-y: auto; background: var(--bg-base); }

    /* Mobile */
    @media (max-width: 768px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); }
      .main-area { margin-left: 0 !important; }
      .mobile-menu-btn { display: flex; }
      .user-pill-info { display: none; }
    }
  `],
})
export class LayoutComponent {
  collapsed = signal(false);
  showAlerts = false;
  alertCount = 0;
  alertas: any[] = [];

  constructor(public auth: AuthService, private alertasService: AlertasService) {
    this.loadAlerts();
  }

  userInitials(): string {
    const name = this.auth.currentUser()?.full_name || '';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  loadAlerts() {
    this.alertasService.listar(true).subscribe({
      next: (data) => {
        this.alertas = data;
        this.alertCount = data.filter((a: any) => !a.leida).length;
      },
      error: () => {},
    });
  }

  toggleAlerts() {
    this.showAlerts = !this.showAlerts;
    if (this.showAlerts) this.loadAlerts();
  }

  markAllRead() {
    this.alertasService.marcarTodasLeidas().subscribe(() => this.loadAlerts());
  }
}
