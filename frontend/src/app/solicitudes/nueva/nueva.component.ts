import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SolicitudesService, CatalogosService } from '../../services/api.service';
import { Aseguradora, CatalogoItem } from '../../models/models';

@Component({
  selector: 'app-nueva-solicitud',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Nueva Solicitud</h1>
        <p>Registra una solicitud manualmente en el sistema</p>
      </div>
      <a routerLink="/solicitudes" class="btn btn-outline">← Volver</a>
    </div>

    <div class="card form-card">
      <div *ngIf="error" class="alert alert-danger">⚠ {{ error }}</div>
      <div *ngIf="success" class="alert alert-success">✅ Solicitud registrada correctamente</div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="grid">
          <div class="field field-wide">
            <label>Asunto <span class="req">*</span></label>
            <input type="text" formControlName="asunto" placeholder="Asunto del correo o descripción breve" />
          </div>
          <div class="field">
            <label>Remitente</label>
            <input type="email" formControlName="remitente" placeholder="correo@empresa.com" />
          </div>
          <div class="field">
            <label>Cliente</label>
            <input type="text" formControlName="cliente" placeholder="Nombre del cliente" />
          </div>
          <div class="field">
            <label>Aseguradora</label>
            <select formControlName="aseguradora_id">
              <option [ngValue]="null">— Sin aseguradora —</option>
              <option *ngFor="let a of aseguradoras" [ngValue]="a.id">{{ a.nombre }}</option>
            </select>
          </div>
          <div class="field">
            <label>Tipo de Solicitud</label>
            <select formControlName="tipo_solicitud_id">
              <option [ngValue]="null">— Sin tipo —</option>
              <option *ngFor="let t of tiposSolicitud" [ngValue]="t.id">{{ t.nombre }}</option>
            </select>
          </div>
          <div class="field">
            <label>Prioridad</label>
            <select formControlName="prioridad_id">
              <option [ngValue]="null">— Sin prioridad —</option>
              <option *ngFor="let p of prioridades" [ngValue]="p.id">{{ p.nombre }}</option>
            </select>
          </div>
          <div class="field">
            <label>Ramo</label>
            <select formControlName="ramo_id">
              <option [ngValue]="null">— Sin ramo —</option>
              <option *ngFor="let r of ramos" [ngValue]="r.id">{{ r.nombre }}</option>
            </select>
          </div>
          <div class="field">
            <label>Fecha de Recepción</label>
            <input type="datetime-local" formControlName="fecha_recepcion" />
          </div>
          <div class="field">
            <label>Número de atenciones</label>
            <input type="number" formControlName="nro_atenciones" min="1" step="1" placeholder="1" />
          </div>
        </div>

        <div class="field full-width" style="margin-top: 12px;">
          <label>Cuerpo / Descripción</label>
          <textarea formControlName="cuerpo_correo" rows="4" placeholder="Descripción o cuerpo del correo..."></textarea>
        </div>

        <div class="field full-width" style="margin-top: 12px;">
          <label>Comentarios internos</label>
          <textarea formControlName="comentarios" rows="2" placeholder="Notas internas..."></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" [disabled]="!form.value.asunto?.trim() || loading">
            <span *ngIf="loading" class="spinner-sm"></span>
            {{ loading ? 'Guardando...' : '✦ Guardar Solicitud' }}
          </button>
          <a routerLink="/solicitudes" class="btn btn-outline">Cancelar</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-card { padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
    .field-wide { grid-column: span 2; }
    .full-width { width: 100%; }
    @media (max-width: 600px) { .field-wide { grid-column: span 1; } }
    .field label { display: block; font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field input, .field select, .field textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.85rem; background: var(--bg-card); color: var(--text-primary); box-sizing: border-box; }
    textarea { resize: vertical; min-height: 80px; }
    .req { color: var(--danger); }
    .form-actions { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
    .alert-danger { padding: 10px 12px; border-radius: var(--radius); background: rgba(255,76,76,0.08); color: var(--danger); font-size: 0.85rem; border: 1px solid rgba(255,76,76,0.3); margin-bottom: 16px; }
    .alert-success { padding: 10px 12px; border-radius: var(--radius); background: rgba(16,185,129,0.08); color: var(--success); font-size: 0.85rem; border: 1px solid rgba(16,185,129,0.3); margin-bottom: 16px; }
    .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class NuevaSolicitudComponent implements OnInit {
  form: FormGroup;
  aseguradoras: Aseguradora[] = [];
  tiposSolicitud: CatalogoItem[] = [];
  prioridades: CatalogoItem[] = [];
  ramos: CatalogoItem[] = [];
  loading = false;
  error = '';
  success = false;

  constructor(
    private fb: FormBuilder,
    private solicitudesService: SolicitudesService,
    private catalogosService: CatalogosService,
    private router: Router,
  ) {
    const nowStr = new Date().toISOString().slice(0, 16);
    this.form = this.fb.group({
      asunto: [''],
      remitente: [null],
      cliente: [null],
      aseguradora_id: [null],
      tipo_solicitud_id: [null],
      prioridad_id: [null],
      ramo_id: [null],
      fecha_recepcion: [nowStr],
      cuerpo_correo: [null],
      comentarios: [null],
      nro_atenciones: [1],
    });
  }

  ngOnInit(): void {
    this.catalogosService.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogosService.getTiposSolicitud().subscribe(d => this.tiposSolicitud = d);
    this.catalogosService.getPrioridades().subscribe(d => this.prioridades = d);
    this.catalogosService.getRamos().subscribe(d => this.ramos = d);
  }

  onSubmit(): void {
    const asunto = this.form.value.asunto?.trim();
    if (!asunto) return;
    this.loading = true;
    this.error = '';

    const v = this.form.value;
    const payload: any = {
      asunto,
      remitente: v.remitente || null,
      cliente: v.cliente || null,
      aseguradora_id: v.aseguradora_id || null,
      tipo_solicitud_id: v.tipo_solicitud_id || null,
      prioridad_id: v.prioridad_id || null,
      ramo_id: v.ramo_id || null,
      cuerpo_correo: v.cuerpo_correo || null,
      comentarios: v.comentarios || null,
      fecha_recepcion: v.fecha_recepcion ? new Date(v.fecha_recepcion).toISOString() : null,
      nro_atenciones: v.nro_atenciones ? Math.max(1, parseInt(v.nro_atenciones, 10)) : 1,
    };

    this.solicitudesService.crearManual(payload).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/solicitudes']), 1500);
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al guardar';
        this.loading = false;
      },
    });
  }
}
