import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../services/api.service';
import { DashboardStats } from '../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Dashboard</h1>
        <p>Resumen de gestión predictiva ANS · Actualizado ahora</p>
      </div>
      <div class="flex gap-2">
        <a routerLink="/solicitudes/nueva" class="btn btn-primary">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" style="margin-right:6px">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Nueva Solicitud
        </a>
        <a routerLink="/solicitudes/carga-masiva" class="btn btn-outline">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" style="margin-right:6px">
            <path d="M8 2v9M4 6l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          Carga Masiva
        </a>
      </div>
    </div>

    <div *ngIf="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Cargando estadísticas...</p>
    </div>

    <ng-container *ngIf="!loading && stats">
      <!-- KPI Cards -->
      <div class="grid-4 mb-4">
        <div class="stat-card kpi-total">
          <div class="kpi-icon-wrap kpi-icon-navy">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-label">Total Solicitudes</div>
          <div class="stat-value font-mono">{{ stats.total_solicitudes }}</div>
          <div class="stat-sub">Registradas en el sistema</div>
        </div>

        <div class="stat-card kpi-success">
          <div class="kpi-icon-wrap kpi-icon-success">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="stat-label">Dentro del ANS</div>
          <div class="stat-value font-mono text-success">{{ stats.dentro_ans }}</div>
          <div class="stat-sub">{{ getPercent(stats.dentro_ans, stats.total_solicitudes) }}% del total</div>
        </div>

        <div class="stat-card kpi-danger">
          <div class="kpi-icon-wrap kpi-icon-danger">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M13 7l-6 6M7 7l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-label">Fuera del ANS</div>
          <div class="stat-value font-mono text-danger">{{ stats.fuera_ans }}</div>
          <div class="stat-sub">{{ getPercent(stats.fuera_ans, stats.total_solicitudes) }}% del total</div>
        </div>

        <div class="stat-card kpi-critical">
          <div class="kpi-icon-wrap kpi-icon-critical">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <path d="M10 3L2 17h16L10 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M10 9v4M10 15h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-label">Casos Críticos</div>
          <div class="stat-value font-mono" style="color: var(--accent)">{{ stats.criticos }}</div>
          <div class="stat-sub">{{ stats.alto_riesgo }} en alto riesgo</div>
        </div>
      </div>

      <!-- Alerts Banner -->
      <div *ngIf="stats.criticos > 0" class="alert alert-critical mb-4">
        <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style="flex-shrink:0">
          <path d="M10 3L2 17h16L10 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M10 9v4M10 15h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <div>
          <strong>¡Atención requerida!</strong> Hay {{ stats.criticos }} solicitud(es) en estado CRÍTICO con alto riesgo de incumplimiento del ANS.
          <a routerLink="/predicciones" style="color: inherit; text-decoration: underline; margin-left: 8px">Ver predicciones →</a>
        </div>
      </div>

      <!-- Risk Overview + Status -->
      <div class="grid-2 mb-4">
        <!-- Riesgo Promedio -->
        <div class="card">
          <div class="card-section-title">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Indicador de Riesgo Global
          </div>
          <div class="risk-gauge">
            <div class="gauge-value font-mono" [style.color]="getRiskColor(stats.promedio_riesgo)">
              {{ (stats.promedio_riesgo * 100).toFixed(1) }}%
            </div>
            <div class="gauge-label">Probabilidad promedio de incumplimiento</div>
            <div class="risk-bar mt-4">
              <div class="risk-fill" [class]="getRiskClass(stats.promedio_riesgo)"
                   [style.width]="(stats.promedio_riesgo * 100) + '%'"></div>
            </div>
            <div class="gauge-legend flex-between mt-4">
              <span class="text-success" style="font-size:0.75rem">0% Bajo</span>
              <span class="text-warning" style="font-size:0.75rem">50% Medio</span>
              <span style="font-size:0.75rem;color:var(--accent)">100% Crítico</span>
            </div>
          </div>

          <div class="risk-breakdown mt-4">
            <div class="risk-level-row" *ngFor="let level of riskLevels">
              <span class="badge" [class]="'badge-' + level.badge">{{ level.label }}</span>
              <div class="risk-bar" style="flex:1">
                <div class="risk-fill" [class]="level.cls" [style.width]="level.pct + '%'"></div>
              </div>
              <span class="font-mono text-muted" style="font-size:0.8rem;min-width:28px;text-align:right">{{ level.count }}</span>
            </div>
          </div>
        </div>

        <!-- Estado + Por Aseguradora -->
        <div class="card">
          <div class="card-section-title">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Estado de Solicitudes
          </div>
          <div class="status-list">
            <div class="status-row">
              <div class="status-dot" style="background: var(--warning)"></div>
              <span>Pendientes</span>
              <span class="font-mono status-count">{{ stats.pendientes }}</span>
            </div>
            <div class="status-row">
              <div class="status-dot" style="background: var(--danger)"></div>
              <span>Vencidos</span>
              <span class="font-mono status-count">{{ stats.vencidos || 0 }}</span>
            </div>
            <div class="status-row" style="border-bottom:none">
              <div class="status-dot" style="background: var(--secondary)"></div>
              <span>Alertas no leídas</span>
              <span class="font-mono status-count">{{ stats.alertas_no_leidas }}</span>
            </div>
          </div>

          <div class="card-section-title" style="margin-top:20px">
            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
              <path d="M2 12V6l4-4 4 4 4-2v8H2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            Por Aseguradora
          </div>
          <div class="bar-chart">
            <div class="bar-row" *ngFor="let a of stats.por_aseguradora.slice(0, 5)">
              <span class="bar-label">{{ a.nombre }}</span>
              <div class="risk-bar" style="flex:1">
                <div class="risk-fill low" [style.width]="getBarWidth(a.total, stats.por_aseguradora) + '%'"></div>
              </div>
              <span class="bar-value font-mono">{{ a.total }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tendencia Semanal -->
      <div class="card">
        <div class="card-section-title">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M2 12l3-4 3 2 4-6 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Tendencia Semanal
        </div>
        <div class="trend-chart" *ngIf="stats.tendencia_semanal.length > 0; else noTrend">
          <div class="trend-bars">
            <div class="trend-bar-group" *ngFor="let d of stats.tendencia_semanal">
              <div class="trend-bars-inner">
                <div class="trend-bar dentro" [style.height]="getTrendHeight(d.dentro, stats.tendencia_semanal) + '%'" [title]="'Dentro ANS: ' + d.dentro"></div>
                <div class="trend-bar fuera"  [style.height]="getTrendHeight(d.fuera,  stats.tendencia_semanal) + '%'" [title]="'Fuera ANS: '  + d.fuera"></div>
              </div>
              <span class="trend-label">{{ formatDate(d.fecha) }}</span>
            </div>
          </div>
          <div class="trend-legend">
            <span class="legend-dot" style="background:var(--success)"></span><span class="text-success">Dentro ANS</span>
            <span class="legend-dot" style="background:var(--danger)"></span><span class="text-danger">Fuera ANS</span>
          </div>
        </div>
        <ng-template #noTrend>
          <div class="empty-state" style="padding: 36px">
            <svg viewBox="0 0 40 40" fill="none" width="36" height="36" style="margin-bottom:12px;opacity:.3">
              <path d="M6 30l8-10 8 6 10-14 8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>No hay datos de tendencia aún. Registra solicitudes para ver la gráfica.</p>
          </div>
        </ng-template>
      </div>
    </ng-container>
  `,
  styles: [`
    .mb-4 { margin-bottom: 20px; }
    .mt-4 { margin-top: 16px; }

    /* KPI card accent variants */
    .kpi-success { border-top: 3px solid var(--success); }
    .kpi-danger  { border-top: 3px solid var(--danger); }
    .kpi-critical { border-top: 3px solid var(--accent); }
    .kpi-total   { border-top: 3px solid var(--primary); }

    .kpi-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
    }
    .kpi-icon-navy    { background: rgba(11,37,69,.08);  color: var(--primary); }
    .kpi-icon-success { background: rgba(34,197,94,.1);  color: var(--success); }
    .kpi-icon-danger  { background: rgba(239,68,68,.1);  color: var(--danger); }
    .kpi-icon-critical { background: rgba(249,115,22,.1); color: var(--accent); }

    /* Card section title */
    .card-section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.9rem; font-weight: 600; color: var(--text-primary);
      margin-bottom: 16px; color: var(--text-secondary);
    }

    /* Gauge */
    .gauge-value { font-size: 2.75rem; font-weight: 700; line-height: 1; }
    .gauge-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; }

    .risk-breakdown { display: flex; flex-direction: column; gap: 10px; }
    .risk-level-row { display: flex; align-items: center; gap: 12px; }

    /* Status list */
    .status-list { display: flex; flex-direction: column; }
    .status-row {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 0; border-bottom: 1px solid var(--border);
      font-size: 0.875rem; color: var(--text-secondary);
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .status-count { margin-left: auto; color: var(--text-primary); font-weight: 600; }

    /* Bar chart */
    .bar-chart { display: flex; flex-direction: column; gap: 9px; }
    .bar-row { display: flex; align-items: center; gap: 10px; font-size: 0.8rem; }
    .bar-label { width: 110px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-value { width: 28px; text-align: right; color: var(--text-muted); font-size: 0.78rem; }

    /* Trend */
    .trend-chart { display: flex; flex-direction: column; gap: 14px; }
    .trend-bars { display: flex; align-items: flex-end; gap: 10px; height: 130px; }
    .trend-bar-group { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
    .trend-bars-inner { display: flex; align-items: flex-end; gap: 3px; height: 110px; width: 100%; justify-content: center; }
    .trend-bar { width: 18px; border-radius: 3px 3px 0 0; min-height: 4px; transition: height .5s ease; }
    .trend-bar.dentro { background: var(--success); }
    .trend-bar.fuera  { background: var(--danger); }
    .trend-label { font-size: 0.7rem; color: var(--text-muted); }
    .trend-legend { display: flex; align-items: center; gap: 16px; font-size: 0.78rem; color: var(--text-secondary); }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

    /* gauge legend */
    .gauge-legend { display: flex; justify-content: space-between; }
  `],
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;

  riskLevels = [
    { label: 'Bajo',    badge: 'success', cls: 'low',      count: 0, pct: 0 },
    { label: 'Medio',   badge: 'warning', cls: 'medium',   count: 0, pct: 0 },
    { label: 'Alto',    badge: 'danger',  cls: 'high',     count: 0, pct: 0 },
    { label: 'Crítico', badge: 'critical',cls: 'critical', count: 0, pct: 0 },
  ];

  constructor(private dashService: DashboardService) {}

  ngOnInit() {
    this.dashService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        const total = data.total_solicitudes || 1;
        this.riskLevels[2].count = data.alto_riesgo;
        this.riskLevels[3].count = data.criticos;
        const bajo = total - data.alto_riesgo - data.criticos;
        this.riskLevels[0].count = Math.max(0, bajo);
        this.riskLevels.forEach(l => l.pct = (l.count / total) * 100);
      },
      error: () => { this.loading = false; },
    });
  }

  getPercent(n: number, total: number): string {
    return total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';
  }

  getRiskColor(risk: number): string {
    if (risk >= 0.7) return 'var(--critical)';
    if (risk >= 0.5) return 'var(--danger)';
    if (risk >= 0.3) return 'var(--warning)';
    return 'var(--success)';
  }

  getRiskClass(risk: number): string {
    if (risk >= 0.7) return 'critical';
    if (risk >= 0.5) return 'high';
    if (risk >= 0.3) return 'medium';
    return 'low';
  }

  getBarWidth(val: number, arr: { nombre: string; total: number }[]): number {
    const max = Math.max(...arr.map(a => a.total)) || 1;
    return (val / max) * 100;
  }

  getTrendHeight(val: number, arr: { total: number }[]): number {
    const max = Math.max(...arr.map(d => d.total)) || 1;
    return (val / max) * 100;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  get vencidos(): number { return this.stats?.vencidos ?? 0; }
}
