import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { DistRiesgo } from '../dashboard.models';

interface Band { label: string; count: number; color: string; pct: number; }

@Component({
  selector: 'app-risk-panel',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="shield" [size]="14"></app-icon>
          Distribución por Riesgo
        </span>
      </div>

      <!-- Gauge -->
      <div class="gauge-wrap">
        <div class="gauge-center">
          <svg viewBox="0 0 200 116" width="200" height="116">
            <path d="M 15 116 A 85 85 0 0 1 185 116"
                  fill="none" stroke="#e5e7eb" stroke-width="16" stroke-linecap="round"/>
            <path d="M 15 116 A 85 85 0 0 1 185 116"
                  fill="none" [attr.stroke]="gaugeColor" stroke-width="16"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="arcLen"
                  [attr.stroke-dashoffset]="dashOffset"/>
          </svg>
          <div class="gauge-label-overlay">
            <div class="gauge-pct" [style.color]="gaugeColor">
              {{ (avgProb * 100).toFixed(1) }}%
            </div>
            <div class="gauge-sublabel">riesgo promedio</div>
          </div>
        </div>
      </div>

      <!-- Bands -->
      <div class="risk-bands" *ngIf="total > 0; else noData">
        <div class="band-row" *ngFor="let b of bands">
          <span class="band-dot" [style.background]="b.color"></span>
          <span class="band-label">{{ b.label }}</span>
          <div class="band-bar-wrap">
            <div class="band-bar" [style.width]="b.pct + '%'" [style.background]="b.color"></div>
          </div>
          <span class="band-count">{{ b.count }}</span>
        </div>
      </div>
      <ng-template #noData>
        <p class="no-data-msg">Sin solicitudes con predicción RF v2</p>
      </ng-template>
    </div>
  `,
})
export class RiskPanelComponent {
  @Input() dist!: DistRiesgo;
  @Input() avgProb = 0;

  readonly arcLen = Math.PI * 85;

  get total(): number {
    if (!this.dist) return 0;
    return this.dist.bajo + this.dist.medio + this.dist.alto + this.dist.critico;
  }

  get bands(): Band[] {
    if (!this.dist) return [];
    const t = this.total || 1;
    return [
      { label: 'Bajo (0–39%)',    count: this.dist.bajo,    color: '#22c55e', pct: (this.dist.bajo    / t) * 100 },
      { label: 'Medio (40–69%)', count: this.dist.medio,   color: '#f59e0b', pct: (this.dist.medio   / t) * 100 },
      { label: 'Alto (70–89%)',  count: this.dist.alto,    color: '#ef4444', pct: (this.dist.alto    / t) * 100 },
      { label: 'Critico (90%+)', count: this.dist.critico, color: '#7c3aed', pct: (this.dist.critico / t) * 100 },
    ];
  }

  get dashOffset(): number {
    const fill = Math.min(Math.max(this.avgProb, 0), 1);
    return this.arcLen * (1 - fill);
  }

  get gaugeColor(): string {
    if (this.avgProb >= 0.70) return '#7c3aed';
    if (this.avgProb >= 0.50) return '#ef4444';
    if (this.avgProb >= 0.30) return '#f59e0b';
    return '#22c55e';
  }
}
