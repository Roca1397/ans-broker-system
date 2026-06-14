import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { Kpi } from '../dashboard.models';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card kpi-card" [class]="colorClass">
      <div class="kpi-label">{{ kpi.label }}</div>
      <div class="kpi-value">
        {{ kpi.value }}<span class="kpi-unit" *ngIf="kpi.unit">{{ kpi.unit }}</span>
      </div>
      <div *ngIf="kpi.trend !== undefined" class="kpi-trend" [class]="kpi.trend >= 0 ? 'up' : 'down'">
        <app-icon [name]="kpi.trend >= 0 ? 'trending-up' : 'trending-down'" [size]="13"></app-icon>
        {{ kpi.trend >= 0 ? '+' : '' }}{{ kpi.trend }}%
        <span class="trend-label">{{ kpi.trendLabel }}</span>
      </div>
      <svg *ngIf="kpi.sparkline" class="sparkline" [attr.viewBox]="sparkViewBox"
           width="100%" height="36" preserveAspectRatio="none">
        <polyline [attr.points]="sparkPoints" fill="none"
                  stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
      </svg>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() kpi!: Kpi;

  get colorClass(): string {
    return this.kpi.color && this.kpi.color !== 'default' ? `color-${this.kpi.color}` : '';
  }

  get sparkPoints(): string {
    const data = this.kpi.sparkline ?? [];
    if (!data.length) return '';
    const max = Math.max(...data) || 1;
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 100, h = 36, pad = 3;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - pad - ((v - min) / range) * (h - 2 * pad);
        return `${x},${y}`;
      })
      .join(' ');
  }

  get sparkViewBox(): string {
    return '0 0 100 36';
  }
}
