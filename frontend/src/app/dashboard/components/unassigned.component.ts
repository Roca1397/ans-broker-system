import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon.component';
import { SolicitudSinAsignar } from '../dashboard.models';

@Component({
  selector: 'app-unassigned',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <app-icon name="user" [size]="14"></app-icon>
          Sin Asignar
        </span>
        <span class="card-badge" *ngIf="total > 0">{{ total }}</span>
      </div>

      <ng-container *ngIf="lista.length > 0; else noData">
        <div class="unassigned-list">
          <div class="ua-row" *ngFor="let s of lista">
            <div class="ua-top">
              <a class="ticket-link" [routerLink]="['/solicitudes', s.id]">
                {{ s.nro_ticket || 'Sin ticket' }}
              </a>
              <span class="ua-prio" *ngIf="s.prioridad">{{ s.prioridad }}</span>
            </div>
            <div class="ua-bottom">
              <span class="ua-cliente">{{ s.cliente || '—' }}</span>
              <span class="ua-tipo" *ngIf="s.tipo_solicitud">&middot; {{ s.tipo_solicitud }}</span>
              <span class="ua-fecha" *ngIf="s.fecha_recepcion">
                &middot; {{ formatFecha(s.fecha_recepcion) }}
              </span>
            </div>
          </div>
        </div>
        <div class="ua-footer" *ngIf="total > lista.length">
          <a routerLink="/solicitudes" [queryParams]="{sin_asignar: true}" class="ver-mas-link">
            Ver las {{ total - lista.length }} restantes →
          </a>
        </div>
      </ng-container>

      <ng-template #noData>
        <p class="no-data-msg">Todas las solicitudes estan asignadas</p>
      </ng-template>
    </div>
  `,
})
export class UnassignedComponent {
  @Input() lista: SolicitudSinAsignar[] = [];
  @Input() total = 0;

  formatFecha(f: string): string {
    return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }
}
