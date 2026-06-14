import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon.component';
import { SolicitudRiesgo } from '../dashboard.models';

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
          Solicitudes en Riesgo
        </span>
        <span class="card-badge" *ngIf="requests.length > 0">
          {{ requests.length }} registros
        </span>
      </div>

      <ng-container *ngIf="requests.length > 0; else noRiesgo">
        <div style="overflow-x:auto">
          <table class="critical-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Ejecutivo</th>
                <th>Aseguradora</th>
                <th>Probabilidad</th>
                <th>Estado</th>
                <th>Recepcion</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of requests">
                <td>
                  <a class="ticket-link" [routerLink]="['/solicitudes', r.id]">
                    {{ r.nro_ticket || '—' }}
                  </a>
                </td>
                <td class="text-clamp" [title]="r.cliente || ''">{{ r.cliente || '—' }}</td>
                <td>{{ r.tipo_solicitud || '—' }}</td>
                <td>{{ r.ejecutivo || '—' }}</td>
                <td>{{ r.aseguradora || '—' }}</td>
                <td>
                  <span class="prob-badge" [class]="probClass(r.probabilidad)">
                    {{ r.probabilidad != null ? (r.probabilidad * 100).toFixed(0) + '%' : '—' }}
                  </span>
                </td>
                <td>{{ r.estado || '—' }}</td>
                <td class="text-mono-sm">{{ formatFecha(r.fecha_recepcion) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <ng-template #noRiesgo>
        <p class="no-data-msg">Sin solicitudes en riesgo actualmente</p>
      </ng-template>
    </div>
  `,
})
export class CriticalRequestsComponent {
  @Input() requests: SolicitudRiesgo[] = [];

  probClass(p: number | undefined): string {
    if (p == null) return '';
    if (p >= 0.90) return 'critico';
    if (p >= 0.70) return 'alto';
    if (p >= 0.40) return 'medio';
    return 'bajo';
  }

  formatFecha(f: string | undefined): string {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }
}
