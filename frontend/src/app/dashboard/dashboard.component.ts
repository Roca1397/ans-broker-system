import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';

import { DashboardDataService } from './dashboard.service';
import { DashboardResumen, AnsBreakdownItem } from './dashboard.models';
import { Alerta } from '../models/models';
import { KpiData, KpiCardComponent }        from './components/kpi-card.component';
import { RiskPanelComponent }               from './components/risk-panel.component';
import { StatusCardComponent }              from './components/status-card.component';
import { CriticalRequestsComponent }        from './components/critical-requests.component';
import { WorkloadComponent }                from './components/workload.component';
import { AlertsComponent }                  from './components/alerts.component';
import { AnsCumplimientoComponent }         from './components/ans-cumplimiento.component';
import { UnassignedComponent }              from './components/unassigned.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./dashboard.styles.scss'],
  imports: [
    CommonModule, RouterLink,
    KpiCardComponent, RiskPanelComponent, StatusCardComponent,
    CriticalRequestsComponent, WorkloadComponent, AlertsComponent,
    AnsCumplimientoComponent, UnassignedComponent,
  ],
  template: `
<div class="sla-dashboard">

  <!-- Header -->
  <header class="dash-header">
    <div>
      <h1 class="dash-title">Centro de Control ANS</h1>
      <p class="dash-subtitle">SLAGuardian &middot; Datos en tiempo real</p>
    </div>
    <div class="dash-actions">
      <button class="range-btn" (click)="refresh()" [disabled]="loading" title="Actualizar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             [class.spinning]="loading">
          <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Actualizar
      </button>
      <a routerLink="/solicitudes/nueva" class="btn btn-primary" style="font-size:.82rem;padding:7px 14px">
        + Nueva Solicitud
      </a>
    </div>
  </header>

  <!-- Error global -->
  <div *ngIf="error" class="dash-error">
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style="flex-shrink:0">
      <path d="M10 3L2 17h16L10 3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M10 9v4M10 15h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    No se pudo cargar el dashboard. Verifique la conexion con el backend.
  </div>

  <!-- Loading -->
  <div *ngIf="loading && !data" class="loading-state">
    <div class="spinner"></div>
    <p>Cargando datos...</p>
  </div>

  <ng-container *ngIf="data">

    <!-- KPI row (6 tarjetas) -->
    <div class="kpi-grid">
      <app-kpi-card *ngFor="let k of kpis" [kpi]="k"></app-kpi-card>
    </div>

    <!-- Fila principal: solicitudes en riesgo + carga ejecutivos -->
    <div class="main-row">
      <app-critical-requests
        class="main-col-wide"
        [requests]="data.solicitudes_riesgo">
      </app-critical-requests>
      <app-workload
        class="main-col-narrow"
        [ejecutivos]="data.carga_ejecutivos">
      </app-workload>
    </div>

    <!-- Fila secundaria: distribución riesgo / sin asignar / alertas -->
    <div class="sec-row">
      <app-risk-panel
        [dist]="data.dist_riesgo"
        [avgProb]="data.promedio_riesgo">
      </app-risk-panel>

      <app-status-card [estados]="data.estados"></app-status-card>

      <app-unassigned
        [lista]="data.sin_asignar_lista"
        [total]="data.sin_asignar">
      </app-unassigned>
    </div>

    <!-- Alertas + Cumplimiento ANS por cliente/ramo -->
    <div class="bottom-row">
      <app-alerts [alertas]="alertas"></app-alerts>
      <app-ans-cumplimiento [breakdown]="ansBreakdown"></app-ans-cumplimiento>
    </div>

  </ng-container>

</div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: DashboardResumen | null = null;
  alertas: Alerta[] = [];
  ansBreakdown: AnsBreakdownItem[] = [];
  loading = false;
  error = false;

  private destroy$ = new Subject<void>();

  constructor(
    private dashService: DashboardDataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() { this.load(); }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh() { this.load(); }

  get kpis(): KpiData[] {
    if (!this.data) return [];
    const d = this.data;
    return [
      {
        label: 'Total Solicitudes',
        value: d.total,
        icon: 'layers',
        color: 'default',
      },
      {
        label: 'Pendientes',
        value: d.pendientes,
        icon: 'clock',
        color: 'warning',
        sub: d.sin_asignar > 0 ? `${d.sin_asignar} sin asignar` : undefined,
      },
      {
        label: 'En Proceso',
        value: d.en_proceso,
        icon: 'activity',
        color: 'info',
      },
      {
        label: 'Finalizadas',
        value: d.finalizadas,
        icon: 'check-circle',
        color: 'success',
      },
      {
        label: 'Fuera de ANS',
        value: d.fuera_ans,
        icon: 'alert-triangle',
        color: d.fuera_ans > 0 ? 'danger' : 'default',
      },
      {
        label: 'Alto / Critico',
        value: d.alto_riesgo + d.criticos,
        icon: 'zap',
        color: (d.alto_riesgo + d.criticos) > 0 ? 'danger' : 'default',
        sub: d.criticos > 0 ? `${d.criticos} criticos` : undefined,
      },
    ];
  }

  private load() {
    this.loading = true;
    this.error = false;
    this.cdr.markForCheck();

    forkJoin({
      resumen: this.dashService.getResumen(),
      alertas: this.dashService.getAlertasRecientes(6),
      ans:     this.dashService.getAnsCumplimiento(),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ resumen, alertas, ans }) => {
        this.data         = resumen;
        this.alertas      = alertas;
        this.ansBreakdown = ans.breakdown;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error   = true;
        this.cdr.markForCheck();
      },
    });
  }
}
