import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-bg">
        <div class="bg-grid"></div>
        <div class="bg-orb orb1"></div>
      </div>
      <div class="auth-panel">
        <div class="brand">
          <span class="brand-icon">⬡</span>
          <div>
            <h2>ANS Broker</h2>
            <span>Crear nueva cuenta</span>
          </div>
        </div>
        <div class="auth-card">
          <h1>Registro</h1>
          <p class="subtitle">Crea tu cuenta para acceder al sistema</p>

          <div *ngIf="success" class="alert alert-success">✅ Cuenta creada. <a routerLink="/login">Inicia sesión</a></div>
          <div *ngIf="error" class="alert alert-danger">⚠ {{ error }}</div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label>Nombre Completo</label>
              <input type="text" formControlName="full_name" placeholder="Juan Pérez" />
            </div>
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input type="email" formControlName="email" placeholder="usuario@broker.com" />
            </div>
            <div class="form-group">
              <label>Contraseña</label>
              <input type="password" formControlName="password" placeholder="Mín. 8 caracteres" />
            </div>
            <button type="submit" class="btn btn-primary w-full btn-lg" [disabled]="loading || form.invalid">
              {{ loading ? 'Creando cuenta...' : 'Crear Cuenta' }}
            </button>
          </form>
          <p class="auth-link">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: var(--bg-base); }
    .auth-bg { position: absolute; inset: 0; pointer-events: none; }
    .bg-grid { position: absolute; inset: 0; background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 40px 40px; opacity: 0.3; }
    .bg-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.12; }
    .orb1 { width: 500px; height: 500px; background: var(--primary); top: -150px; left: -150px; }
    .auth-panel { position: relative; width: 100%; max-width: 420px; padding: 20px; }
    .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 32px; h2 { font-size: 1.25rem; margin: 0; } span { color: var(--text-muted); font-size: 0.8rem; } }
    .brand-icon { font-size: 2rem; color: var(--primary); }
    .auth-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 36px; box-shadow: var(--shadow); h1 { font-size: 1.5rem; margin-bottom: 6px; } .subtitle { color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 28px; } }
    .auth-link { text-align: center; margin-top: 24px; font-size: 0.875rem; color: var(--text-secondary); a { color: var(--primary); text-decoration: none; } }
  `],
})
export class RegisterComponent {
  form: FormGroup;
  loading = false;
  error = '';
  success = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.auth.register(this.form.value).subscribe({
      next: () => { this.success = true; this.loading = false; },
      error: (err) => { this.error = err.error?.detail || 'Error al registrar'; this.loading = false; },
    });
  }
}
