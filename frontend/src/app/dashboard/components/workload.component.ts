import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { CargaEjecutivo } from '../dashboard.models';

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

      <ng-container *ngIf="ejecutivos.length > 0; else noData">
        <div class="workload-list">
          <div class="exec-row" *ngFor="let e of ejecutivos">
            <div class="exec-top">
              <span class="exec-name">{{ e.ejecutivo }}</span>
              <span class="exec-meta">
                {{ e.total }} total
                <span *ngIf="e.en_riesgo > 0" class="exec-riesgo">&middot; {{ e.en_riesgo }} en riesgo</span>
              </span>
            </div>
            <div class="exec-bar-wrap">
              <div class="exec-bar" [class]="barClass(e.carga_pct)"
                   [style.width]="e.carga_pct + '%'"></div>
            </div>
          </div>
        </div>
      </ng-container>

      <ng-template #noData>
        <p class="no-data-msg">Sin solicitudes asignadas</p>
      </ng-template>
    </div>
  `,
})
export class WorkloadComponent {
  @Input() ejecutivos: CargaEjecutivo[] = [];

  barClass(pct: number): string {
    if (pct >= 85) return 'high';
    if (pct >= 55) return 'medium';
    return 'low';
  }
}
