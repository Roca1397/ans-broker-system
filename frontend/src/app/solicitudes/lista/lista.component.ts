import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SolicitudesService, CatalogosService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SolicitudListItem, Aseguradora, CatalogoItem } from '../../models/models';
import { SolicitudDetallePanelComponent } from '../../shared/solicitud-detalle-panel/solicitud-detalle-panel.component';

// ── Column picker ─────────────────────────────────────────────────────────────
const LS_COLS = 'solicitudes_columnas_visibles';
const DEFAULT_COLS = [
  'ticket','cliente','tipo','estado','prioridad','nro_atenciones',
  'ejecutivo','aseguradora','ramo','remitente','recepcion','asunto','adjuntos',
];
const ALL_COLUMNS = [
  { key: 'ticket',         label: 'Ticket' },
  { key: 'cliente',        label: 'Cliente' },
  { key: 'tipo',           label: 'Tipo' },
  { key: 'estado',         label: 'Estado' },
  { key: 'prioridad',      label: 'Prioridad' },
  { key: 'nro_atenciones', label: 'Nro. Atenciones' },
  { key: 'ejecutivo',      label: 'Ejecutivo' },
  { key: 'aseguradora',    label: 'Aseguradora' },
  { key: 'ramo',           label: 'Ramo' },
  { key: 'remitente',      label: 'Remitente' },
  { key: 'recepcion',      label: 'Recepción' },
  { key: 'asunto',         label: 'Asunto' },
  { key: 'prediccion',     label: 'Predicción ANS' },
  { key: 'probabilidad',   label: 'Probabilidad incumplimiento' },
  { key: 'fecha_limite',   label: 'Fecha de atención' },
  { key: 'fecha_envio',    label: 'Fecha envío aseguradora' },
  { key: 'adjuntos',       label: 'Adjuntos' },
];

