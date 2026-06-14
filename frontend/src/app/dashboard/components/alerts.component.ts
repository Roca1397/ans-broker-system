import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon.component';
import { Alerta } from '../../models/models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="bell" [size]="14"></app-icon>
          Alertas Recientes
        </span>
        <span class="card-badge" *ngIf="noLeidas > 0">{{ noLeidas }} nuevas</span>
      </div>

      <ng-container *ngIf="alertas.length > 0; else noData">
        <div class="alerts-list">
          <div class="alert-item" *ngFor="let a of alertas" [class.unread]="!a.leida">
            <span class="alert-icon" [class]="iconClass(a.tipo)">
              <app-icon [name]="iconName(a.tipo)" [size]="14"></app-icon>
            </span>
            <div class="alert-body">
              <div class="alert-msg">{{ a.mensaje }}</div>
              <div class="alert-time">
                <span *ngIf="a.nro_ticket">
                  <a class="ticket-link-sm" [routerLink]="['/solicitudes', a.solicitud_id]">
                    {{ a.nro_ticket }}
                  </a>
                  &middot;
                </span>
                {{ formatTime(a.created_at) }}
              </div>
            </div>
            <span class="unread-dot" *ngIf="!a.leida"></span>
          </div>
        </div>
      </ng-container>

      <ng-template #noData>
        <p class="no-data-msg">Sin alertas recientes</p>
      </ng-template>
    </div>
  `,
})
export class AlertsComponent {
  @Input() alertas: Alerta[] = [];

  get noLeidas(): number {
    return this.alertas.filter(a => !a.leida).length;
  }

  iconName(tipo: string): string {
    if (tipo === 'critico' || tipo === 'critical') return 'x-circle';
    if (tipo === 'advertencia' || tipo === 'warning') return 'alert-triangle';
    return 'info';
  }

  iconClass(tipo: string): string {
    if (tipo === 'critico' || tipo === 'critical') return 'critico';
    if (tipo === 'advertencia' || tipo === 'warning') return 'advertencia';
    return 'info';
  }

  formatTime(ts: string): string {
    if (!ts) return '';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'Ahora';
    if (mins < 60)  return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `Hace ${hrs} h`;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }
}
