import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon.component';
import { AlertItem } from '../dashboard.models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="bell" [size]="14"></app-icon>
          Alertas
        </span>
        <span class="card-badge" *ngIf="newCount > 0">{{ newCount }} nuevas</span>
      </div>

      <div class="alerts-list">
        <div class="alert-item" *ngFor="let a of alerts" [class.unread]="!a.leida">
          <span class="alert-icon" [class]="a.tipo">
            <app-icon [name]="iconName(a.tipo)" [size]="14"></app-icon>
          </span>
          <div class="alert-body">
            <div class="alert-msg">{{ a.mensaje }}</div>
            <div class="alert-time">{{ a.tiempo }}</div>
          </div>
          <span class="unread-dot" *ngIf="!a.leida"></span>
        </div>
      </div>
    </div>
  `,
})
export class AlertsComponent {
  @Input() alerts: AlertItem[] = [];
  @Input() newCount = 0;

  iconName(tipo: string): string {
    if (tipo === 'critico')     return 'x-circle';
    if (tipo === 'advertencia') return 'alert-triangle';
    return 'info';
  }
}
