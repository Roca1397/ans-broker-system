import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, CatalogosService } from '../../services/api.service';
import { ClienteRemitente, Aseguradora, CatalogoItem, Cliente } from '../../models/models';

/**
 * ARCHIVO NUEVO: frontend/src/app/admin/clientes-remitentes/clientes-remitentes.component.ts
 * Gestión de asociaciones cliente <-> remitente (sólo admin).
 */
@Component({
  selector: 'app-clientes-remitentes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Cliente · Remitente</h1>
        <p class="muted">
          Gestiona las asociaciones entre correos remitentes y clientes.
          Cuando llegue un correo desde Outlook, el sistema autocompletará
          el cliente, aseguradora y ramo según la asociación que registres aquí.
        </p>
      </div>
    </div>

    <div class="card form-card">
      <h3>{{ editingId() ? 'Editar asociación' : 'Nueva asociación' }}</h3>
      <div class="grid">
        <div class="field">
          <label>Cliente <span class="req">*</span></label>
          <input type="text" [(ngModel)]="form.cliente" placeholder="Nombre del cliente" list="clientesList" />
          <datalist id="clientesList">
            <option *ngFor="let c of clientes" [value]="c.nombre"></option>
          </datalist>
        </div>
        <div class="field">
          <label>Remitente (correo) <span class="req">*</span></label>
          <input type="email" [(ngModel)]="form.remitente" placeholder="ejemplo@cliente.com" />
        </div>
        <div class="field">
          <label>Aseguradora</label>
          <select [(ngModel)]="form.aseguradora_id">
            <option [ngValue]="null">— Ninguna —</option>
            <option *ngFor="let a of aseguradoras" [ngValue]="a.id">{{ a.nombre }}</option>
          </select>
        </div>
        <div class="field">
          <label>Ramo</label>
          <select [(ngModel)]="form.ramo_id">
            <option [ngValue]="null">— Ninguno —</option>
            <option *ngFor="let r of ramos" [ngValue]="r.id">{{ r.nombre }}</option>
          </select>
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
        <button class="btn btn-primary" (click)="save()" [disabled]="!canSubmit() || saving()">
          {{ saving() ? 'Guardando...' : (editingId() ? '💾 Actualizar' : '+ Agregar') }}
        </button>
        <button *ngIf="editingId()" class="btn btn-outline" (click)="cancel()">Cancelar</button>
      </div>
      <div class="alert alert-error" *ngIf="error()">{{ error() }}</div>
    </div>

    <div class="card table-card">
      <div class="card-head">
        <h3>Asociaciones registradas</h3>
        <div class="search-box-sm">
          <input type="text" [(ngModel)]="filter" placeholder="🔍 Filtrar..." />
        </div>
      </div>
      <div *ngIf="loading()" class="loading-state"><div class="spinner"></div></div>
      <table *ngIf="!loading()">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Remitente</th>
            <th>Aseguradora</th>
            <th>Ramo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let a of filtered()">
            <td><strong>{{ a.cliente }}</strong></td>
            <td><span class="email">{{ a.remitente }}</span></td>
            <td>{{ a.aseguradora_nombre || '—' }}</td>
            <td>{{ a.ramo_nombre || '—' }}</td>
            <td><span class="pill" [class.activo]="a.activo">{{ a.activo ? 'Activo' : 'Inactivo' }}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" (click)="edit(a)">Editar</button>
              <button class="btn btn-sm btn-danger" (click)="remove(a)">Eliminar</button>
            </td>
          </tr>
          <tr *ngIf="filtered().length === 0">
            <td colspan="6">
              <div class="empty-state"><p>No hay asociaciones registradas.</p></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 18px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 6px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; max-width: 720px; }

    .form-card { padding: 18px 20px; margin-bottom: 18px; }
    .form-card h3 { font-size: 1rem; margin-bottom: 14px; color: var(--text-primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .field label { display: block; font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field input, .field select {
      width: 100%; padding: 8px 10px; border: 1px solid var(--border);
      border-radius: var(--radius); background: #fff; font-size: 0.85rem;
    }
    .req { color: var(--danger); }
    .form-actions { margin-top: 14px; display: flex; gap: 8px; }
    .alert-error { margin-top: 12px; padding: 10px 12px; border-radius: var(--radius); background: rgba(255,76,76,0.08); color: var(--danger); font-size: 0.85rem; border: 1px solid rgba(255,76,76,0.3); }

    .table-card { padding: 0; overflow: hidden; }
    .card-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--border); }
    .card-head h3 { font-size: 0.95rem; color: var(--text-primary); }
    .search-box-sm input { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.8rem; min-width: 220px; }

    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead th { text-align: left; padding: 10px 14px; background: var(--bg-surface); border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; }
    tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
    .email { font-family: var(--font-mono, monospace); font-size: 0.8rem; color: var(--text-secondary); }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; background: var(--bg-hover); color: var(--text-muted); }
    .pill.activo { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .actions { display: flex; gap: 6px; }

    .loading-state { padding: 40px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
  `],
})
export class ClientesRemitentesComponent implements OnInit {
  asociaciones = signal<ClienteRemitente[]>([]);
  clientes: Cliente[] = [];
  aseguradoras: Aseguradora[] = [];
  ramos: CatalogoItem[] = [];

  loading = signal(true);
  saving = signal(false);
  editingId = signal<number | null>(null);
  error = signal<string>('');
  filter = '';

  form: any = this.emptyForm();

  constructor(private admin: AdminService, private catalogos: CatalogosService) {}

  ngOnInit() {
    this.catalogos.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogos.getRamos().subscribe(d => this.ramos = d);
    this.catalogos.getClientes().subscribe(d => this.clientes = d);
    this.load();
  }

  emptyForm() {
    return { cliente: '', remitente: '', aseguradora_id: null, ramo_id: null, activo: true };
  }

  load() {
    this.loading.set(true);
    this.admin.listAsociaciones().subscribe({
      next: (d) => { this.asociaciones.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  filtered() {
    const f = this.filter.trim().toLowerCase();
    if (!f) return this.asociaciones();
    return this.asociaciones().filter(a =>
      (a.cliente || '').toLowerCase().includes(f) ||
      (a.remitente || '').toLowerCase().includes(f) ||
      (a.aseguradora_nombre || '').toLowerCase().includes(f) ||
      (a.ramo_nombre || '').toLowerCase().includes(f)
    );
  }

  canSubmit(): boolean {
    return !!this.form.cliente?.trim() && !!this.form.remitente?.trim();
  }

  save() {
    this.error.set('');
    this.saving.set(true);
    const id = this.editingId();
    const obs = id
      ? this.admin.updateAsociacion(id, this.form)
      : this.admin.createAsociacion(this.form);

    obs.subscribe({
      next: () => { this.saving.set(false); this.cancel(); this.load(); },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.detail || 'Error al guardar'); },
    });
  }

  edit(a: ClienteRemitente) {
    this.editingId.set(a.id);
    this.form = {
      cliente: a.cliente,
      remitente: a.remitente,
      aseguradora_id: a.aseguradora_id ?? null,
      ramo_id: a.ramo_id ?? null,
      activo: a.activo,
    };
  }

  cancel() {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.error.set('');
  }

  remove(a: ClienteRemitente) {
    if (!confirm(`¿Eliminar la asociación '${a.remitente}' → '${a.cliente}'?`)) return;
    this.admin.deleteAsociacion(a.id).subscribe(() => this.load());
  }
}
