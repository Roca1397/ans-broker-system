import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/api.service';
import { User } from '../../models/models';

type FormMode = 'create' | 'edit';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Usuarios</h1>
        <p class="muted">Gestión de cuentas del sistema</p>
      </div>
      <button class="btn btn-primary" (click)="openCreate()">+ Nuevo usuario</button>
    </div>

    <!-- Error general -->
    <div *ngIf="loadError()" class="alert-error">{{ loadError() }}</div>

    <!-- Tabla -->
    <div class="card table-card">
      <div *ngIf="loading()" class="loading-state">
        <div class="spinner"></div><p>Cargando usuarios...</p>
      </div>

      <div class="table-wrapper" *ngIf="!loading()">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of usuarios()">
              <td class="cell-name">{{ u.full_name }}</td>
              <td class="cell-email">{{ u.email }}</td>
              <td>
                <span class="role-badge" [class]="rolClass(u.role)">{{ rolLabel(u.role) }}</span>
              </td>
              <td>
                <span class="status-badge" [class]="u.is_active ? 'status-active' : 'status-inactive'">
                  {{ u.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="cell-actions">
                <button class="btn-icon-sm" (click)="openEdit(u)" title="Editar">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <path d="M4 13.5V16h2.5l7.37-7.37-2.5-2.5L4 13.5zM15.71 6.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                  </svg>
                </button>
                <button class="btn-icon-sm danger" (click)="toggleActive(u)"
                        [title]="u.is_active ? 'Desactivar' : 'Activar'">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.8"/>
                    <path *ngIf="u.is_active" d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    <path *ngIf="!u.is_active" d="M7 10h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </button>
                <button class="btn-icon-sm danger" (click)="deleteUsuario(u)" title="Eliminar">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                    <path d="M3 5h14M8 5V3h4v2M6 5v11a1 1 0 001 1h6a1 1 0 001-1V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                </button>
              </td>
            </tr>
            <tr *ngIf="usuarios().length === 0">
              <td colspan="5" class="empty-cell">No hay usuarios registrados.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal de formulario -->
    <div class="modal-overlay" *ngIf="showForm()" (click)="closeForm()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ mode === 'create' ? 'Nuevo usuario' : 'Editar usuario' }}</h3>
          <button class="btn-close" (click)="closeForm()">✕</button>
        </div>

        <div class="modal-body">
          <div *ngIf="formError()" class="form-error">{{ formError() }}</div>

          <div class="field">
            <label>Nombre completo</label>
            <input type="text" [(ngModel)]="form.full_name" placeholder="Juan Pérez" />
          </div>
          <div class="field">
            <label>Correo electrónico</label>
            <input type="email" [(ngModel)]="form.email" placeholder="juan@broker.com"
                   [disabled]="mode === 'edit'" />
          </div>
          <div class="field">
            <label>{{ mode === 'create' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)' }}</label>
            <input type="password" [(ngModel)]="form.password"
                   [placeholder]="mode === 'create' ? 'Mín. 8 caracteres' : 'Sin cambios'" />
          </div>
          <div class="field">
            <label>Rol</label>
            <select [(ngModel)]="form.role">
              <option value="ejecutivo">Ejecutivo</option>
              <option value="administrador">Administrador</option>
            </select>
          </div>
          <div class="field field-check">
            <label class="check-label">
              <input type="checkbox" [(ngModel)]="form.is_active" />
              Cuenta activa
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" (click)="closeForm()">Cancelar</button>
          <button class="btn btn-primary" (click)="submit()" [disabled]="saving()">
            <div *ngIf="saving()" class="btn-spinner"></div>
            {{ saving() ? 'Guardando...' : (mode === 'create' ? 'Crear usuario' : 'Guardar cambios') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 4px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }

    .alert-error { background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); color: var(--danger); padding: 10px 14px; border-radius: var(--radius); margin-bottom: 14px; font-size: 0.83rem; }

    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
    thead th { text-align: left; padding: 10px 14px; background: var(--bg-surface); border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    tbody td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text-primary); }
    .col-actions { width: 100px; }
    .cell-name { font-weight: 500; }
    .cell-email { color: var(--text-secondary); font-size: 0.8rem; }
    .cell-actions { display: flex; gap: 6px; align-items: center; }
    .empty-cell { text-align: center; padding: 40px; color: var(--text-muted); }

    .role-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
    .role-admin { background: rgba(0,90,158,0.12); color: var(--primary); }
    .role-exec  { background: rgba(16,185,129,0.12); color: var(--success); }

    .status-badge { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
    .status-active   { background: rgba(16,185,129,0.12); color: var(--success); }
    .status-inactive { background: rgba(100,100,100,0.12); color: var(--text-muted); }

    .btn-icon-sm {
      width: 28px; height: 28px; border-radius: 6px;
      border: 1px solid var(--border); background: none;
      color: var(--text-muted); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .btn-icon-sm:hover { background: var(--bg-hover); color: var(--text-primary); }
    .btn-icon-sm.danger:hover { background: rgba(255,76,76,0.1); border-color: var(--danger); color: var(--danger); }

    .loading-state { padding: 60px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; z-index: 400; background: rgba(11,37,69,0.35); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; }
    .modal-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); width: min(460px, 95vw); box-shadow: 0 12px 40px rgba(11,37,69,0.18); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .modal-header h3 { font-size: 1rem; color: var(--text-primary); margin: 0; }
    .btn-close { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 4px 8px; border-radius: 4px; }
    .btn-close:hover { background: var(--bg-hover); }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .modal-footer { padding: 14px 20px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted); }
    .field input, .field select { padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; color: var(--text-primary); background: var(--bg-base); font-family: inherit; }
    .field input:focus, .field select:focus { outline: none; border-color: var(--primary); }
    .field input:disabled { opacity: 0.55; cursor: not-allowed; }
    .field-check { flex-direction: row; align-items: center; }
    .check-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-primary); cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .check-label input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; }

    .form-error { background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); color: var(--danger); padding: 8px 12px; border-radius: var(--radius); font-size: 0.8rem; }
    .btn-spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; margin-right: 4px; }
  `],
})
export class AdminUsuariosComponent implements OnInit {
  usuarios  = signal<User[]>([]);
  loading   = signal(true);
  saving    = signal(false);
  showForm  = signal(false);
  loadError = signal<string | null>(null);
  formError = signal<string | null>(null);

  mode: FormMode = 'create';
  editingId: string | null = null;

  form: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    is_active: boolean;
  } = { full_name: '', email: '', password: '', role: 'ejecutivo', is_active: true };

  constructor(private admin: AdminService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.admin.listUsuarios().subscribe({
      next: (data) => { this.usuarios.set(data); this.loading.set(false); },
      error: (err) => { this.loadError.set(err?.error?.detail || 'Error cargando usuarios'); this.loading.set(false); },
    });
  }

  openCreate() {
    this.mode = 'create';
    this.editingId = null;
    this.form = { full_name: '', email: '', password: '', role: 'ejecutivo', is_active: true };
    this.formError.set(null);
    this.showForm.set(true);
  }

  openEdit(u: User) {
    this.mode = 'edit';
    this.editingId = u.id;
    this.form = { full_name: u.full_name, email: u.email, password: '', role: u.role, is_active: u.is_active };
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); this.formError.set(null); }

  submit() {
    this.formError.set(null);
    if (!this.form.full_name.trim() || (this.mode === 'create' && !this.form.email.trim())) {
      this.formError.set('Nombre y correo son obligatorios');
      return;
    }
    if (this.mode === 'create' && this.form.password.length < 8) {
      this.formError.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.saving.set(true);
    const obs = this.mode === 'create'
      ? this.admin.createUsuario({
          email: this.form.email,
          full_name: this.form.full_name,
          password: this.form.password,
          role: this.form.role,
          is_active: this.form.is_active,
        })
      : this.admin.updateUsuario(this.editingId!, {
          full_name: this.form.full_name,
          role: this.form.role,
          is_active: this.form.is_active,
          ...(this.form.password ? { password: this.form.password } : {}),
        });

    obs.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((e: any) => e.msg).join(' | ')
          : (typeof detail === 'string' ? detail : err?.message || 'Error al guardar');
        this.formError.set(msg);
      },
    });
  }

  toggleActive(u: User) {
    this.admin.updateUsuario(u.id, { is_active: !u.is_active }).subscribe({
      next: () => this.load(),
      error: (err) => this.loadError.set(err?.error?.detail || 'Error al actualizar'),
    });
  }

  deleteUsuario(u: User) {
    if (!confirm(`¿Eliminar el usuario "${u.full_name}"? Esta acción no se puede deshacer.`)) return;
    this.admin.deleteUsuario(u.id).subscribe({
      next: () => this.load(),
      error: (err) => this.loadError.set(err?.error?.detail || 'Error al eliminar'),
    });
  }

  rolLabel(role: string): string {
    if (role === 'administrador') return 'Administrador';
    if (role === 'ejecutivo') return 'Ejecutivo';
    return role;
  }

  rolClass(role: string): string {
    return role === 'administrador' ? 'role-badge role-admin' : 'role-badge role-exec';
  }
}