// ── Column resize ──────────────────────────────────────────────────────────────
const LS_WIDTHS = 'solicitudes_column_widths';
const COL_DEFAULTS: Record<string, number> = {
  ticket: 110, cliente: 160, tipo: 120, estado: 120, prioridad: 120,
  nro_atenciones: 140, ejecutivo: 130, aseguradora: 160, ramo: 130,
  remitente: 220, recepcion: 160, asunto: 260, prediccion: 130,
  probabilidad: 130, fecha_limite: 160, fecha_envio: 170, adjuntos: 40,
};
const COL_MINS: Record<string, number> = {
  ticket: 80, cliente: 120, tipo: 90, estado: 90, prioridad: 90,
  nro_atenciones: 110, ejecutivo: 100, aseguradora: 120, ramo: 90,
  remitente: 150, recepcion: 130, asunto: 160, prediccion: 100,
  probabilidad: 90, fecha_limite: 130, fecha_envio: 140, adjuntos: 36,
};

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SolicitudDetallePanelComponent],
  template: `
    <!-- ── PAGE HEADER ─────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1>Solicitudes</h1>
        <p class="muted">{{ total() }} registros · ordenados por riesgo</p>
      </div>
      <div class="header-actions">
        <a routerLink="/solicitudes/nueva" class="btn btn-primary">+ Nueva Solicitud</a>
      </div>
    </div>
    <!-- ── SEARCH + FILTERS ──────────────────────────────────────── -->
    <div *ngIf="showFilters" class="filter-backdrop" (click)="showFilters = false"></div>
    <div *ngIf="showColumnPicker" class="filter-backdrop" (click)="showColumnPicker = false"></div>
    <div class="search-toolbar">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 20 20" fill="none" width="15" height="15">
          <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"/>
          <path d="M14 14l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <input type="text" [(ngModel)]="searchTerm" (input)="onSearch()"
               placeholder="Buscar por ticket, cliente, remitente o asunto..." />
      </div>

      <div class="filter-btn-wrap">
        <button class="btn-filter" (click)="showFilters = !showFilters"
                [class.btn-filter-on]="activeFilterCount() > 0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
          <span *ngIf="activeFilterCount() > 0" class="filter-badge">{{ activeFilterCount() }}</span>
        </button>

        <div class="filter-panel" *ngIf="showFilters" (click)="$event.stopPropagation()">
          <div class="fp-header">
            <strong>Filtros</strong>
            <button class="fp-close" (click)="showFilters = false">✕</button>
          </div>
          <div class="fp-body">
            <div class="fp-field">
              <label>Estado</label>
              <select [(ngModel)]="filterEstado" (change)="applyFilters()">
                <option value="">Todos</option>
                <option *ngFor="let e of estados" [value]="e.id">{{ e.nombre }}</option>
              </select>
            </div>
            <div class="fp-field">
              <label>Prioridad</label>
              <select [(ngModel)]="filterPrioridad" (change)="applyFilters()">
                <option value="">Todas</option>
                <option *ngFor="let p of prioridades" [value]="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div class="fp-field">
              <label>Aseguradora</label>
              <select [(ngModel)]="filterAseguradora" (change)="applyFilters()">
                <option value="">Todas</option>
                <option *ngFor="let a of aseguradoras" [value]="a.id">{{ a.nombre }}</option>
              </select>
            </div>
            <div class="fp-field">
              <label>Ramo</label>
              <select [(ngModel)]="filterRamo" (change)="applyFilters()">
                <option value="">Todos</option>
                <option *ngFor="let r of ramos" [value]="r.id">{{ r.nombre }}</option>
              </select>
            </div>
            <div class="fp-field">
              <label>Predicción ANS</label>
              <select [(ngModel)]="filterPrediccion" (change)="applyFilters()">
                <option value="">Todas</option>
                <option value="Dentro de ANS">Dentro de ANS</option>
                <option value="Fuera de ANS">Fuera de ANS</option>
              </select>
            </div>
            <div class="fp-field">
              <label>Ordenar por</label>
              <select [(ngModel)]="orderBy" (change)="applyFilters()">
                <option value="created_at">Más recientes</option>
                <option value="probabilidad">Mayor riesgo</option>
                <option value="prioridad">Prioridad</option>
                <option value="estado">Estado</option>
              </select>
            </div>
          </div>
          <div class="fp-footer">
            <button class="fp-clear" (click)="clearFilters()">✕ Limpiar filtros</button>
          </div>
        </div>
      </div>

      <!-- ── Column picker ───────────────────────────────────────── -->
      <div class="filter-btn-wrap">
        <button class="btn-filter" (click)="toggleColumnPicker()"
                [class.btn-filter-on]="hasCustomColumns()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          Columnas
        </button>
        <div class="filter-panel col-picker-panel" *ngIf="showColumnPicker" (click)="$event.stopPropagation()">
          <div class="fp-header">
            <strong>Columnas visibles</strong>
            <button class="fp-close" (click)="showColumnPicker = false">✕</button>
          </div>
          <div class="fp-body col-picker-body">
            <label *ngFor="let c of allColumns" class="col-item">
              <input type="checkbox" [checked]="col(c.key)" (change)="toggleCol(c.key)" />
              {{ c.label }}
            </label>
          </div>
          <div class="fp-footer" style="display:flex;gap:6px;">
            <button class="fp-clear" (click)="resetColumns()" style="flex:1">↺ Restaurar columnas</button>
            <button class="fp-clear" (click)="resetWidths()" style="flex:1">↔ Restaurar anchos</button>
          </div>
        </div>
      </div>

    </div>

    <!-- ── TABLE ─────────────────────────────────────────────────── -->
    <div class="card table-card">
      <div *ngIf="loading()" class="loading-state">
        <div class="spinner"></div><p>Cargando solicitudes...</p>
      </div>

      <div *ngIf="!loading() && loadError()" class="error-state">
        <div class="error-icon">⚠</div>
        <h3>No se pudieron cargar las solicitudes</h3>
        <p class="error-detail">{{ loadError() }}</p>
        <button class="btn btn-primary btn-sm" (click)="load()">Reintentar</button>
      </div>

      <div class="table-wrapper" *ngIf="!loading() && !loadError()">
        <table [style.width.px]="totalTableWidth()">
          <thead>
            <tr>
              <th *ngIf="col('ticket')" [style.width.px]="colW('ticket')" class="th-resizable">Ticket<div class="resize-handle" (mousedown)="startResize($event,'ticket')"></div></th>
              <th *ngIf="col('cliente')" [style.width.px]="colW('cliente')" class="th-resizable">Cliente<div class="resize-handle" (mousedown)="startResize($event,'cliente')"></div></th>
              <th *ngIf="col('tipo')" [style.width.px]="colW('tipo')" class="th-resizable">Tipo<div class="resize-handle" (mousedown)="startResize($event,'tipo')"></div></th>
              <th *ngIf="col('estado')" [style.width.px]="colW('estado')" class="th-resizable">Estado<div class="resize-handle" (mousedown)="startResize($event,'estado')"></div></th>
              <th *ngIf="col('prioridad')" [style.width.px]="colW('prioridad')" class="th-resizable">Prioridad<div class="resize-handle" (mousedown)="startResize($event,'prioridad')"></div></th>
              <th *ngIf="col('nro_atenciones')" [style.width.px]="colW('nro_atenciones')" class="th-resizable cell-center">Nro. Atenciones<div class="resize-handle" (mousedown)="startResize($event,'nro_atenciones')"></div></th>
              <th *ngIf="col('ejecutivo')" [style.width.px]="colW('ejecutivo')" class="th-resizable">Ejecutivo<div class="resize-handle" (mousedown)="startResize($event,'ejecutivo')"></div></th>
              <th *ngIf="col('aseguradora')" [style.width.px]="colW('aseguradora')" class="th-resizable">Aseguradora<div class="resize-handle" (mousedown)="startResize($event,'aseguradora')"></div></th>
              <th *ngIf="col('ramo')" [style.width.px]="colW('ramo')" class="th-resizable">Ramo<div class="resize-handle" (mousedown)="startResize($event,'ramo')"></div></th>
              <th *ngIf="col('remitente')" [style.width.px]="colW('remitente')" class="th-resizable">Remitente<div class="resize-handle" (mousedown)="startResize($event,'remitente')"></div></th>
              <th *ngIf="col('recepcion')" [style.width.px]="colW('recepcion')" class="th-resizable">Recepción<div class="resize-handle" (mousedown)="startResize($event,'recepcion')"></div></th>
              <th *ngIf="col('asunto')" [style.width.px]="colW('asunto')" class="th-resizable">Asunto<div class="resize-handle" (mousedown)="startResize($event,'asunto')"></div></th>
              <th *ngIf="col('prediccion')" [style.width.px]="colW('prediccion')" class="th-resizable">Predicción ANS<div class="resize-handle" (mousedown)="startResize($event,'prediccion')"></div></th>
              <th *ngIf="col('probabilidad')" [style.width.px]="colW('probabilidad')" class="th-resizable">Probabilidad<div class="resize-handle" (mousedown)="startResize($event,'probabilidad')"></div></th>
              <th *ngIf="col('fecha_limite')" [style.width.px]="colW('fecha_limite')" class="th-resizable">Fecha de atención<div class="resize-handle" (mousedown)="startResize($event,'fecha_limite')"></div></th>
              <th *ngIf="col('fecha_envio')" [style.width.px]="colW('fecha_envio')" class="th-resizable">Envío aseguradora<div class="resize-handle" (mousedown)="startResize($event,'fecha_envio')"></div></th>
              <th *ngIf="col('adjuntos')" [style.width.px]="colW('adjuntos')" class="th-resizable col-adj"><div class="resize-handle" (mousedown)="startResize($event,'adjuntos')"></div></th>
              <th class="col-open" style="width:36px"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of solicitudes()" (click)="openDetail(s)" class="row-clickable">
              <td *ngIf="col('ticket')"><span class="ticket">{{ s.nro_ticket || '—' }}</span></td>
              <td *ngIf="col('cliente')" class="cell-nowrap">{{ s.cliente || '—' }}</td>
              <td *ngIf="col('tipo')">
                <span *ngIf="s.tipo_solicitud" class="pill pill-tipo">{{ s.tipo_solicitud }}</span>
                <span *ngIf="!s.tipo_solicitud" class="muted-dash">—</span>
              </td>
              <td *ngIf="col('estado')"><span class="pill" [class]="estadoClass(s.estado)">{{ s.estado || '—' }}</span></td>
              <td *ngIf="col('prioridad')">
                <span *ngIf="s.prioridad" class="pill" [class]="prioridadClass(s.prioridad)">{{ s.prioridad }}</span>
                <span *ngIf="!s.prioridad" class="muted-dash">—</span>
              </td>
              <td *ngIf="col('nro_atenciones')" class="cell-center"><span class="font-mono">{{ s.nro_atenciones ?? 1 }}</span></td>
              <td *ngIf="col('ejecutivo')" class="cell-nowrap">{{ s.ejecutivo || '—' }}</td>
              <td *ngIf="col('aseguradora')" class="cell-nowrap">{{ s.aseguradora || '—' }}</td>
              <td *ngIf="col('ramo')">{{ s.ramo || '—' }}</td>
              <td *ngIf="col('remitente')" class="cell-nowrap">{{ s.remitente || '—' }}</td>
              <td *ngIf="col('recepcion')" class="cell-date"><small>{{ formatDateShort(s.fecha_recepcion) || '—' }}</small></td>
              <td *ngIf="col('asunto')" class="cell-truncate">{{ s.asunto }}</td>
              <td *ngIf="col('prediccion')">
                <span *ngIf="s.prediccion" class="pill" [class]="prediccionClass(s.prediccion)">{{ s.prediccion }}</span>
                <span *ngIf="!s.prediccion" class="muted-dash">—</span>
              </td>
              <td *ngIf="col('probabilidad')" class="cell-center">
                <span [class]="probClass(s.probabilidad)">{{ formatProb(s.probabilidad) }}</span>
              </td>
              <td *ngIf="col('fecha_limite')" class="cell-date">
                <small>{{ formatDateShort(s.fecha_finalizado) || '—' }}</small>
              </td>
              <td *ngIf="col('fecha_envio')" class="cell-date">
                <small>{{ formatDateShort(s.fecha_envio_aseguradora) || '—' }}</small>
              </td>
              <td *ngIf="col('adjuntos')" class="cell-center">
                <span *ngIf="s.tiene_adjuntos" class="adj-icon" title="Tiene adjuntos">📎</span>
              </td>
              <td><span class="open-arrow">›</span></td>
            </tr>
            <tr *ngIf="solicitudes().length === 0">
              <td [attr.colspan]="visibleColCount()">
                <div class="empty-state">
                  <div class="empty-icon">📭</div>
                  <h3>No hay solicitudes</h3>
                  <p>Cuando lleguen correos desde Outlook aparecerán aquí.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" *ngIf="!loading() && !loadError() && pages() > 1">
        <button class="btn btn-outline btn-sm" (click)="goPage(page() - 1)" [disabled]="page() === 1">← Ant.</button>
        <span class="page-info">{{ page() }} / {{ pages() }}</span>
        <button class="btn btn-outline btn-sm" (click)="goPage(page() + 1)" [disabled]="page() === pages()">Sig. →</button>
      </div>
    </div>

    <!-- ── SIDE PANEL (shared component) ────────────────────────── -->
    <app-solicitud-detalle-panel
      [solicitudId]="selectedSolicitudId()"
      (closed)="onPanelClosed()"
      (saved)="onPanelSaved()">
    </app-solicitud-detalle-panel>
  `,
  styles: [`
    /* ── Page header ──────────────────────────────────────────── */
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 4px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .header-actions { display: flex; gap: 8px; }

    /* ── Search toolbar ──────────────────────────────────────── */
    .search-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .search-box { flex: 1; position: relative; }
    .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
    .search-box input {
      width: 100%; padding: 9px 14px 9px 34px;
      border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 0.85rem; color: var(--text-primary); background: var(--bg-card);
      box-sizing: border-box;
    }
    .search-box input:focus { outline: none; border-color: var(--primary); }

    .filter-btn-wrap { position: relative; z-index: 100; }
    .btn-filter {
      display: flex; align-items: center; gap: 6px;
      padding: 9px 16px; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-secondary); font-size: 0.83rem; cursor: pointer;
      white-space: nowrap; transition: all 0.15s;
    }
    .btn-filter:hover { border-color: var(--primary); color: var(--primary); }
    .btn-filter.btn-filter-on { border-color: var(--primary); background: rgba(0,90,158,0.07); color: var(--primary); font-weight: 600; }
    .filter-badge { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 0.65rem; font-weight: 700; }
    .filter-backdrop { position: fixed; inset: 0; z-index: 99; }
    .filter-panel {
      position: absolute; top: calc(100% + 8px); right: 0; width: 296px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); box-shadow: 0 8px 24px rgba(13,30,65,0.14);
      z-index: 200;
    }
    .fp-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .fp-header strong { font-size: 0.88rem; color: var(--text-primary); }
    .fp-close { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 6px; border-radius: 4px; }
    .fp-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .fp-field label { display: block; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .fp-field select { width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-base); color: var(--text-primary); font-size: 0.83rem; }
    .fp-footer { padding: 10px 16px; border-top: 1px solid var(--border); }
    .fp-clear { width: 100%; padding: 7px; border-radius: var(--radius); border: 1px solid var(--border); background: none; font-size: 0.8rem; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
    .fp-clear:hover { background: rgba(255,76,76,0.07); border-color: var(--danger); color: var(--danger); }

    /* ── Column picker ───────────────────────────────────────── */
    .col-picker-panel { width: 222px; }
    .col-picker-body  { max-height: 272px; overflow-y: auto; }
    .col-item {
      display: flex; align-items: center; gap: 9px;
      padding: 5px 4px; cursor: pointer; border-radius: var(--radius);
      font-size: 0.82rem; color: var(--text-primary); user-select: none;
    }
    .col-item:hover { background: var(--bg-hover); }
    .col-item input[type=checkbox] { cursor: pointer; accent-color: var(--primary); width: 13px; height: 13px; flex-shrink: 0; }

    /* ── Table ───────────────────────────────────────────────── */
    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; overflow-y: visible; }
    table { border-collapse: collapse; table-layout: fixed; font-size: 0.78rem; min-width: 100%; }
    thead th {
      position: relative;
      text-align: left; padding: 10px 18px 10px 12px;
      background: var(--bg-surface); border-bottom: 2px solid var(--border);
      color: var(--text-secondary); font-size: 0.72rem; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      user-select: none;
    }
    tbody td {
      padding: 9px 12px; border-bottom: 1px solid var(--border);
      vertical-align: middle; color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    tbody tr.row-clickable { cursor: pointer; transition: background 0.12s; }
    tbody tr.row-clickable:hover { background: var(--bg-hover); }
    tbody tr.row-fuera { background: rgba(255,76,76,0.03); }
    /* Resize handle */
    .th-resizable { position: relative; }
    .resize-handle {
      position: absolute; right: 0; top: 0; bottom: 0; width: 6px;
      cursor: col-resize; user-select: none; z-index: 5;
    }
    .resize-handle:hover { background: rgba(0,90,158,.28); border-radius: 2px; }
    /* Fixed cols */
    .col-adj  { width: 40px; }
    .col-open { width: 36px; }
    .cell-center  { text-align: center; }
    .cell-date    { white-space: nowrap; }
    .muted-dash   { color: var(--text-muted); }
    .ticket { font-family: var(--font-mono, monospace); color: var(--primary); font-weight: 600; }
    .open-arrow { color: var(--text-muted); font-size: 1.2rem; }
    .adj-icon { font-size: 0.95rem; }

    /* Pills */
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; background: var(--bg-hover); color: var(--text-secondary); }
    .p-alta, .e-pendiente  { background: rgba(255,76,76,0.12);  color: var(--danger); }
    .p-media, .e-en-proceso { background: rgba(245,166,35,0.15); color: var(--warning); }
    .p-baja,  .e-finalizado { background: rgba(16,185,129,0.15); color: var(--success); }
    .pill-tipo { background: rgba(0,90,158,0.1); color: var(--primary); }
    .e-fuera   { background: rgba(255,76,76,0.12);  color: var(--danger); }
    .e-dentro  { background: rgba(16,185,129,0.15); color: var(--success); }
    .prob-alto  { color: var(--danger);  font-weight: 600; font-family: var(--font-mono, monospace); font-size: 0.75rem; }
    .prob-medio { color: var(--warning); font-weight: 600; font-family: var(--font-mono, monospace); font-size: 0.75rem; }
    .prob-bajo  { color: var(--success); font-weight: 600; font-family: var(--font-mono, monospace); font-size: 0.75rem; }

    /* States */
    .empty-state { text-align: center; padding: 60px 20px; white-space: normal; }
    .empty-icon  { font-size: 2.8rem; opacity: 0.4; margin-bottom: 10px; }
    .empty-state h3 { color: var(--text-primary); margin-bottom: 6px; }
    .empty-state p  { color: var(--text-muted); }
    .loading-state  { padding: 60px; text-align: center; color: var(--text-muted); }
    .spinner { width: 30px; height: 30px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-state { padding: 50px 30px; text-align: center; }
    .error-icon  { font-size: 2.2rem; margin-bottom: 10px; color: var(--danger); }
    .error-state h3 { color: var(--text-primary); margin-bottom: 6px; }
    .error-detail { color: var(--danger); font-size: 0.78rem; font-family: var(--font-mono,monospace); background: rgba(255,76,76,0.06); border: 1px solid rgba(255,76,76,0.2); padding: 7px 12px; border-radius: var(--radius); margin: 8px auto; max-width: 520px; word-break: break-all; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: 14px; padding: 14px; border-top: 1px solid var(--border); }
    .page-info { font-size: 0.83rem; color: var(--text-secondary); }
  `],
})
export class ListaSolicitudesComponent implements OnInit, OnDestroy {
  solicitudes          = signal<SolicitudListItem[]>([]);
  selectedSolicitudId  = signal<string | null>(null);
  loading              = signal(true);
  loadError            = signal<string | null>(null);
  total                = signal(0);
  page                 = signal(1);
  pages                = signal(1);

