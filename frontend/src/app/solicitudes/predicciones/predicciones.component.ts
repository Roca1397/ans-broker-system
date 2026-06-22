import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PrediccionesService } from '../../services/api.service';
import { SolicitudConPrediccion } from '../../models/models';

type Filtro = 'todas' | 'dentro' | 'fuera' | 'riesgo_alto' | 'alertadas' | 'criticas';

@Component({
  selector: 'app-predicciones',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Predicciones ANS</h1>
        <p class="page-sub">Solicitudes con predicción real del modelo Random Forest v2 · ordenadas por riesgo</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="filter-bar">
      <button *ngFor="let f of filtros" class="filter-btn" [class.active]="filtroActivo === f.key"
              (click)="setFiltro(f.key)">
        {{ f.label }}
        <span class="filter-count" *ngIf="getCount(f.key) > 0">{{ getCount(f.key) }}</span>
      </button>
      <span class="filter-total">{{ filtered.length }} resultado{{ filtered.length !== 1 ? 's' : '' }}</span>
    </div>

    <!-- Tabla -->
    <div class="card table-wrap">
      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div><p>Cargando predicciones...</p>
      </div>

      <div class="table-scroller" *ngIf="!loading">
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Aseguradora</th>
              <th>Ramo</th>
              <th>Ejecutivo</th>
              <th>Predicción ANS</th>
              <th>Prob. incumplimiento</th>
              <th>Nivel riesgo</th>
              <th>Fecha recepción</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filtered"
                class="data-row"
                [class.row-critico]="s.nivel_riesgo === 'critico'"
                [class.row-alto]="s.nivel_riesgo === 'alto'"
                [class.row-alertada]="s.alertada"
                (click)="verSolicitud(s)"
                title="Ver solicitud">

              <td>
                <span class="ticket-chip">{{ s.nro_ticket || '—' }}</span>
                <span *ngIf="s.alertada" class="alerta-dot" title="Alerta activa"></span>
              </td>
              <td class="col-cliente">{{ s.cliente || '—' }}</td>
              <td class="col-tipo">{{ s.tipo_solicitud || '—' }}</td>
              <td class="col-aseg">{{ s.aseguradora || '—' }}</td>
              <td class="col-ramo">{{ s.ramo || '—' }}</td>
              <td class="col-exec">{{ s.ejecutivo || '—' }}</td>

              <td>
                <span class="badge" [class]="s.cumple_ans ? 'badge-success' : 'badge-danger'">
                  {{ s.cumple_ans ? '✓ Dentro' : '✗ Fuera' }}
                </span>
              </td>

              <td>
                <div class="prob-cell" *ngIf="s.probabilidad_riesgo != null">
                  <span class="prob-pct" [class]="getProbClass(s.nivel_riesgo)">
                    {{ (s.probabilidad_riesgo * 100) | number:'1.1-1' }}%
                  </span>
                  <div class="prob-bar">
                    <div class="prob-fill" [class]="getProbClass(s.nivel_riesgo)"
                         [style.width.%]="s.probabilidad_riesgo * 100"></div>
                  </div>
                </div>
                <span *ngIf="s.probabilidad_riesgo == null" class="text-muted">—</span>
              </td>

              <td>
                <span class="badge" [class]="getNivelBadge(s.nivel_riesgo)">
                  {{ s.nivel_riesgo | uppercase }}
                </span>
              </td>

              <td class="col-fecha">
                {{ s.fecha_recepcion ? (s.fecha_recepcion | date:'dd MMM yy, HH:mm') : '—' }}
              </td>

              <td>
                <span class="badge" [class]="getEstadoBadge(s.estado)">{{ s.estado }}</span>
              </td>
            </tr>

            <tr *ngIf="filtered.length === 0 && !loading">
              <td colspan="11">
                <div class="empty-state">
                  <div class="empty-icon">◎</div>
                  <h3>Sin resultados</h3>
                  <p>No hay solicitudes con predicción RF v2 para el filtro seleccionado.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="load-more" *ngIf="!loading && canLoadMore">
        <button class="btn btn-outline" (click)="loadMore()" [disabled]="loadingMore">
          {{ loadingMore ? 'Cargando...' : '↓ Cargar más' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 6px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); }
    .page-sub { font-size: 0.82rem; color: var(--text-muted); margin-top: 4px; }

    /* Filtros */
    .filter-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .filter-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px;
      background: var(--bg-card); color: var(--text-secondary);
      font-size: 0.8rem; font-weight: 500; cursor: pointer;
      transition: all .15s;
    }
    .filter-btn:hover { border-color: var(--primary); color: var(--primary); }
    .filter-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    .filter-count {
      background: rgba(255,255,255,.25); border-radius: 10px;
      padding: 0 6px; font-size: 0.72rem; font-weight: 700;
    }
    .filter-btn:not(.active) .filter-count {
      background: rgba(0,0,0,.07); color: var(--text-muted);
    }
    .filter-total { margin-left: auto; font-size: 0.78rem; color: var(--text-muted); }

    /* Tabla */
    .table-wrap { padding: 0; overflow: hidden; }
    .table-scroller { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; white-space: nowrap; }
    thead th {
      text-align: left; padding: 10px 12px;
      background: var(--bg-surface); border-bottom: 2px solid var(--border);
      color: var(--text-secondary); font-size: 0.72rem; text-transform: uppercase;
      letter-spacing: .5px; font-weight: 600;
    }
    tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .data-row { cursor: pointer; transition: background .1s; }
    .data-row:hover td { background: var(--bg-hover); }
    .row-critico td { background: rgba(239,68,68,.04); }
    .row-alto td { background: rgba(249,115,22,.03); }
    .row-alertada td:first-child { border-left: 3px solid #F97316; }

    /* Ticket */
    .ticket-chip { font-family: var(--font-mono,monospace); font-size: 0.78rem; font-weight: 700; color: var(--primary); }
    .alerta-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #F97316; margin-left: 5px; vertical-align: middle; }

    /* Columnas */
    .col-cliente, .col-tipo, .col-aseg { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
    .col-ramo, .col-exec { max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
    .col-fecha { font-size: 0.76rem; color: var(--text-muted); }

    /* Prob */
    .prob-cell { min-width: 90px; }
    .prob-pct { font-size: 0.82rem; font-weight: 700; display: block; margin-bottom: 3px; }
    .prob-pct.low  { color: #22c55e; }
    .prob-pct.medium { color: #f59e0b; }
    .prob-pct.high { color: #F97316; }
    .prob-pct.critical { color: #ef4444; }
    .prob-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .prob-fill { height: 100%; border-radius: 2px; transition: width .3s; }
    .prob-fill.low  { background: #22c55e; }
    .prob-fill.medium { background: #f59e0b; }
    .prob-fill.high { background: #F97316; }
    .prob-fill.critical { background: #ef4444; }

    /* Badges */
    .badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; }
    .badge-success { background: rgba(34,197,94,.1); color: #16a34a; }
    .badge-danger  { background: rgba(239,68,68,.1); color: #dc2626; }
    .badge-warning { background: rgba(245,158,11,.1); color: #d97706; }
    .badge-info    { background: rgba(99,102,241,.1); color: #6366f1; }
    .badge-critical { background: rgba(239,68,68,.15); color: #b91c1c; border: 1px solid rgba(239,68,68,.3); }
    .text-muted { color: var(--text-muted); }

    /* Load more */
    .load-more { padding: 16px; text-align: center; border-top: 1px solid var(--border); }

    /* Empty */
    .loading-state { padding: 60px; text-align: center; color: var(--text-muted); }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin .8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { padding: 60px 20px; text-align: center; color: var(--text-muted); }
    .empty-icon { font-size: 2rem; margin-bottom: 12px; }
    .empty-state h3 { color: var(--text-secondary); margin-bottom: 6px; }
  `],
})
export class PrediccionesComponent implements OnInit {
  items: SolicitudConPrediccion[] = [];
  filtered: SolicitudConPrediccion[] = [];
  loading = true;
  loadingMore = false;
  canLoadMore = false;
  skip = 0;
  readonly limit = 100;

  filtroActivo: Filtro = 'todas';

  filtros: { key: Filtro; label: string }[] = [
    { key: 'todas',       label: 'Todas' },
    { key: 'dentro',      label: 'Dentro de ANS' },
    { key: 'fuera',       label: 'Fuera de ANS' },
    { key: 'riesgo_alto', label: 'Riesgo alto ≥ 70%' },
    { key: 'alertadas',   label: 'Alertadas ≥ 80%' },
    { key: 'criticas',    label: 'Críticas ≥ 90%' },
  ];

  constructor(private service: PrediccionesService, private router: Router) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.skip = 0;
    this.service.resultados({ skip: 0, limit: this.limit }).subscribe({
      next: (data) => {
        this.items = data;
        this.canLoadMore = data.length === this.limit;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadMore() {
    this.skip += this.limit;
    this.loadingMore = true;
    this.service.resultados({ skip: this.skip, limit: this.limit }).subscribe({
      next: (data) => {
        this.items = [...this.items, ...data];
        this.canLoadMore = data.length === this.limit;
        this.applyFilter();
        this.loadingMore = false;
      },
      error: () => { this.loadingMore = false; },
    });
  }

  setFiltro(f: Filtro) {
    this.filtroActivo = f;
    this.applyFilter();
  }

  applyFilter() {
    switch (this.filtroActivo) {
      case 'dentro':
        this.filtered = this.items.filter(s => s.cumple_ans === true);
        break;
      case 'fuera':
        this.filtered = this.items.filter(s => s.cumple_ans === false);
        break;
      case 'riesgo_alto':
        this.filtered = this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.70);
        break;
      case 'alertadas':
        this.filtered = this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.80);
        break;
      case 'criticas':
        this.filtered = this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.90);
        break;
      default:
        this.filtered = [...this.items];
    }
  }

  getCount(f: Filtro): number {
    switch (f) {
      case 'todas':       return this.items.length;
      case 'dentro':      return this.items.filter(s => s.cumple_ans === true).length;
      case 'fuera':       return this.items.filter(s => s.cumple_ans === false).length;
      case 'riesgo_alto': return this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.70).length;
      case 'alertadas':   return this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.80).length;
      case 'criticas':    return this.items.filter(s => (s.probabilidad_riesgo ?? 0) >= 0.90).length;
      default:            return 0;
    }
  }

  verSolicitud(s: SolicitudConPrediccion) {
    this.router.navigate(['/solicitudes'], {
      queryParams: { search: s.nro_ticket || s.id },
    });
  }

  getProbClass(nivel?: string): string {
    const map: Record<string, string> = { bajo: 'low', medio: 'medium', alto: 'high', critico: 'critical' };
    return map[nivel ?? ''] ?? 'low';
  }

  getNivelBadge(nivel?: string): string {
    const map: Record<string, string> = {
      bajo: 'badge-success', medio: 'badge-warning', alto: 'badge-danger', critico: 'badge-critical',
    };
    return map[nivel ?? ''] ?? 'badge-info';
  }

  getEstadoBadge(estado: string): string {
    const s = (estado || '').toLowerCase();
    if (s.includes('finaliz') || s.includes('complet')) return 'badge-success';
    if (s.includes('proceso') || s.includes('progres')) return 'badge-info';
    if (s.includes('vencid')) return 'badge-danger';
    return 'badge-warning';
  }
}
