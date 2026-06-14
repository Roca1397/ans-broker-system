import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';

export interface KpiData {
  label: string;
  value: number | string;
  unit?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon?: string;
  sub?: string;
}

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card kpi-card" [class]="'color-' + (kpi.color || 'default')">
      <div class="kpi-icon-row" *ngIf="kpi.icon">
        <app-icon [name]="kpi.icon" [size]="18"></app-icon>
      </div>
      <div class="kpi-value">
        {{ kpi.value }}<span class="kpi-unit" *ngIf="kpi.unit">{{ kpi.unit }}</span>
      </div>
      <div class="kpi-label">{{ kpi.label }}</div>
      <div class="kpi-sub" *ngIf="kpi.sub">{{ kpi.sub }}</div>
    </div>
  `,
})
export class KpiCardComponent {
  @Input() kpi!: KpiData;
}
