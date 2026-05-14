import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/api.service';

interface CatalogTab {
  key: 'tipos-solicitud' | 'estados-solicitud' | 'prioridades' | 'ramos' | 'clientes' | 'aseguradoras';
  label: string;
  hint: string;
}

@Component({
  selector: 'app-admin-catalogos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page-header">
      <div>
        <h1>Catálogos</h1>
        <p class="muted">Gestiona los valores que se usan en los menús desplegables del sistema.</p>
      </div>
    </div>

    <div class="tabs">
      <button *ngFor="let t of tabs" class="tab" [class.active]="active().key === t.key" (click)="setTab(t)">
        {{ t.label }}
      </button>
    </div>

    <p class="hint">{{ active().hint }}</p>

    <div class="card form-card">
      <h3>{{ editingId() ? 'Editar' : 'Agregar nuevo' }}</h3>

      <ng-container *ngIf="active().key !== 'aseguradoras'; else asegForm">
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
      </ng-container>

      <ng-template #asegForm>
        <div class="grid">
          <div class="field">
            <label>Nombre <span class="req">*</span></label>
            <input type="text" [(ngModel)]="form.nombre" />
          </div>
          <div class="field">
            <label>Código <span class="req">*</span></label>
            <input type="text" [(ngModel)]="form.codigo" placeholder="RIMAC" />
          </div>
          <div class="field">
            <label>ANS Horas Límite</label>
            <input type="number" [(ngModel)]="form.ans_horas_limite" placeholder="48" />
          </div>
          <div class="field">
            <label>Estado</label>
            <select [(ngModel)]="form.activo">
              <option [ngValue]="true">Activo</option>
              <option [ngValue]="false">Inactivo</option>
            </select>
          </div>
        </div>
      </ng-template>

      <div class="form-actions">
        <button class="btn btn-primary" (click)="save()" [disabled]="!form.nombre?.trim() || saving()">
          {{ saving() ? 'Guardando...' : (editingId() ? '💾 Actualizar' : '+ Agregar') }}
        </button>
        <button *ngIf="editingId()" class="btn btn-outline" (click)="cancel()">Cancelar</button>
      </div>
      <div class="alert alert-error" *ngIf="error()">{{ error() }}</div>
    </div>

    <div class="card table-card">
      <div *ngIf="loading()" class="loading-state"><div class="spinner"></div></div>
      <table *ngIf="!loading()">
        <thead>
          <tr>
            <th class="th-id">ID</th>
            <th>Nombre</th>
            <th *ngIf="active().key === 'aseguradoras'">Código</th>
            <th *ngIf="active().key === 'aseguradoras'">ANS h.</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of items()">
            <td><small class="muted">#{{ item.id }}</small></td>
            <td><strong>{{ item.nombre }}</strong></td>
            <td *ngIf="active().key === 'aseguradoras'"><code>{{ item.codigo }}</code></td>
            <td *ngIf="active().key === 'aseguradoras'">{{ item.ans_horas_limite }}h</td>
            <td><span class="pill" [class.activo]="isActive(item)">{{ isActive(item) ? 'Activo' : 'Inactivo' }}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-outline" (click)="edit(item)">Editar</button>
              <button class="btn btn-sm btn-danger" (click)="remove(item)">Eliminar</button>
            </td>
          </tr>
          <tr *ngIf="items().length === 0">
            <td [attr.colspan]="active().key === 'aseguradoras' ? 6 : 4">
              <div class="empty-state"><p>No hay registros.</p></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
 .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 6px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .hint { color: var(--text-muted); font-size: 0.82rem; margin-bottom: 16px; }

    .tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; border-bottom: 1px solid var(--border); }
    .tab {
      background: none; border: none; padding: 10px 16px;
      cursor: pointer; font-size: 0.85rem; color: var(--text-secondary);
      border-bottom: 2px solid transparent; transition: all 0.15s;
    }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }

    .form-card { padding: 18px 20px; margin-bottom: 18px; margin-top: 16px; }
    .form-card h3 { font-size: 1rem; margin-bottom: 12px; color: var(--text-primary); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .field label { display: block; font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field input, .field select { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; background: #fff; }
    .req { color: var(--danger); }
    .form-actions { margin-top: 14px; display: flex; gap: 8px; }
    .alert-error { margin-top: 12px; padding: 10px 12px; border-radius: var(--radius); background: rgba(255,76,76,0.08); color: var(--danger); font-size: 0.85rem; border: 1px solid rgba(255,76,76,0.3); }

    .table-card { padding: 0; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    thead th { text-align: left; padding: 10px 14px; background: var(--bg-surface); border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; }
    tbody td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
    .th-id { width: 60px; }
    code { font-family: var(--font-mono, monospace); background: var(--bg-hover); padding: 2px 6px; border-radius: 4px; font-size: 0.78rem; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; background: var(--bg-hover); color: var(--text-muted); }
    .pill.activo { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .actions { display: flex; gap: 6px; }

    .loading-state { padding: 40px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
  `],
})
export class AdminCatalogosComponent implements OnInit {
  tabs: CatalogTab[] = [
    { key: 'tipos-solicitud', label: 'Tipos de solicitud', hint: 'Inclusión, Exclusión, Renovación, Emisión...' },
    { key: 'estados-solicitud', label: 'Estados', hint: 'Pendiente, En Proceso, Finalizado...' },
    { key: 'prioridades', label: 'Prioridades', hint: 'Baja, Media, Alta...' },
    { key: 'ramos', label: 'Ramos', hint: 'EPS, FOLA, SCTR-S, SCTR-P...' },
    { key: 'clientes', label: 'Clientes', hint: 'Catálogo maestro de clientes' },
    { key: 'aseguradoras', label: 'Aseguradoras', hint: 'Aseguradoras con ANS configurado' },
  ];

  active = signal<CatalogTab>(this.tabs[0]);
  items = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);
  editingId = signal<number | null>(null);
  error = signal<string>('');

  form: any = { nombre: '', activo: true };

  constructor(private admin: AdminService) {}

  ngOnInit(): void {
    this.load();
  }

  setTab(t: CatalogTab): void {
    this.active.set(t);
    this.cancel();
    this.load();
  }

  isActive(item: any): boolean {
    return item.activo ?? item.is_active ?? false;
  }

  load(): void {
    this.loading.set(true);
    const k = this.active().key;

    let obs: any;

    if (k === 'clientes') {
      obs = this.admin.listClientes();
    } else if (k === 'aseguradoras') {
      obs = this.admin.listAseguradoras();
    } else {
      obs = this.admin.list(k);
    }

    obs.subscribe({
      next: (d: any) => {
        this.items.set(d as any[]);
        this.loading.set(false);
      },
      error: (_err: any) => {
        this.loading.set(false);
      },
    });
  }

  save(): void {
    this.error.set('');
    this.saving.set(true);

    const k = this.active().key;
    const id = this.editingId();
    const body = { ...this.form };

    let obs: any;

    if (k === 'clientes') {
      obs = id ? this.admin.updateCliente(id, body) : this.admin.createCliente(body);
    } else if (k === 'aseguradoras') {
      obs = id ? this.admin.updateAseguradora(id, body) : this.admin.createAseguradora(body);
    } else {
      obs = id ? this.admin.updateCat(k, id, body) : this.admin.createCat(k, body);
    }

    obs.subscribe({
      next: (_d: any) => {
        this.saving.set(false);
        this.cancel();
        this.load();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail || 'Error al guardar');
      },
    });
  }

  edit(item: any): void {
    this.editingId.set(item.id);
    this.form = {
      nombre: item.nombre,
      activo: this.isActive(item),
      ...(this.active().key === 'aseguradoras'
        ? { codigo: item.codigo, ans_horas_limite: item.ans_horas_limite }
        : {}),
    };
  }

  cancel(): void {
    this.editingId.set(null);
    this.form = this.active().key === 'aseguradoras'
      ? { nombre: '', codigo: '', ans_horas_limite: 48, activo: true }
      : { nombre: '', activo: true };
    this.error.set('');
  }

  remove(item: any): void {
    if (!confirm(`¿Eliminar '${item.nombre}'?`)) return;

    const k = this.active().key;
    let obs: any;

    if (k === 'clientes') {
      obs = this.admin.deleteCliente(item.id);
    } else if (k === 'aseguradoras') {
      obs = this.admin.deleteAseguradora(item.id);
    } else {
      obs = this.admin.deleteCat(k, item.id);
    }

    obs.subscribe({
      next: (_d: any) => this.load(),
      error: (err: any) => alert(err?.error?.detail || 'Error al eliminar'),
    });
  }
}