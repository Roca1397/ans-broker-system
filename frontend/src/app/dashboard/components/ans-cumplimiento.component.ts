import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnsBreakdownItem } from '../dashboard.models';

@Component({
  selector: 'app-ans-cumplimiento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dash-card">
      <div class="card-header">
        <span class="card-title">
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
            <rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor" opacity=".45"/>
            <rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor" opacity=".7"/>
            <rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor"/>
          </svg>
          Cumplimiento ANS por Cliente y Ramo
        </span>
      </div>

      <!-- Selectores -->
      <div class="ac-filtros">
        <div class="ac-filtro-group">
          <label class="ac-label">Cliente</label>
          <select class="ac-select" [(ngModel)]="clienteSeleccionado" (ngModelChange)="onClienteChange()">
            <option value="todos">Todos los clientes</option>
            <option *ngFor="let c of clientes" [value]="c">{{ c }}</option>
          </select>
        </div>
        <div class="ac-filtro-group">
          <label class="ac-label">Ramo / Producto</label>
          <select class="ac-select" [(ngModel)]="ramoSeleccionado" (ngModelChange)="onRamoChange()">
            <option value="todos">Todos</option>
            <option *ngFor="let r of ramos" [value]="r">{{ r }}</option>
          </select>
        </div>
      </div>

      <!-- Sin predicciones aún -->
      <ng-container *ngIf="breakdown.length === 0">
        <p class="no-data-msg">Sin datos de prediccion ANS disponibles.</p>
      </ng-container>

      <ng-container *ngIf="breakdown.length > 0">

        <!-- Sin resultados para el filtro actual -->
        <ng-container *ngIf="totalVal === 0">
          <p class="no-data-msg">No hay solicitudes para los filtros seleccionados.</p>
        </ng-container>

        <!-- Grafico + resumen -->
        <ng-container *ngIf="totalVal > 0">

          <!-- Barras SVG -->
          <div class="ac-chart">
            <svg [attr.viewBox]="'0 0 ' + svgW + ' ' + svgH" width="100%" [attr.height]="svgH">
              <!-- Guias horizontales -->
              <line [attr.x1]="padL" [attr.x2]="svgW - padL"
                    [attr.y1]="padT" [attr.y2]="padT"
                    stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,3"/>
              <line [attr.x1]="padL" [attr.x2]="svgW - padL"
                    [attr.y1]="padT + chartH * 0.5" [attr.y2]="padT + chartH * 0.5"
                    stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,3"/>
              <line [attr.x1]="padL" [attr.x2]="svgW - padL"
                    [attr.y1]="padT + chartH" [attr.y2]="padT + chartH"
                    stroke="#d1d5db" stroke-width="1"/>

              <!-- Barra: Dentro de ANS -->
              <rect [attr.x]="bar1X" [attr.y]="barY(dentroVal)"
                    [attr.width]="barW" [attr.height]="barH(dentroVal)"
                    rx="4" fill="#22c55e"/>
              <text [attr.x]="bar1X + barW / 2" [attr.y]="barY(dentroVal) - 5"
                    text-anchor="middle" font-size="13" font-weight="700" fill="#16a34a">
                {{ dentroVal }}
              </text>
              <text [attr.x]="bar1X + barW / 2" [attr.y]="svgH - 2"
                    text-anchor="middle" font-size="8.5" fill="#6b7280">Dentro de ANS</text>

              <!-- Barra: Fuera de ANS -->
              <rect [attr.x]="bar2X" [attr.y]="barY(fueraVal)"
                    [attr.width]="barW" [attr.height]="barH(fueraVal)"
                    rx="4" fill="#ef4444"/>
              <text [attr.x]="bar2X + barW / 2" [attr.y]="barY(fueraVal) - 5"
                    text-anchor="middle" font-size="13" font-weight="700" fill="#dc2626">
                {{ fueraVal }}
              </text>
              <text [attr.x]="bar2X + barW / 2" [attr.y]="svgH - 2"
                    text-anchor="middle" font-size="8.5" fill="#6b7280">Fuera de ANS</text>
            </svg>
          </div>

          <!-- Barra ratio dentro/fuera -->
          <div class="ac-ratio-bar">
            <div class="ac-ratio-dentro" [style.width]="dentroPct + '%'"></div>
          </div>

          <!-- Resumen numerico -->
          <div class="ac-resumen">
            <div class="ac-res-item">
              <span class="ac-res-label">Total</span>
              <span class="ac-res-value">{{ totalVal }}</span>
            </div>
            <div class="ac-res-sep"></div>
            <div class="ac-res-item">
              <span class="ac-res-label success">Dentro</span>
              <span class="ac-res-value success">{{ dentroVal }}&thinsp;<span class="ac-res-pct">{{ dentroPct }}%</span></span>
            </div>
            <div class="ac-res-sep"></div>
            <div class="ac-res-item">
              <span class="ac-res-label danger">Fuera</span>
              <span class="ac-res-value danger">{{ fueraVal }}&thinsp;<span class="ac-res-pct">{{ fueraPct }}%</span></span>
            </div>
          </div>

        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    /* Selectores */
    .ac-filtros {
      display: flex; gap: 12px; margin-bottom: 14px;
    }
    .ac-filtro-group {
      flex: 1; display: flex; flex-direction: column; gap: 4px;
    }
    .ac-label {
      font-size: .7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-muted);
    }
    .ac-select {
      padding: 5px 8px; font-size: .79rem; width: 100%;
      border: 1px solid var(--border); border-radius: 6px;
      background: var(--surface); color: var(--text-primary); cursor: pointer;
    }
    .ac-select:focus { outline: none; border-color: var(--primary); }

    /* Chart */
    .ac-chart { margin-bottom: 8px; overflow: visible; }

    /* Barra ratio */
    .ac-ratio-bar {
      height: 8px; border-radius: 4px;
      background: rgba(239,68,68,.2); overflow: hidden; margin-bottom: 12px;
    }
    .ac-ratio-dentro {
      height: 100%; background: #22c55e;
      border-radius: 4px; transition: width .45s ease;
    }

    /* Resumen */
    .ac-resumen {
      display: flex; align-items: center;
      border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
    }
    .ac-res-item {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      gap: 2px; padding: 8px 4px;
    }
    .ac-res-sep {
      width: 1px; align-self: stretch; background: var(--border); flex-shrink: 0;
    }
    .ac-res-label {
      font-size: .67rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-muted);
    }
    .ac-res-label.success { color: #16a34a; }
    .ac-res-label.danger  { color: #dc2626; }
    .ac-res-value {
      font-size: 1rem; font-weight: 700; color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .ac-res-value.success { color: #16a34a; }
    .ac-res-value.danger  { color: #dc2626; }
    .ac-res-pct {
      font-size: .72rem; font-weight: 500; color: var(--text-muted);
    }
  `],
})
export class AnsCumplimientoComponent implements OnChanges {
  @Input() breakdown: AnsBreakdownItem[] = [];

  clienteSeleccionado = 'todos';
  ramoSeleccionado    = 'todos';

  clientes: string[] = [];
  ramos:    string[] = [];

  dentroVal = 0;
  fueraVal  = 0;
  totalVal  = 0;

  // SVG layout
  readonly svgW = 300;
  readonly svgH = 130;
  readonly padT = 22;
  readonly padB = 18;
  readonly padL = 10;
  readonly barW = 80;
  readonly gap  = 40;

  get chartH(): number { return this.svgH - this.padT - this.padB; }
  get maxVal():  number { return Math.max(this.dentroVal, this.fueraVal, 1); }

  get bar1X(): number {
    return (this.svgW - 2 * this.barW - this.gap) / 2;
  }
  get bar2X(): number {
    return this.bar1X + this.barW + this.gap;
  }

  barH(v: number): number {
    return v > 0 ? Math.max(this.chartH * (v / this.maxVal), 3) : 0;
  }
  barY(v: number): number {
    return this.padT + this.chartH - this.barH(v);
  }

  get dentroPct(): string {
    return this.totalVal ? ((this.dentroVal / this.totalVal) * 100).toFixed(1) : '0.0';
  }
  get fueraPct(): string {
    return this.totalVal ? ((this.fueraVal / this.totalVal) * 100).toFixed(1) : '0.0';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['breakdown']) {
      this.clienteSeleccionado = 'todos';
      this.ramoSeleccionado    = 'todos';
      this._rebuildClientes();
      this._rebuildRamos();
      this._compute();
    }
  }

  onClienteChange() {
    this.ramoSeleccionado = 'todos';
    this._rebuildRamos();
    this._compute();
  }

  onRamoChange() {
    this._compute();
  }

  private _rebuildClientes() {
    const set = new Set<string>();
    this.breakdown.forEach(b => set.add(b.cliente));
    this.clientes = [...set].sort();
  }

  private _rebuildRamos() {
    const source = this.clienteSeleccionado === 'todos'
      ? this.breakdown
      : this.breakdown.filter(b => b.cliente === this.clienteSeleccionado);
    const set = new Set<string>();
    source.forEach(b => set.add(b.ramo));
    this.ramos = [...set].sort();
  }

  private _compute() {
    let rows = this.breakdown;
    if (this.clienteSeleccionado !== 'todos') {
      rows = rows.filter(b => b.cliente === this.clienteSeleccionado);
    }
    if (this.ramoSeleccionado !== 'todos') {
      rows = rows.filter(b => b.ramo === this.ramoSeleccionado);
    }
    this.dentroVal = rows.reduce((s, b) => s + b.dentro, 0);
    this.fueraVal  = rows.reduce((s, b) => s + b.fuera,  0);
    this.totalVal  = this.dentroVal + this.fueraVal;
  }
}
