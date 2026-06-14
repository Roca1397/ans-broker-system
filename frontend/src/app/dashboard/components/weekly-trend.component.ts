import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TendenciaDia } from '../dashboard.models';

@Component({
  selector: 'app-weekly-trend',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M2 12l3-4 3 2 4-6 2 2" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Tendencia Semanal (ultimos 7 dias)
        </span>
      </div>

      <ng-container *ngIf="data.length > 0; else noData">
        <div class="trend-svg-wrap">
          <svg [attr.viewBox]="viewBox" width="100%" [attr.height]="svgH">
            <!-- Barras: ingresadas -->
            <rect *ngFor="let p of data; let i = index"
                  [attr.x]="barX(i)" [attr.y]="barY(p.ingresadas)"
                  [attr.width]="barW" [attr.height]="barH(p.ingresadas)"
                  rx="2" fill="#3b82f6" opacity="0.25"/>

            <!-- Linea: fuera_ans -->
            <polyline *ngIf="data.length > 1"
                      [attr.points]="linePoints"
                      fill="none" stroke="#ef4444" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round"/>

            <!-- Puntos -->
            <circle *ngFor="let p of data; let i = index"
                    [attr.cx]="barX(i) + barW / 2"
                    [attr.cy]="pointY(p.fuera_ans)"
                    r="3" fill="#ef4444"/>

            <!-- Labels eje X -->
            <text *ngFor="let p of data; let i = index"
                  [attr.x]="barX(i) + barW / 2"
                  [attr.y]="svgH - 2"
                  text-anchor="middle" font-size="9" fill="#9ca3af">
              {{ formatLabel(p.fecha) }}
            </text>
          </svg>
        </div>

        <div class="trend-legend">
          <div class="leg-item">
            <div class="leg-swatch bar" style="background:#3b82f6;opacity:.4"></div>
            Solicitudes ingresadas
          </div>
          <div class="leg-item">
            <div class="leg-swatch" style="background:#ef4444;height:3px;border-radius:2px"></div>
            Fuera de ANS
          </div>
        </div>
      </ng-container>

      <ng-template #noData>
        <p class="no-data-msg">Sin datos suficientes para tendencia semanal</p>
      </ng-template>
    </div>
  `,
})
export class WeeklyTrendComponent {
  @Input() data: TendenciaDia[] = [];

  readonly svgH = 120;
  readonly padT = 8;
  readonly padB = 18;
  readonly padL = 8;
  readonly padR = 8;
  readonly svgW = 500;

  get viewBox(): string { return `0 0 ${this.svgW} ${this.svgH}`; }
  get chartH(): number  { return this.svgH - this.padT - this.padB; }
  get groupW(): number  { return (this.svgW - this.padL - this.padR) / (this.data.length || 1); }
  get barW():   number  { return this.groupW * 0.55; }

  private maxIng(): number { return Math.max(...this.data.map(d => d.ingresadas), 1); }
  private maxLine(): number { return Math.max(...this.data.map(d => d.fuera_ans), 1); }

  barX(i: number): number  { return this.padL + i * this.groupW + (this.groupW - this.barW) / 2; }
  barY(v: number): number  { return this.padT + this.chartH * (1 - v / this.maxIng()); }
  barH(v: number): number  { return this.chartH * (v / this.maxIng()); }
  pointY(v: number): number { return this.padT + this.chartH * (1 - v / this.maxLine()); }

  get linePoints(): string {
    return this.data.map((p, i) =>
      `${this.barX(i) + this.barW / 2},${this.pointY(p.fuera_ans)}`
    ).join(' ');
  }

  formatLabel(fecha: string): string {
    if (!fecha) return '';
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'short' });
  }
}
