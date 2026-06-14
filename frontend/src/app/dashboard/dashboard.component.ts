import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { DashboardMockService } from './dashboard.service';
import { DashboardData, DateRange } from './dashboard.models';

import { KpiCardComponent }          from './components/kpi-card.component';
import { RiskPanelComponent }        from './components/risk-panel.component';
import { StatusCardComponent }       from './components/status-card.component';
import { CriticalRequestsComponent } from './components/critical-requests.component';
import { WorkloadComponent }         from './components/workload.component';
import { AlertsComponent }           from './components/alerts.component';
import { WeeklyTrendComponent }      from './components/weekly-trend.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    KpiCardComponent, RiskPanelComponent, StatusCardComponent,
    CriticalRequestsComponent, WorkloadComponent, AlertsComponent,
    WeeklyTrendComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./dashboard.styles.scss'],
  template: `
<div class="sla-dashboard">

  <!-- Header -->
  <header class="dash-header">
    <div>
      <h1 class="dash-title">Dashboard ANS</h1>
      <p class="dash-subtitle">Gestion predictiva de solicitudes &middot; Actualizado ahora</p>
    </div>
    <div class="dash-actions">
      <button *ngFor="let r of ranges"
              class="range-btn" [class.active]="activeRange === r.value"
              (click)="setRange(r.value)">
        {{ r.label }}
      </button>
      <a routerLink="/solicitudes/nueva" class="btn btn-primary" style="font-size:.82rem;padding:7px 14px">
        + Nueva Solicitud
      </a>
    </div>
  </header>

  <!-- Loading -->
  <div *ngIf="loading" class="loading-state">
    <div class="spinner"></div>
    <p>Cargando...</p>
  </div>

  <ng-container *ngIf="!loading && data">

    <!-- KPI row -->
    <div class="kpi-grid">
      <app-kpi-card *ngFor="let k of data.kpis" [kpi]="k"></app-kpi-card>
    </div>

    <!-- Middle row: Risk | Status | Critical -->
    <div class="mid-row">
      <app-risk-panel   [risk]="data.risk"></app-risk-panel>
      <app-status-card  [status]="data.status"></app-status-card>
      <app-critical-requests
        [requests]="data.criticalRequests"
        [total]="data.totalCritical">
      </app-critical-requests>
    </div>

    <!-- Bottom row: Trend | Workload | Alerts -->
    <div class="bottom-row">
      <app-weekly-trend [data]="data.weeklyTrend"></app-weekly-trend>
      <app-workload     [executives]="data.executives"></app-workload>
      <app-alerts       [alerts]="data.alerts" [newCount]="data.newAlerts"></app-alerts>
    </div>

  </ng-container>

</div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  activeRange: DateRange = '30d';
  readonly ranges = [
    { label: '7 dias',  value: '7d'  as DateRange },
    { label: '30 dias', value: '30d' as DateRange },
    { label: '90 dias', value: '90d' as DateRange },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private dashService: DashboardMockService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() { this.load(); }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setRange(r: DateRange) {
    this.activeRange = r;
    this.load();
  }

  private load() {
    this.loading = true;
    this.cdr.markForCheck();
    this.dashService.getDashboard(this.activeRange)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => { this.data = d; this.loading = false; this.cdr.markForCheck(); },
        error: ()  => { this.loading = false; this.cdr.markForCheck(); },
      });
  }
}
