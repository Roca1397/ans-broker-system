import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon.component';
import { CriticalRequest } from '../dashboard.models';

@Component({
  selector: 'app-critical-requests',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="alert-triangle" [size]="14"></app-icon>
          Solicitudes Criticas
        </span>
        <span class="card-badge" *ngIf="total > requests.length">
          +{{ total - requests.length }} mas
        </span>
      </div>

      <table class="critical-table">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Riesgo</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of requests">
            <td>
              <a class="ticket-link" [routerLink]="['/solicitudes', r.id]">{{ r.nroTicket }}</a>
            </td>
            <td>{{ r.cliente }}</td>
            <td>{{ r.tipo }}</td>
            <td>
              <span class="prob-badge" [class]="badgeClass(r.probabilidad)">
                {{ (r.probabilidad * 100).toFixed(0) }}%
              </span>
            </td>
            <td>
              <span class="horas-chip" [class]="horasClass(r.horasRestantes)">
                <app-icon name="clock" [size]="12"></app-icon>
                {{ r.horasRestantes }}h
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class CriticalRequestsComponent {
  @Input() requests: CriticalRequest[] = [];
  @Input() total = 0;

  badgeClass(p: number): string {
    if (p >= 0.7) return 'critico';
    if (p >= 0.5) return 'alto';
    return 'medio';
  }

  horasClass(h: number): string {
    if (h <= 4)  return 'urgente';
    if (h <= 12) return 'pronto';
    return 'ok';
  }
}
