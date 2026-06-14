import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { StatusItem } from '../dashboard.models';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="bar-chart" [size]="14"></app-icon>
          Estado de Solicitudes
        </span>
      </div>

      <!-- Segmented bar -->
      <div class="status-seg-bar">
        <div class="seg" *ngFor="let s of status"
             [style.width]="pct(s) + '%'"
             [style.background]="s.color"
             [title]="s.label + ': ' + s.count">
        </div>
      </div>

      <!-- Legend -->
      <div class="status-legend">
        <div class="legend-row" *ngFor="let s of status">
          <span class="leg-dot" [style.background]="s.color"></span>
          <span class="leg-label">{{ s.label }}</span>
          <span class="leg-count">{{ s.count }}</span>
          <span class="leg-pct">{{ pct(s).toFixed(0) }}%</span>
        </div>
      </div>
    </div>
  `,
})
export class StatusCardComponent {
  @Input() status: StatusItem[] = [];

  get total(): number {
    return this.status.reduce((s, i) => s + i.count, 0) || 1;
  }

  pct(item: StatusItem): number {
    return (item.count / this.total) * 100;
  }
}
