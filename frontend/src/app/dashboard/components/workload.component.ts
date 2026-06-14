import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { Executive } from '../dashboard.models';

@Component({
  selector: 'app-workload',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="users" [size]="14"></app-icon>
          Carga por Ejecutivo
        </span>
      </div>

      <div class="workload-list">
        <div class="exec-row" *ngFor="let e of executives">
          <div class="exec-top">
            <span class="exec-name">{{ e.nombre }}</span>
            <span class="exec-meta">{{ e.pendientes }} pend. &middot; {{ e.fueraAns }} fuera ANS</span>
          </div>
          <div class="exec-bar-wrap">
            <div class="exec-bar" [class]="barClass(e.carga)"
                 [style.width]="e.carga + '%'"></div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class WorkloadComponent {
  @Input() executives: Executive[] = [];

  barClass(carga: number): string {
    if (carga >= 85) return 'high';
    if (carga >= 60) return 'medium';
    return 'low';
  }
}
