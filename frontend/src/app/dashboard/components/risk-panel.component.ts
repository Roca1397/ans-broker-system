import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { RiskSummary } from '../dashboard.models';

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
          Riesgo Global ANS
        </span>
      </div>

      <!-- SVG Gauge semicircle -->
      <div class="gauge-wrap">
        <div class="gauge-center">
          <svg viewBox="0 0 200 116" width="200" height="116">
            <!-- Track -->
            <path d="M 15 116 A 85 85 0 0 1 185 116"
                  fill="none" stroke="#e5e7eb" stroke-width="16"
                  stroke-linecap="round"/>
            <!-- Fill -->
            <path d="M 15 116 A 85 85 0 0 1 185 116"
                  fill="none" [attr.stroke]="gaugeColor" stroke-width="16"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="arcLen"
                  [attr.stroke-dashoffset]="dashOffset"/>
          </svg>
          <div class="gauge-label-overlay">
            <div class="gauge-pct" [style.color]="gaugeColor">
              {{ (risk.avgProbability * 100).toFixed(1) }}%
            </div>
            <div class="gauge-sublabel">probabilidad promedio</div>
          </div>
        </div>
      </div>

      <!-- Distribution bands -->
      <div class="risk-bands">
        <div class="band-row" *ngFor="let b of risk.bands">
          <span class="band-dot" [style.background]="b.color"></span>
          <span class="band-label">{{ b.label }}</span>
          <div class="band-bar-wrap">
            <div class="band-bar" [style.width]="b.pct + '%'" [style.background]="b.color"></div>
          </div>
          <span class="band-count">{{ b.count }}</span>
        </div>
      </div>
    </div>
  `,
})
export class RiskPanelComponent {
  @Input() risk!: RiskSummary;

  readonly arcLen = Math.PI * 85;

  get dashOffset(): number {
    const fill = Math.min(Math.max(this.risk.avgProbability, 0), 1);
    return this.arcLen * (1 - fill);
  }

  get gaugeColor(): string {
    const p = this.risk.avgProbability;
    if (p >= 0.7) return '#7c3aed';
    if (p >= 0.5) return '#ef4444';
    if (p >= 0.3) return '#f59e0b';
    return '#22c55e';
  }
}
