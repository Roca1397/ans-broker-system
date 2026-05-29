import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/api.service';
import { Aseguradora } from '../../models/models';

@Component({
  selector: 'app-admin-aseguradoras',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Aseguradoras</h1>
        <p class="muted">Gestiona las aseguradoras con su límite de horas ANS configurado.</p>
      </div>
    </div>

    <div class="card form-card">
      <h3>{{ editingId() ? 'Editar aseguradora' : 'Agregar nueva aseguradora' }}</h3>
      <div class="grid">
        <div class="field field-wide">
          <label>Razón social / Nombre comercial <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.nombre" placeholder="Ej: Rimac Seguros S.A." />
        </div>
        <div class="field">
          <label>Código <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.codigo" placeholder="RIMAC" style="text-transform:uppercase" />
        </div>
        <div class="field">
          <label>ANS horas límite</label>
          <input type="number" [(ngModel)]="form.ans_horas_limite" min="1" placeholder="48" />
        </div>
        <div class="field">
          <label>Contacto</label>
          <input type="text" [(ngModel)]="form.contacto" placeholder="Nombre o correo del contacto" />
        </div>
        <div class="field field-wide">
          <label>Dirección</label>
          <input type="text" [(ngModel)]="form.direccion" placeholder="Dirección completa" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" (click)="save()" [disabled]="!form.nombre?.trim() || !form.codigo?.trim() || saving()">
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
            <th>Código</th>
            <th>ANS h.</th>
            <th>Contacto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td><small class="muted">#{{ item.id }}</small></td>
            <td><strong>{{ item.nombre }}</strong></td>
            <td><code>{{ item.codigo }}</code></td>
            <td>{{ item.ans_horas_limite }}h</td>
            <td>{{ item.contacto || '—' }}</td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" (click)="edit(item)">Editar</button>
              <button class="btn btn-sm btn-danger" (click)="remove(item)">Eliminar</button>
            </td>
          </tr>
          <tr *ngIf="items().length === 0">
            <td colspan="6"><div class="empty-state"><p>No hay aseguradoras registradas.</p></div></td>
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
    .field-wide { grid-column: span 2; }
    @media (max-width: 600px) { .field-wide { grid-column: span 1; } }
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
    code { font-family: var(--font-mono, monospace); background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.78rem; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; background: var(--bg-hover); color: var(--text-muted); }
    .pill.activo { background: rgba(16,185,129,0.15); color: var(--success); }
    .actions { display: flex; gap: 6px; }
    .loading-state { padding: 40px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
  `],
})
export class AdminAseguradorasComponent implements OnInit {
  items = signal<Aseguradora[]>([]);
  loading = signal(true);
  saving = signal(false);
  editingId = signal<number | null>(null);
  error = signal('');
  form: any = { nombre: '', codigo: '', ans_horas_limite: 48, contacto: '', direccion: '', activo: true };

  constructor(private admin: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.admin.listAseguradoras().subscribe({
      next: (d) => { this.items.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.error.set('');
    this.saving.set(true);
    const id = this.editingId();
    const body = { ...this.form, codigo: this.form.codigo?.toUpperCase() };
    const obs = id ? this.admin.updateAseguradora(id, body) : this.admin.createAseguradora(body);
    obs.subscribe({
      next: () => { this.saving.set(false); this.cancel(); this.load(); },
      error: (err: any) => { this.saving.set(false); this.error.set(err?.error?.detail || 'Error al guardar'); },
    });
  }

  edit(item: Aseguradora): void {
    this.editingId.set(item.id);
    this.form = {
      nombre: item.nombre,
      codigo: item.codigo,
      ans_horas_limite: item.ans_horas_limite,
      contacto: item.contacto || '',
      direccion: item.direccion || '',
      activo: item.activo ?? true,
    };
  }

  cancel(): void {
    this.editingId.set(null);
    this.form = { nombre: '', codigo: '', ans_horas_limite: 48, contacto: '', direccion: '', activo: true };
    this.error.set('');
  }

  remove(item: Aseguradora): void {
    if (!confirm(`¿Eliminar aseguradora '${item.nombre}'?`)) return;
    this.admin.deleteAseguradora(item.id).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.detail || 'Error al eliminar'),
    });
  }
}
