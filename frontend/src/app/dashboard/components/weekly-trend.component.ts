import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrendPoint } from '../dashboard.models';

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
          Tendencia Semanal
        </span>
      </div>

      <div class="trend-svg-wrap" *ngIf="data.length">
        <svg [attr.viewBox]="viewBox" width="100%" [attr.height]="svgH">
          <!-- Bars (ingresadas) -->
          <rect *ngFor="let p of data; let i = index"
                [attr.x]="barX(i)"
                [attr.y]="barY(p.ingresadas)"
                [attr.width]="barW"
                [attr.height]="barH(p.ingresadas)"
                rx="2" fill="#3b82f6" opacity="0.2"/>

          <!-- Line: fuera ANS -->
          <polyline [attr.points]="linePoints('fueraAns')"
                    fill="none" stroke="#ef4444" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>

          <!-- Line: riesgo promedio -->
          <polyline [attr.points]="linePoints('riesgoProm')"
                    fill="none" stroke="#f59e0b" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round"
                    stroke-dasharray="4 3"/>

          <!-- X labels -->
          <text *ngFor="let p of data; let i = index"
                [attr.x]="barX(i) + barW / 2"
                [attr.y]="svgH - 2"
                text-anchor="middle"
                font-size="9"
                fill="#9ca3af">{{ p.label }}</text>
        </svg>

        <div class="trend-legend">
          <div class="leg-item">
            <div class="leg-swatch bar" style="background:#3b82f6;opacity:.3"></div>
            Ingresadas
          </div>
          <div class="leg-item">
            <div class="leg-swatch" style="background:#ef4444;height:3px"></div>
            Fuera de ANS
          </div>
          <div class="leg-item">
            <div class="leg-swatch" style="background:#f59e0b;height:3px"></div>
            Riesgo prom. (%)
          </div>
        </div>
      </div>

      <div *ngIf="!data.length" style="text-align:center;padding:36px;color:var(--text-muted);font-size:.82rem">
        Sin datos de tendencia
      </div>
    </div>
  `,
})
export class WeeklyTrendComponent {
  @Input() data: TrendPoint[] = [];

  readonly svgH = 130;
  readonly padT = 10;
  readonly padB = 18;
  readonly padL = 8;
  readonly padR = 8;

  get chartH(): number { return this.svgH - this.padT - this.padB; }
  get svgW(): number   { return 500; }
  get viewBox(): string { return `0 0 ${this.svgW} ${this.svgH}`; }

  get barW(): number {
    const n = this.data.length || 1;
    return (this.svgW - this.padL - this.padR) / n * 0.6;
  }

  private groupW(): number {
    const n = this.data.length || 1;
    return (this.svgW - this.padL - this.padR) / n;
  }

  barX(i: number): number {
    return this.padL + i * this.groupW() + (this.groupW() - this.barW) / 2;
  }

  private maxIngresadas(): number {
    return Math.max(...this.data.map(d => d.ingresadas), 1);
  }

  private maxLine(): number {
    return Math.max(
      ...this.data.map(d => d.fueraAns),
      ...this.data.map(d => d.riesgoProm),
      1
    );
  }

  barY(v: number): number {
    return this.padT + this.chartH * (1 - v / this.maxIngresadas());
  }

  barH(v: number): number {
    return this.chartH * (v / this.maxIngresadas());
  }

  linePoints(field: 'fueraAns' | 'riesgoProm'): string {
    const max = this.maxLine();
    return this.data.map((p, i) => {
      const x = this.barX(i) + this.barW / 2;
      const y = this.padT + this.chartH * (1 - p[field] / max);
      return `${x},${y}`;
    }).join(' ');
  }
}
