import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SolicitudesService, CatalogosService, PrediccionesService } from '../../services/api.service';
import { Aseguradora, TipoOperacion, Prediccion } from '../../models/models';

@Component({
  selector: 'app-nueva-solicitud',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Nueva Solicitud</h1>
        <p>Registra una solicitud y obtén predicción ANS en tiempo real</p>
      </div>
      <a routerLink="/solicitudes" class="btn btn-outline">← Volver</a>
    </div>

    <div class="form-layout">
      <!-- Form -->
      <div class="card">
        <h3 style="margin-bottom: 24px; font-size: 1rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Datos de la Solicitud</h3>

        <div *ngIf="error" class="alert alert-danger">⚠ {{ error }}</div>
        <div *ngIf="success" class="alert alert-success">✅ Solicitud registrada correctamente</div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="grid-2">
            <div class="form-group">
              <label>Fecha de Ingreso *</label>
              <input type="datetime-local" formControlName="fecha_ingreso" />
            </div>
            <div class="form-group">
              <label>Fecha Esperada de Atención *</label>
              <input type="datetime-local" formControlName="fecha_esperada_atencion" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label>Aseguradora *</label>
              <select formControlName="aseguradora_id" (change)="onAseguradoraChange()">
                <option value="">-- Seleccionar --</option>
                <option *ngFor="let a of aseguradoras" [value]="a.id">
                  {{ a.nombre }} (ANS: {{ a.ans_horas_limite }}h)
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Tipo de Operación *</label>
              <select formControlName="tipo_operacion_id" (change)="onTipoChange()">
                <option value="">-- Seleccionar --</option>
                <option *ngFor="let t of tipos" [value]="t.id">{{ t.nombre }}</option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label>Cantidad de Asegurados *</label>
              <input type="number" formControlName="cantidad_asegurados" placeholder="Ej: 50" min="1" />
            </div>
            <div class="form-group">
              <label>Tiempo Estimado de Atención (horas) *</label>
              <input type="number" formControlName="tiempo_estimado_atencion" placeholder="Ej: 24" min="0.5" step="0.5" />
            </div>
          </div>

          <div class="form-group">
            <label>Observaciones</label>
            <textarea formControlName="observaciones" rows="3" placeholder="Notas adicionales..."></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-outline" (click)="previewPrediccion()" [disabled]="form.invalid || loadingPreview">
              <span *ngIf="loadingPreview" class="spinner-sm"></span>
              {{ loadingPreview ? 'Calculando...' : '◎ Vista previa predicción' }}
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid || loading">
              <span *ngIf="loading" class="spinner-sm"></span>
              {{ loading ? 'Guardando...' : '✦ Guardar Solicitud' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Prediction Panel -->
      <div class="prediction-panel">
        <div class="card" *ngIf="!prediccion && !loadingPreview">
          <div class="empty-pred">
            <div class="pred-icon">◎</div>
            <h3>Predicción ANS</h3>
            <p>Completa el formulario y pulsa "Vista previa" para ver la predicción del modelo antes de guardar.</p>
          </div>
        </div>

        <div class="card" *ngIf="loadingPreview">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Ejecutando modelo predictivo...</p>
          </div>
        </div>

        <div class="card pred-result" *ngIf="prediccion && !loadingPreview" [class]="'pred-' + prediccion.nivel_riesgo">
          <!-- Status -->
          <div class="pred-status">
            <div class="pred-status-icon">{{ prediccion.cumple_ans ? '✓' : '✗' }}</div>
            <div>
              <div class="pred-status-label">{{ prediccion.cumple_ans ? 'DENTRO DEL ANS' : 'FUERA DEL ANS' }}</div>
              <span class="badge" [class]="getBadgeClass(prediccion.nivel_riesgo)">
                Riesgo {{ prediccion.nivel_riesgo | uppercase }}
              </span>
            </div>
          </div>

          <!-- Risk Bar -->
          <div class="pred-risk-block">
            <div class="flex-between" style="margin-bottom: 8px">
              <span style="font-size:0.8rem;color:var(--text-muted)">Probabilidad de incumplimiento</span>
              <span class="font-mono" style="font-size:0.9rem;font-weight:700">{{ (prediccion.probabilidad_riesgo * 100).toFixed(1) }}%</span>
            </div>
            <div class="risk-bar">
              <div class="risk-fill" [class]="getRiskClass(prediccion.nivel_riesgo)"
                   [style.width]="(prediccion.probabilidad_riesgo * 100) + '%'"></div>
            </div>
          </div>

          <!-- Message -->
          <div class="pred-msg">{{ prediccion.mensaje }}</div>

          <!-- Recommendation -->
          <div class="pred-rec">
            <div class="rec-label">📋 Recomendación</div>
            <p>{{ prediccion.recomendacion }}</p>
          </div>

          <!-- Meta -->
          <div class="pred-meta">
            <span>Modelo v{{ prediccion.modelo_version }}</span>
            <span>{{ prediccion.tiempo_prediccion_ms.toFixed(1) }}ms</span>
          </div>
        </div>

        <!-- ANS Info -->
        <div class="card info-card" *ngIf="selectedAseguradora">
          <h4>Info ANS — {{ selectedAseguradora.nombre }}</h4>
          <div class="info-row">
            <span>Límite ANS</span>
            <span class="font-mono">{{ selectedAseguradora.ans_horas_limite }}h</span>
          </div>
          <div class="info-row" *ngIf="form.value.tiempo_estimado_atencion">
            <span>Tiempo estimado</span>
            <span class="font-mono">{{ form.value.tiempo_estimado_atencion }}h</span>
          </div>
          <div class="info-row" *ngIf="form.value.tiempo_estimado_atencion">
            <span>Margen disponible</span>
            <span class="font-mono" [class.text-danger]="margen < 0" [class.text-success]="margen >= 0">
              {{ margen.toFixed(1) }}h
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .form-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 24px;
      align-items: start;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    textarea {
      resize: vertical;
      min-height: 80px;
    }

    /* Prediction Panel */
    .prediction-panel { display: flex; flex-direction: column; gap: 16px; }

    .empty-pred {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-muted);

      .pred-icon { font-size: 3rem; margin-bottom: 12px; opacity: 0.3; }
      h3 { color: var(--text-secondary); font-size: 1rem; margin-bottom: 8px; }
      p { font-size: 0.8rem; line-height: 1.6; }
    }

    .pred-result {
      border-left: 4px solid var(--border);

      &.pred-bajo    { border-left-color: var(--success); }
      &.pred-medio   { border-left-color: var(--warning); }
      &.pred-alto    { border-left-color: var(--danger); }
      &.pred-critico { border-left-color: var(--critical); animation: pulse-border 2s infinite; }
    }

    @keyframes pulse-border {
      0%, 100% { border-left-color: var(--critical); }
      50%       { border-left-color: rgba(255,34,68,0.3); }
    }

    .pred-status {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .pred-status-icon {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: var(--bg-surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .pred-status-label {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .pred-risk-block { margin-bottom: 16px; }

    .pred-msg {
      background: var(--bg-surface);
      border-radius: var(--radius);
      padding: 12px;
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    .pred-rec {
      background: var(--bg-hover);
      border-radius: var(--radius);
      padding: 12px;
      margin-bottom: 16px;

      .rec-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
      p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; }
    }

    .pred-meta {
      display: flex; justify-content: space-between;
      font-size: 0.7rem; color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .info-card {
      h4 { font-size: 0.85rem; margin-bottom: 12px; color: var(--text-secondary); }
    }
    .info-row {
      display: flex; justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--text-secondary);
      span:last-child { color: var(--text-primary); }
    }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1024px) {
      .form-layout { grid-template-columns: 1fr; }
    }
  `],
})
export class NuevaSolicitudComponent implements OnInit {
  form: FormGroup;
  aseguradoras: Aseguradora[] = [];
  tipos: TipoOperacion[] = [];
  prediccion: Prediccion | null = null;
  selectedAseguradora: Aseguradora | null = null;
  loading = false;
  loadingPreview = false;
  error = '';
  success = false;

  constructor(
    private fb: FormBuilder,
    private solicitudesService: SolicitudesService,
    private catalogosService: CatalogosService,
    private prediccionesService: PrediccionesService,
    private router: Router,
  ) {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 16);
    const future = new Date(now.getTime() + 48 * 3600000).toISOString().slice(0, 16);

    this.form = this.fb.group({
      fecha_ingreso: [nowStr, Validators.required],
      fecha_esperada_atencion: [future, Validators.required],
      aseguradora_id: ['', Validators.required],
      tipo_operacion_id: ['', Validators.required],
      cantidad_asegurados: ['', [Validators.required, Validators.min(1)]],
      tiempo_estimado_atencion: ['', [Validators.required, Validators.min(0.5)]],
      observaciones: [''],
    });
  }

  ngOnInit() {
    this.catalogosService.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogosService.getTiposOperacion().subscribe(d => this.tipos = d);
  }

  onAseguradoraChange() {
    const id = +this.form.value.aseguradora_id;
    this.selectedAseguradora = this.aseguradoras.find(a => a.id === id) || null;
    this.prediccion = null;
  }

  onTipoChange() { this.prediccion = null; }

  get margen(): number {
    if (!this.selectedAseguradora) return 0;
    return this.selectedAseguradora.ans_horas_limite - (+this.form.value.tiempo_estimado_atencion || 0);
  }

  previewPrediccion() {
    if (this.form.invalid) return;
    this.loadingPreview = true;
    this.prediccion = null;
    const v = this.form.value;
    const aseg = this.aseguradoras.find(a => a.id === +v.aseguradora_id);
    const tipo = this.tipos.find(t => t.id === +v.tipo_operacion_id);

    this.prediccionesService.predecir({
      fecha_ingreso: new Date(v.fecha_ingreso).toISOString(),
      fecha_esperada_atencion: new Date(v.fecha_esperada_atencion).toISOString(),
      tipo_operacion_id: +v.tipo_operacion_id,
      aseguradora_id: +v.aseguradora_id,
      cantidad_asegurados: +v.cantidad_asegurados,
      tiempo_estimado_atencion: +v.tiempo_estimado_atencion,
      ans_horas_limite: aseg?.ans_horas_limite,
      peso_complejidad: tipo?.peso_complejidad,
    }).subscribe({
      next: (p) => { this.prediccion = p; this.loadingPreview = false; },
      error: () => { this.loadingPreview = false; },
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const v = this.form.value;

    this.solicitudesService.crear({
      ...v,
      fecha_ingreso: new Date(v.fecha_ingreso).toISOString(),
      fecha_esperada_atencion: new Date(v.fecha_esperada_atencion).toISOString(),
      aseguradora_id: +v.aseguradora_id,
      tipo_operacion_id: +v.tipo_operacion_id,
      cantidad_asegurados: +v.cantidad_asegurados,
      tiempo_estimado_atencion: +v.tiempo_estimado_atencion,
    }).subscribe({
      next: () => { this.success = true; this.loading = false; setTimeout(() => this.router.navigate(['/predicciones']), 1500); },
      error: (err) => { this.error = err.error?.detail || 'Error al guardar'; this.loading = false; },
    });
  }

  getBadgeClass(nivel: string): string {
    const map: Record<string, string> = { bajo: 'badge-success', medio: 'badge-warning', alto: 'badge-danger', critico: 'badge-critical' };
    return map[nivel] || 'badge-info';
  }

  getRiskClass(nivel: string): string {
    const map: Record<string, string> = { bajo: 'low', medio: 'medium', alto: 'high', critico: 'critical' };
    return map[nivel] || 'low';
  }
}
