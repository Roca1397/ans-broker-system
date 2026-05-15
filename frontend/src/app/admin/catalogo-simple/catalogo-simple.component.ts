import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../services/api.service';

interface CatalogConfig {
  key: 'tipos-solicitud' | 'estados-solicitud' | 'prioridades' | 'ramos';
  label: string;
  hint: string;
}

@Component({
  selector: 'app-catalogo-simple',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>{{ config?.label }}</h1>
        <p class="muted">{{ config?.hint }}</p>
      </div>
    </div>

    <div class="card form-card">
      <h3>{{ editingId() ? 'Editar registro' : 'Agregar nuevo' }}</h3>
      <div class="grid">
        <div class="field">
          <label>Nombre <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.nombre" placeholder="Nombre" />
        </div>
        <div class="field">
          <label>Estado</label>
          <select [(ngModel)]="form.activo">
            <option [ngValue]="true">Activo</option>
            <option [ngValue]="false">Inactivo</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" (click)="save()" [disabled]="!form.nombre?.trim() || saving()">
          {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : '+ Agregar') }}
        </button>
        <button *ngIf="editingId()" class="btn btn-outline" (click)="cancel()">Cancelar</button>
      </div>
      <div class="alert-error" *ngIf="error()">{{ error() }}</div>
    </div>

    <div class="card table-card">
      <div *ngIf="loading()" class="loading-state"><div class="spinner"></div></div>
      <table *ngIf="!loading()">
        <thead>
          <tr>
            <th class="th-id">ID</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td><small class="muted">#{{ item.id }}</small></td>
            <td><strong>{{ item.nombre }}</strong></td>
            <td><span class="pill" [class.activo]="item.activo">{{ item.activo ? 'Activo' : 'Inactivo' }}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" (click)="edit(item)">Editar</button>
              <button class="btn btn-sm btn-danger" (click)="remove(item)">Eliminar</button>
            </td>
          </tr>
          <tr *ngIf="items().length === 0">
            <td colspan="4"><div class="empty-state"><p>No hay registros.</p></div></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 6px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .form-card { padding: 18px 20px; margin-bottom: 18px; }
    .form-card h3 { font-size: 1rem; margin-bottom: 12px; color: var(--text-primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .field label { display: block; font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field input, .field select { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; background: var(--bg-card); color: var(--text-primary); box-sizing: border-box; }
    .req { color: var(--danger); }
    .form-actions { margin-top: 14px; display: flex; gap: 8px; }
    .alert-error { margin-top: 12px; padding: 10px 12px; border-radius: var(--radius); background: rgba(255,76,76,0.08); color: var(--danger); font-size: 0.85rem; border: 1px solid rgba(255,76,76,0.3); }
    .table-card { padding: 0; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead th { text-align: left; padding: 10px 14px; background: var(--bg-surface); border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; }
    tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
    .th-id { width: 60px; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; background: var(--bg-hover); color: var(--text-muted); }
    .pill.activo { background: rgba(16,185,129,0.15); color: var(--success); }
    .actions { display: flex; gap: 6px; }
    .loading-state { padding: 40px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
  `],
})
export class CatalogoSimpleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private admin = inject(AdminService);

  config: CatalogConfig | null = null;
  items = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  editingId = signal<number | null>(null);
  error = signal('');
  form: any = { nombre: '', activo: true };

  ngOnInit(): void {
    this.config = this.route.snapshot.data['catalog'] as CatalogConfig;
    this.load();
  }

  load(): void {
    if (!this.config) return;
    this.loading.set(true);
    this.admin.list(this.config.key).subscribe({
      next: (d) => { this.items.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    if (!this.config) return;
    this.error.set('');
    this.saving.set(true);
    const id = this.editingId();
    const obs = id
      ? this.admin.updateCat(this.config.key, id, this.form)
      : this.admin.createCat(this.config.key, this.form);
    obs.subscribe({
      next: () => { this.saving.set(false); this.cancel(); this.load(); },
      error: (err: any) => { this.saving.set(false); this.error.set(err?.error?.detail || 'Error al guardar'); },
    });
  }

  edit(item: any): void {
    this.editingId.set(item.id);
    this.form = { nombre: item.nombre, activo: item.activo };
  }

  cancel(): void {
    this.editingId.set(null);
    this.form = { nombre: '', activo: true };
    this.error.set('');
  }

  remove(item: any): void {
    if (!this.config || !confirm(`¿Eliminar '${item.nombre}'?`)) return;
    this.admin.deleteCat(this.config.key, item.id).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.detail || 'Error al eliminar'),
    });
  }
}
