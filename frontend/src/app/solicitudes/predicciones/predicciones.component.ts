import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PrediccionesService } from '../../services/api.service';
import { SolicitudConPrediccion } from '../../models/models';

@Component({
  selector: 'app-predicciones',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Predicciones ANS</h1>
        <p>Tabla de resultados con predicción, probabilidad de riesgo y estado</p>
      </div>
      <a routerLink="/solicitudes/nueva" class="btn btn-primary">✦ Nueva Solicitud</a>
    </div>

    <!-- Alertas críticas -->
    <div *ngFor="let s of criticos" class="alert alert-critical" style="margin-bottom: 12px;">
      <span>🚨</span>
      <div>
        <strong>CRÍTICO — {{ s.nro_ticket }}</strong>
        Solicitud de {{ s.aseguradora }} con {{ (s.probabilidad_riesgo! * 100).toFixed(1) }}% de probabilidad de incumplimiento ANS.
        Cliente: {{ s.cliente || '—' }}
      </div>
    </div>

    <!-- Filters -->
    <div class="card" style="padding:16px 24px;margin-bottom:20px">
      <div class="flex gap-3 flex-wrap">
        <select [(ngModel)]="filterRiesgo" (change)="load()" style="min-width:160px">
          <option value="">Todos los riesgos</option>
          <option value="critico">🚨 Crítico</option>
          <option value="alto">🔴 Alto</option>
          <option value="medio">⚠ Medio</option>
          <option value="bajo">✓ Bajo</option>
        </select>
        <select [(ngModel)]="filterAns" (change)="applyClientFilter()" style="min-width:180px">
          <option value="">Todos los resultados</option>
          <option value="fuera">Fuera del ANS</option>
          <option value="dentro">Dentro del ANS</option>
        </select>
        <button class="btn btn-outline btn-sm" (click)="clearFilters()">✕ Limpiar</button>
        <span style="margin-left:auto;font-size:0.82rem;color:var(--text-muted);align-self:center">
          {{ filtered.length }} resultados
        </span>
      </div>
    </div>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <div *ngIf="loading" class="loading-state"><div class="spinner"></div><p>Cargando predicciones...</p></div>

      <div class="table-wrapper" *ngIf="!loading">
        <table>
          <thead>
            <tr>
              <th>N° Ticket</th>
              <th>Cliente</th>
              <th>Aseguradora</th>
              <th>Límite ANS</th>
              <th>Resultado ANS</th>
              <th>Prob. Riesgo</th>
              <th>Nivel Riesgo</th>
              <th>Estado</th>
              <th>Fecha Predicción</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filtered" [class]="getRowClass(s)">
              <td>
                <span class="font-mono" style="font-size:0.8rem;color:var(--primary)">{{ s.nro_ticket || '—' }}</span>
              </td>
              <td style="font-size:0.82rem">{{ s.cliente || '—' }}</td>
              <td style="font-size:0.82rem">{{ s.aseguradora || '—' }}</td>
              <td>
                <span class="font-mono" style="font-size:0.8rem;color:var(--text-muted)">
                  {{ s.ans_horas_limite ? s.ans_horas_limite + 'h' : '—' }}
                </span>
              </td>
              <td>
                <span *ngIf="s.cumple_ans !== null && s.cumple_ans !== undefined" class="badge" [class]="s.cumple_ans ? 'badge-success' : 'badge-danger'">
                  {{ s.cumple_ans ? '✓ Dentro' : '✗ Fuera' }}
                </span>
                <span *ngIf="s.cumple_ans === null || s.cumple_ans === undefined" class="text-muted">Sin predicción</span>
              </td>
              <td>
                <div *ngIf="s.probabilidad_riesgo !== null && s.probabilidad_riesgo !== undefined" style="min-width: 120px">
                  <div class="flex-between" style="margin-bottom:4px">
                    <span class="font-mono" style="font-size:0.8rem">{{ (s.probabilidad_riesgo * 100).toFixed(1) }}%</span>
                  </div>
                  <div class="risk-bar" style="height:4px">
                    <div class="risk-fill" [class]="getRiskClass(s.nivel_riesgo)" [style.width]="(s.probabilidad_riesgo * 100) + '%'"></div>
                  </div>
                </div>
                <span *ngIf="s.probabilidad_riesgo === null || s.probabilidad_riesgo === undefined" class="text-muted">—</span>
              </td>
              <td>
                <span *ngIf="s.nivel_riesgo" class="badge" [class]="getBadgeClass(s.nivel_riesgo)">
                  {{ s.nivel_riesgo | uppercase }}
                </span>
                <span *ngIf="!s.nivel_riesgo" class="text-muted">—</span>
              </td>
              <td>
                <span class="badge" [class]="getEstadoBadge(s.estado)">{{ s.estado }}</span>
              </td>
              <td style="font-size:0.78rem;color:var(--text-muted)">
                {{ s.prediccion_fecha ? formatDate(s.prediccion_fecha) : '—' }}
              </td>
            </tr>
            <tr *ngIf="filtered.length === 0">
              <td colspan="9">
                <div class="empty-state">
                  <div class="empty-icon">◎</div>
                  <h3>Sin resultados</h3>
                  <p>Registra solicitudes para ver las predicciones ANS aquí</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Load more -->
      <div class="flex-center" style="padding: 16px; border-top: 1px solid var(--border);" *ngIf="!loading && canLoadMore">
        <button class="btn btn-outline" (click)="loadMore()" [disabled]="loadingMore">
          {{ loadingMore ? 'Cargando...' : '↓ Cargar más' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .row-critico td { background: rgba(255, 34, 68, 0.04); }
    .row-alto td { background: rgba(255, 71, 87, 0.03); }
  `],
})
export class PrediccionesComponent implements OnInit {
  items: SolicitudConPrediccion[] = [];
  filtered: SolicitudConPrediccion[] = [];
  loading = true;
  loadingMore = false;
  filterRiesgo = '';
  filterAns = '';
  skip = 0;
  limit = 50;
  canLoadMore = false;

  constructor(private service: PrediccionesService) {}

  ngOnInit() { this.load(); }

  get criticos(): SolicitudConPrediccion[] {
    return this.items.filter(s => s.nivel_riesgo === 'critico');
  }

  load() {
    this.loading = true;
    this.skip = 0;
    this.service.resultados({ skip: 0, limit: this.limit, nivel_riesgo: this.filterRiesgo || null }).subscribe({
      next: (data) => {
        this.items = data;
        this.canLoadMore = data.length === this.limit;
        this.applyClientFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  loadMore() {
    this.skip += this.limit;
    this.loadingMore = true;
    this.service.resultados({ skip: this.skip, limit: this.limit, nivel_riesgo: this.filterRiesgo || null }).subscribe({
      next: (data) => {
        this.items = [...this.items, ...data];
        this.canLoadMore = data.length === this.limit;
        this.applyClientFilter();
        this.loadingMore = false;
      },
      error: () => { this.loadingMore = false; },
    });
  }

  applyClientFilter() {
    let f = [...this.items];
    if (this.filterAns === 'fuera') f = f.filter(s => s.cumple_ans === false);
    if (this.filterAns === 'dentro') f = f.filter(s => s.cumple_ans === true);
    this.filtered = f;
  }

  clearFilters() { this.filterRiesgo = ''; this.filterAns = ''; this.load(); }

  getRowClass(s: SolicitudConPrediccion): string {
    if (s.nivel_riesgo === 'critico') return 'row-critico';
    if (s.nivel_riesgo === 'alto') return 'row-alto';
    return '';
  }

  getBadgeClass(nivel: string): string {
    const map: Record<string, string> = { bajo: 'badge-success', medio: 'badge-warning', alto: 'badge-danger', critico: 'badge-critical' };
    return map[nivel] || 'badge-info';
  }

  getRiskClass(nivel?: string): string {
    const map: Record<string, string> = { bajo: 'low', medio: 'medium', alto: 'high', critico: 'critical' };
    return map[nivel || ''] || 'low';
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = { pendiente: 'badge-warning', en_proceso: 'badge-info', completado: 'badge-success', vencido: 'badge-danger' };
    return map[estado] || 'badge-info';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