  aseguradoras: Aseguradora[]  = [];
  estados:      CatalogoItem[] = [];
  prioridades:  CatalogoItem[] = [];
  ramos:        CatalogoItem[] = [];

  searchTerm        = '';
  filterEstado      = '';
  filterPrioridad   = '';
  filterAseguradora = '';
  filterRamo        = '';
  filterPrediccion  = '';
  orderBy           = 'created_at';
  showFilters       = false;
  showColumnPicker  = false;
  readonly allColumns = ALL_COLUMNS;

  private _visibleCols = signal<Set<string>>((() => {
    try {
      const s = localStorage.getItem(LS_COLS);
      if (s) return new Set<string>(JSON.parse(s));
    } catch {}
    return new Set<string>(DEFAULT_COLS);
  })());

  visibleColCount = computed(() => ALL_COLUMNS.filter(c => this._visibleCols().has(c.key)).length + 1);
  hasCustomColumns = computed(() => {
    const v = this._visibleCols();
    if (v.size !== DEFAULT_COLS.length) return true;
    return DEFAULT_COLS.some(k => !v.has(k));
  });

  // ── Column resize ────────────────────────────────────────────────────────────
  colWidths = signal<Record<string, number>>({ ...COL_DEFAULTS });
  totalTableWidth = computed(() => {
    const w = this.colWidths();
    const v = this._visibleCols();
    let total = 36; // col-open fixed
    for (const c of ALL_COLUMNS) {
      if (v.has(c.key)) total += w[c.key] ?? COL_DEFAULTS[c.key] ?? 100;
    }
    return total;
  });

