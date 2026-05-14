import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-shell">

      <!-- Left brand panel -->
      <div class="brand-panel">
        <div class="brand-glow"></div>
        <div class="brand-grid"></div>

        <div class="brand-content">
          <!-- Logo -->
          <div class="brand-logo">
            <img src="assets/images/logo.png" alt="SLAGuardian" class="shield-svg" />
            <div class="brand-name">
              <span class="brand-title"><span class="cyan">SLA</span>Guardian</span>
              <span class="brand-sub">ANS Broker System</span>
            </div>
          </div>

          <!-- Feature highlights -->
          <div class="brand-features">
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <circle cx="10" cy="10" r="8" stroke="#00C8D7" stroke-width="1.8"/>
                  <path d="M10 6v4l3 3" stroke="#00C8D7" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <strong>Monitoreo en tiempo real</strong>
                <p>Seguimiento de ANS con alertas automáticas</p>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <path d="M3 14l4-4 3 3 4-5 3 3" stroke="#00C8D7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <div>
                <strong>Predicción inteligente</strong>
                <p>Modelo ML para anticipar incumplimientos</p>
              </div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <path d="M4 4h12v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="#00C8D7" stroke-width="1.8"/>
                  <path d="M8 9h4M8 12h2" stroke="#00C8D7" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </div>
              <div>
                <strong>Integración Outlook</strong>
                <p>Visualiza tus solicitudes en tiempo real</p>
              </div>
            </div>
          </div>
                </div>
      </div>

      <!-- Right form panel -->
      <div class="form-panel">
        <div class="form-inner">
          <div class="form-header">
            <h1>Bienvenido</h1>
            <p class="form-subtitle">Inicia sesión para acceder a tu panel de control</p>
          </div>

          <div *ngIf="error" class="alert alert-danger">
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M10 7v4M10 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            {{ error }}
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Correo Electrónico</label>
              <div class="input-icon-wrap">
                <svg class="input-icon" viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M2 7l8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <input id="email" type="email" formControlName="email" placeholder="usuario@broker.com" />
              </div>
            </div>

            <div class="form-group">
              <label for="password">Contraseña</label>
              <div class="input-icon-wrap">
                <svg class="input-icon" viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/>
                  <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <input id="password" [type]="showPass ? 'text' : 'password'" formControlName="password" placeholder="••••••••" />
                <button type="button" class="eye-btn" (click)="showPass = !showPass" tabindex="-1">
                  <svg *ngIf="!showPass" viewBox="0 0 20 20" fill="none" width="15" height="15">
                    <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.8"/>
                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.8"/>
                  </svg>
                  <svg *ngIf="showPass" viewBox="0 0 20 20" fill="none" width="15" height="15">
                    <path d="M3 3l14 14M8.5 8.7A3 3 0 0013.3 13M6.2 6.4C4 7.8 2.3 9.7 1 10c2 3 5 6 9 6a9 9 0 004-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path d="M11.5 4.6A9 9 0 0119 10c-.8.9-2 2.1-3.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" class="btn-submit" [disabled]="loading || form.invalid">
              <span *ngIf="loading" class="spinner-sm"></span>
              <svg *ngIf="!loading" viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.8"/>
                <path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ loading ? 'Ingresando...' : 'Iniciar Sesión' }}
            </button>
          </form>

          <p class="auth-link">
            ¿No tienes cuenta? <a routerLink="/register">Regístrate aquí</a>
          </p>

          <div class="demo-hint">
                        <span>Demo:</span> admin&#64;broker.com / 12345678
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      display: flex;
    }

    /* ── Left brand panel ────────────────────────────────── */
    .brand-panel {
      width: 480px; flex-shrink: 0;
      background: #0B2545;
      display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    @media (max-width: 900px) { .brand-panel { display: none; } }

    .brand-glow {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(ellipse 80% 60% at 50% 20%, rgba(0,200,215,.18) 0%, transparent 70%),
                  radial-gradient(ellipse 60% 50% at 50% 85%, rgba(249,115,22,.12) 0%, transparent 70%);
    }
    .brand-grid {
      position: absolute; inset: 0; pointer-events: none;
      background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .brand-content {
      position: relative; z-index: 1;
      padding: 48px; display: flex; flex-direction: column; gap: 48px;
    }

    .brand-logo { display: flex; align-items: center; gap: 18px; }
    .shield-svg { width: 64px; height: 64px; flex-shrink: 0; object-fit: contain; }
    .brand-name { display: flex; flex-direction: column; }
    .brand-title { font-size: 1.8rem; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .cyan { color: #00C8D7; }
    .brand-sub { font-size: 0.8rem; color: rgba(255,255,255,.45); margin-top: 3px; letter-spacing: 0.3px; }

    .brand-features { display: flex; flex-direction: column; gap: 22px; }
    .feature-item {
      display: flex; align-items: flex-start; gap: 14px; color: rgba(255,255,255,.75);
    }
    .feature-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(0,200,215,.12); border: 1px solid rgba(0,200,215,.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .feature-item strong { display: block; color: #fff; font-size: 0.9rem; font-weight: 600; margin-bottom: 3px; }
    .feature-item p { font-size: 0.8rem; color: rgba(255,255,255,.5); margin: 0; line-height: 1.4; }

    .brand-footer { font-size: 0.72rem; color: rgba(255,255,255,.25); }

    /* ── Right form panel ────────────────────────────────── */
    .form-panel {
      flex: 1; display: flex; align-items: center; justify-content: center;
      background: var(--bg-base); padding: 40px 20px;
    }
    .form-inner { width: 100%; max-width: 400px; }

    .form-header { margin-bottom: 32px; }
    .form-header h1 { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
    .form-subtitle { font-size: 0.9rem; color: var(--text-secondary); }

    /* Inputs */
    .input-icon-wrap { position: relative; }
    .input-icon {
      position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted); pointer-events: none;
    }
    .input-icon-wrap input { padding-left: 38px; padding-right: 12px; }
    .input-icon-wrap input:last-child { padding-right: 42px; }

    .eye-btn {
      position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--text-muted);
      display: flex; align-items: center; padding: 3px;
      border-radius: 4px; transition: color .15s;
    }
    .eye-btn:hover { color: var(--text-primary); }

    /* Submit button */
    .btn-submit {
      width: 100%; padding: 12px 20px; margin-top: 8px;
      background: #0B2545;
      color: #fff; font-size: 0.95rem; font-weight: 600;
      border: none; border-radius: var(--radius); cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background .2s, transform .1s, box-shadow .2s;
      box-shadow: 0 4px 14px rgba(11,37,69,.25);
    }
    .btn-submit:hover:not(:disabled) {
      background: #0d2d57;
      box-shadow: 0 6px 20px rgba(11,37,69,.35);
    }
    .btn-submit:active:not(:disabled) { transform: translateY(1px); }
    .btn-submit:disabled { opacity: .55; cursor: not-allowed; }

    /* Auth link */
    .auth-link {
      text-align: center; margin-top: 20px;
      font-size: 0.875rem; color: var(--text-secondary);
    }
    .auth-link a { color: #00C8D7; text-decoration: none; font-weight: 500; }
    .auth-link a:hover { text-decoration: underline; }

    /* Demo hint */
    .demo-hint {
      display: flex; align-items: center; gap: 7px;
      margin-top: 20px; padding: 10px 14px;
      font-size: 0.78rem; color: var(--text-muted);
      background: var(--bg-surface); border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .demo-hint span { color: var(--text-primary); font-weight: 600; }

    /* Spinner */
    .spinner-sm {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin .8s linear infinite; display: inline-block; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class LoginComponent {
  form: FormGroup;
  loading = false;
  error = '';
  showPass = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.detail || 'Error al iniciar sesión';
        this.loading = false;
      },
    });
  }
}
