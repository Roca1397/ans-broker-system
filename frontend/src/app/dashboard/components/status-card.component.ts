import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { EstadoCount } from '../dashboard.models';

const ESTADO_COLORS: Record<string, string> = {
  pendiente:   '#f59e0b',
  'en proceso':'#3b82f6',
  proceso:     '#3b82f6',
  finalizado:  '#22c55e',
  finalizada:  '#22c55e',
  completado:  '#22c55e',
  vencido:     '#ef4444',
  cerrado:     '#6b7280',
};

function colorFor(nombre: string): string {
  const key = nombre.toLowerCase().trim();
  for (const [k, v] of Object.entries(ESTADO_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#8b5cf6';
}

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

      <ng-container *ngIf="estados.length > 0; else noData">
        <!-- Barra segmentada -->
        <div class="status-seg-bar">
          <div class="seg" *ngFor="let e of estados"
               [style.width]="pct(e) + '%'"
               [style.background]="color(e.nombre)"
               [title]="e.nombre + ': ' + e.count">
          </div>
        </div>

        <!-- Leyenda -->
        <div class="status-legend">
          <div class="legend-row" *ngFor="let e of estados">
            <span class="leg-dot" [style.background]="color(e.nombre)"></span>
            <span class="leg-label">{{ e.nombre }}</span>
            <span class="leg-count">{{ e.count }}</span>
            <span class="leg-pct">{{ pct(e).toFixed(0) }}%</span>
          </div>
        </div>
      </ng-container>

      <ng-template #noData>
        <p class="no-data-msg">Sin datos disponibles</p>
      </ng-template>
    </div>
  `,
})
export class StatusCardComponent {
  @Input() estados: EstadoCount[] = [];

  get total(): number {
    return this.estados.reduce((s, e) => s + e.count, 0) || 1;
  }

  pct(e: EstadoCount): number {
    return (e.count / this.total) * 100;
  }

  color(nombre: string): string {
    return colorFor(nombre);
  }
}