  private _resizeTh: HTMLElement | null = null;
  private _resizeTable: HTMLElement | null = null;
  private _resizeKey = '';
  private _resizeStartX = 0;
  private _resizeStartW = 0;
  private _resizeTableStartW = 0;
  private readonly _onMouseMoveRef = (e: MouseEvent) => this._doResize(e);
  private readonly _onMouseUpRef   = () => this._endResize();

  private searchTimer: any;

  constructor(
    private service:   SolicitudesService,
    private catalogos: CatalogosService,
    public  auth:      AuthService,
  ) {
    const saved = this._loadWidths();
    if (Object.keys(saved).length) this.colWidths.set({ ...COL_DEFAULTS, ...saved });
  }

  ngOnInit() {
    this.catalogos.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogos.getEstadosSolicitud().subscribe(d => this.estados = d);
    this.catalogos.getPrioridades().subscribe(d => this.prioridades = d);
    this.catalogos.getRamos().subscribe(d => this.ramos = d);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.listarSharepoint({
      page: this.page(),
      size: 20,
      estado_id:      this.filterEstado      || null,
      prioridad_id:   this.filterPrioridad   || null,
      aseguradora_id: this.filterAseguradora || null,
      ramo_id:        this.filterRamo        || null,
      prediccion:     this.filterPrediccion  || null,
      search:         this.searchTerm        || null,
      order_by:       this.orderBy,
      order_dir:      'desc',
    }).subscribe({
      next: (r) => {
        this.solicitudes.set(r.items);
        this.total.set(r.total);
        this.pages.set(r.pages);
        this.loading.set(false);
      },
      error: (err) => {
        const status = err?.status;
        const detail = err?.error?.detail || err?.message || 'Error desconocido';
        console.error('[Solicitudes] Error cargando lista:', err);
        this.loadError.set(status ? `HTTP ${status}: ${detail}` : detail);
        this.loading.set(false);
      },
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }

  applyFilters() { this.page.set(1); this.load(); }

  activeFilterCount() {
    return [this.filterEstado, this.filterPrioridad, this.filterAseguradora,
            this.filterRamo, this.filterPrediccion].filter(Boolean).length;
  }

  clearFilters() {
    this.filterEstado = ''; this.filterPrioridad = '';
    this.filterAseguradora = ''; this.filterRamo = '';
    this.filterPrediccion = ''; this.orderBy = 'created_at';
    this.page.set(1); this.load();
  }

  goPage(p: number) { if (p >= 1 && p <= this.pages()) { this.page.set(p); this.load(); } }

  openDetail(s: SolicitudListItem) { this.selectedSolicitudId.set(s.id); }

  onPanelClosed() { this.selectedSolicitudId.set(null); }

  onPanelSaved() { this.load(); }

  /* ── Helpers (table only) ────────────────────────────────────── */

  formatDateShort(d?: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatProb(p?: number): string {
    if (p == null) return '—';
    return Math.round(p * 100) + '%';
  }

  probClass(p?: number): string {
    if (p == null) return '';
    if (p > 0.7) return 'prob-alto';
    if (p >= 0.4) return 'prob-medio';
    return 'prob-bajo';
  }

  prioridadClass(nombre?: string): string {
    const n = (nombre || '').toLowerCase();
    if (n === 'alta')  return 'p-alta';
    if (n === 'media') return 'p-media';
    if (n === 'baja')  return 'p-baja';
    return '';
  }

  estadoClass(nombre?: string): string {
    const n = (nombre || '').toLowerCase().replace(/\s+/g, '-');
    if (n === 'pendiente')  return 'e-pendiente';
    if (n === 'en-proceso') return 'e-en-proceso';
    if (n === 'finalizado') return 'e-finalizado';
    return '';
  }

  prediccionClass(p?: string): string {
    if (p === 'Fuera de ANS')   return 'e-fuera';
    if (p === 'Dentro de ANS')  return 'e-dentro';
    return '';
  }

  col(key: string): boolean { return this._visibleCols().has(key); }

  toggleCol(key: string): void {
    const next = new Set(this._visibleCols());
    next.has(key) ? next.delete(key) : next.add(key);
    this._visibleCols.set(next);
    this._saveCols();
  }

  resetColumns(): void {
    this._visibleCols.set(new Set<string>(DEFAULT_COLS));
    this._saveCols();
    this.showColumnPicker = false;
  }

  toggleColumnPicker(): void {
    this.showColumnPicker = !this.showColumnPicker;
    if (this.showColumnPicker) this.showFilters = false;
  }

  private _saveCols(): void {
    try { localStorage.setItem(LS_COLS, JSON.stringify([...this._visibleCols()])); } catch {}
  }

  // ── Column resize methods ─────────────────────────────────────────────────────
  colW(key: string): number {
    return this.colWidths()[key] ?? COL_DEFAULTS[key] ?? 100;
  }

  startResize(event: MouseEvent, key: string): void {
    event.preventDefault();
    event.stopPropagation();
    const th = (event.currentTarget as HTMLElement).closest('th') as HTMLElement;
    if (!th) return;
    this._resizeTh          = th;
    this._resizeTable       = th.closest('table') as HTMLElement;
    this._resizeKey         = key;
    this._resizeStartX      = event.clientX;
    this._resizeStartW      = th.offsetWidth;
    this._resizeTableStartW = this._resizeTable?.offsetWidth ?? 0;
    document.addEventListener('mousemove', this._onMouseMoveRef);
    document.addEventListener('mouseup',   this._onMouseUpRef);
  }

  private _doResize(e: MouseEvent): void {
    if (!this._resizeTh) return;
    const delta = e.clientX - this._resizeStartX;
    const minW  = COL_MINS[this._resizeKey] ?? 60;
    const newW  = Math.max(minW, this._resizeStartW + delta);
    this._resizeTh.style.width = newW + 'px';
    if (this._resizeTable) {
      const actualDelta = newW - this._resizeStartW;
      this._resizeTable.style.width = Math.max(this._resizeTableStartW + actualDelta, 100) + 'px';
    }
  }

  private _endResize(): void {
    if (this._resizeTh) {
      const finalW = this._resizeTh.offsetWidth;
      this.colWidths.update(w => ({ ...w, [this._resizeKey]: finalW }));
      this._saveWidths();
      this._resizeTh    = null;
      this._resizeTable = null;
    }
    document.removeEventListener('mousemove', this._onMouseMoveRef);
    document.removeEventListener('mouseup',   this._onMouseUpRef);
  }

  resetWidths(): void {
    this.colWidths.set({ ...COL_DEFAULTS });
    try { localStorage.removeItem(LS_WIDTHS); } catch {}
  }

  private _loadWidths(): Record<string, number> {
    try {
      const s = localStorage.getItem(LS_WIDTHS);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  }

  private _saveWidths(): void {
    try { localStorage.setItem(LS_WIDTHS, JSON.stringify(this.colWidths())); } catch {}
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this._onMouseMoveRef);
    document.removeEventListener('mouseup',   this._onMouseUpRef);
  }
}
