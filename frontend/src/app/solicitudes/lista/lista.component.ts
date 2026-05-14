import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SolicitudesService, CatalogosService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  SolicitudListItem, SolicitudDetail, Aseguradora, CatalogoItem, AdjuntoMeta,
} from '../../models/models';

/**
 * REEMPLAZA: frontend/src/app/solicitudes/lista/lista.component.ts
 * Reescrita completa: lista tipo SharePoint con panel lateral de detalle.
 */
@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Solicitudes</h1>
        <p class="muted">{{ total() }} solicitudes registradas · ordenadas por riesgo</p>
      </div>
      <div class="header-actions">
        <a routerLink="/solicitudes/carga-masiva" class="btn btn-outline">⤒ Carga Masiva</a>
        <a routerLink="/solicitudes/nueva" class="btn btn-primary">✦ Nueva Solicitud</a>
      </div>
    </div>

    <div class="risk-summary">
      <div class="risk-card r-bajo">
        <span class="dot"></span>
        <div><strong>{{ countBajo() }}</strong><small>Bajo riesgo</small></div>
      </div>
      <div class="risk-card r-medio">
        <span class="dot"></span>
        <div><strong>{{ countMedio() }}</strong><small>Riesgo medio</small></div>
      </div>
      <div class="risk-card r-alto">
        <span class="dot"></span>
        <div><strong>{{ countAlto() }}</strong><small>Alto riesgo · Fuera de ANS</small></div>
      </div>
    </div>

    <!-- click-backdrop para cerrar el panel -->
    <div *ngIf="showFilters" class="filter-backdrop" (click)="showFilters = false"></div>

    <div class="search-toolbar">
      <div class="search-box">
        <span class="search-icon">⌕</span>
        <input type="text" [(ngModel)]="searchTerm" (input)="onSearch()"
               placeholder="Buscar por ticket, cliente, remitente o asunto..." />
      </div>

      <div class="filter-btn-wrap">
        <button class="btn-filter" (click)="showFilters = !showFilters"
                [class.btn-filter-on]="activeFilterCount() > 0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
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
    </div>

    <div class="card table-card">
      <div *ngIf="loading()" class="loading-state"><div class="spinner"></div><p>Cargando solicitudes...</p></div>
      <div class="table-wrapper" *ngIf="!loading()">
        <table>
          <thead>
            <tr>
              <th class="col-ticket">Ticket</th>
              <th>Cliente</th>
              <th>TipoSolicitud</th>
              <th>Estado</th>
              <th>Aseguradora</th>
              <th>Prioridad</th>
              <th>FechaRecepcion</th>
              <th>FechaLimite</th>
              <th>Remitente</th>
              <th class="col-asunto">Asunto</th>
              <th class="col-detalle">DetalleCorreo</th>
              <th class="col-adj">Datos adjuntos</th>
              <th class="col-open"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of solicitudes()" (click)="openDetail(s)" class="row-clickable"
                [class.row-fuera]="s.prediccion === 'Fuera de ANS'">
              <td><span class="ticket">{{ s.nro_ticket || '—' }}</span></td>
              <td class="cell-nowrap">{{ s.cliente || '—' }}</td>
              <td>
                <span *ngIf="s.tipo_solicitud" class="pill pill-tipo">{{ s.tipo_solicitud }}</span>
                <span *ngIf="!s.tipo_solicitud" class="muted">—</span>
              </td>
              <td><span class="pill" [class]="estadoClass(s.estado)">{{ s.estado || '—' }}</span></td>
              <td class="cell-nowrap">{{ s.aseguradora || '—' }}</td>
              <td>
                <span *ngIf="s.prioridad" class="pill" [class]="prioridadClass(s.prioridad)">{{ s.prioridad }}</span>
                <span *ngIf="!s.prioridad" class="muted">—</span>
              </td>
              <td class="cell-date"><small>{{ formatDateShort(s.fecha_recepcion) || '—' }}</small></td>
              <td class="cell-date"><small>{{ formatDateShort(s.fecha_finalizado) || '—' }}</small></td>
              <td class="cell-truncate"><small class="muted">{{ s.remitente }}</small></td>
              <td class="cell-truncate">{{ s.asunto }}</td>
              <td class="cell-truncate muted"><small>{{ s.detalle_correo }}</small></td>
              <td class="col-adj cell-center">
                <span *ngIf="s.tiene_adjuntos" title="Tiene adjuntos">📎</span>
              </td>
              <td><span class="open-arrow">›</span></td>
            </tr>
            <tr *ngIf="solicitudes().length === 0">
              <td colspan="13">
                <div class="empty-state">
                  <div class="empty-icon">📭</div>
                  <h3>No hay solicitudes</h3>
                  <p>Cuando lleguen correos desde Outlook (vía Power Automate) aparecerán aquí.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" *ngIf="!loading() && pages() > 1">
        <button class="btn btn-outline btn-sm" (click)="goPage(page() - 1)" [disabled]="page() === 1">← Anterior</button>
        <span class="page-info">Página {{ page() }} de {{ pages() }}</span>
        <button class="btn btn-outline btn-sm" (click)="goPage(page() + 1)" [disabled]="page() === pages()">Siguiente →</button>
      </div>
    </div>

    <!-- ── Side panel ─────────────────────────────────────────────── -->
    <div class="side-panel-overlay" *ngIf="selectedDetail()" (click)="closeDetail()">
      <aside class="side-panel" (click)="$event.stopPropagation()">

        <!-- Header -->
        <header class="panel-header">
          <div class="panel-title-area">
            <span class="ticket-big">{{ selectedDetail()!.nro_ticket }}</span>
            <span class="panel-content-type">Solicitud</span>
          </div>
          <div class="panel-header-btns">
            <button *ngIf="auth.isAdmin()" class="btn btn-danger btn-sm" (click)="deleteSolicitud()" title="Eliminar">🗑</button>
            <button class="close-btn" (click)="closeDetail()">✕</button>
          </div>
        </header>

        <!-- All fields – SharePoint read-only style -->
        <div class="sp-fields">

          <!-- Meta row: tipo de contenido + título -->
          <div class="sp-meta-row">
            <div class="sp-meta-item">
              <span class="sp-meta-label">Tipo de contenido</span>
              <span class="sp-meta-value">Solicitud</span>
            </div>
            <div class="sp-meta-item">
              <span class="sp-meta-label">Título</span>
              <span class="sp-meta-value">{{ selectedDetail()!.asunto || '—' }}</span>
            </div>
          </div>
          <div class="sp-divider"></div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Cliente</span></div>
            <div class="sp-value">{{ selectedDetail()!.cliente || '—' }}</div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">TipoSolicitud</span></div>
            <div class="sp-value">
              <span *ngIf="selectedDetail()!.tipo_solicitud" class="pill pill-tipo">{{ selectedDetail()!.tipo_solicitud }}</span>
              <span *ngIf="!selectedDetail()!.tipo_solicitud" class="sp-empty">—</span>
            </div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Estado</span></div>
            <div class="sp-value">
              <span class="pill" [class]="estadoClass(selectedDetail()!.estado)">{{ selectedDetail()!.estado || '—' }}</span>
            </div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Prioridad</span></div>
            <div class="sp-value">
              <span *ngIf="selectedDetail()!.prioridad" class="pill" [class]="prioridadClass(selectedDetail()!.prioridad)">{{ selectedDetail()!.prioridad }}</span>
              <span *ngIf="!selectedDetail()!.prioridad" class="sp-empty">—</span>
            </div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">📅</span><span class="sp-label">FechaRecepcion</span></div>
            <div class="sp-value">{{ formatDate(selectedDetail()!.fecha_recepcion) || '—' }}</div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">📅</span><span class="sp-label">FechaLimite</span></div>
            <div class="sp-value">
              <span *ngIf="selectedDetail()!.fecha_finalizado">{{ formatDate(selectedDetail()!.fecha_finalizado) }}</span>
              <span *ngIf="!selectedDetail()!.fecha_finalizado" class="sp-empty">Introducir un valor aquí</span>
            </div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Remitente</span></div>
            <div class="sp-value">{{ selectedDetail()!.remitente || '—' }}</div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Asunto</span></div>
            <div class="sp-value">{{ selectedDetail()!.asunto || '—' }}</div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">≡</span><span class="sp-label">DetalleCorreo</span></div>
            <div class="sp-value">
              <div *ngIf="selectedDetail()!.cuerpo_correo" class="sp-correo">{{ stripHtml(selectedDetail()!.cuerpo_correo) }}</div>
              <span *ngIf="!selectedDetail()!.cuerpo_correo" class="sp-empty">—</span>
            </div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Aseguradora</span></div>
            <div class="sp-value">{{ selectedDetail()!.aseguradora || '—' }}</div>
          </div>

          <div class="sp-field">
            <div class="sp-field-head"><span class="sp-icon">☑</span><span class="sp-label">Ramo</span></div>
            <div class="sp-value">{{ selectedDetail()!.ramo || '—' }}</div>
          </div>

          <div class="sp-field" *ngIf="(selectedDetail()!.datos_adjuntos?.length || 0) > 0">
            <div class="sp-field-head"><span class="sp-icon">📎</span><span class="sp-label">Datos adjuntos</span></div>
            <div class="sp-value sp-adjuntos">
              <span *ngFor="let a of selectedDetail()!.datos_adjuntos" class="sp-adjunto" (click)="downloadAttach(a)">
                📎 {{ a.filename }}<small class="muted"> · {{ formatBytes(a.size) }}</small>
              </span>
            </div>
          </div>
        </div>

        <!-- Predicción ANS -->
        <div class="prediction-block" [class]="predClass(selectedDetail()!.probabilidad)">
          <div class="pred-left">
            <small>Predicción ANS</small>
            <strong>{{ selectedDetail()!.prediccion || '—' }}</strong>
          </div>
          <div class="pred-right">
            <small>Probabilidad de incumplimiento</small>
            <span class="pred-pct">{{ formatProb(selectedDetail()!.probabilidad) }}</span>
          </div>
        </div>

        <!-- Editar tipificación -->
        <section class="panel-section">
          <h3>Editar tipificación</h3>
          <div class="field-grid">
            <div class="field">
              <label>Cliente</label>
              <input type="text" [(ngModel)]="editForm.cliente" />
            </div>
            <div class="field">
              <label>Tipo de Solicitud</label>
              <select [(ngModel)]="editForm.tipo_solicitud_id">
                <option [ngValue]="null">—</option>
                <option *ngFor="let t of tiposSolicitud" [ngValue]="t.id">{{ t.nombre }}</option>
              </select>
            </div>
            <div class="field">
              <label>Estado</label>
              <select [(ngModel)]="editForm.estado_id">
                <option [ngValue]="null">—</option>
                <option *ngFor="let e of estados" [ngValue]="e.id">{{ e.nombre }}</option>
              </select>
            </div>
            <div class="field">
              <label>Prioridad</label>
              <select [(ngModel)]="editForm.prioridad_id">
                <option [ngValue]="null">—</option>
                <option *ngFor="let p of prioridades" [ngValue]="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div class="field">
              <label>Aseguradora</label>
              <select [(ngModel)]="editForm.aseguradora_id">
                <option [ngValue]="null">—</option>
                <option *ngFor="let a of aseguradoras" [ngValue]="a.id">{{ a.nombre }}</option>
              </select>
            </div>
            <div class="field">
              <label>Ramo</label>
              <select [(ngModel)]="editForm.ramo_id">
                <option [ngValue]="null">—</option>
                <option *ngFor="let r of ramos" [ngValue]="r.id">{{ r.nombre }}</option>
              </select>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn btn-primary" (click)="saveChanges()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : '💾 Guardar cambios' }}
            </button>
          </div>
        </section>

        <!-- Comentarios -->
        <section class="panel-section">
          <h3>Comentarios</h3>
          <pre class="comments" *ngIf="selectedDetail()!.comentarios">{{ selectedDetail()!.comentarios }}</pre>
          <p class="muted" *ngIf="!selectedDetail()!.comentarios">Sin comentarios todavía.</p>
          <div class="comment-add">
            <textarea [(ngModel)]="newComment" rows="2" placeholder="Agregar comentario..."></textarea>
            <button class="btn btn-primary btn-sm" (click)="addComment()" [disabled]="!newComment.trim()">Agregar</button>
          </div>
        </section>

      </aside>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
    .page-header h1 { font-size: 1.6rem; color: var(--text-primary); margin-bottom: 4px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .header-actions { display: flex; gap: 8px; }

    .risk-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .risk-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 14px 18px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 4px rgba(13, 30, 65, 0.04);
    }
    .risk-card .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .risk-card.r-bajo { border-left: 4px solid var(--success); }
    .risk-card.r-bajo .dot { background: var(--success); }
    .risk-card.r-medio { border-left: 4px solid var(--warning); }
    .risk-card.r-medio .dot { background: var(--warning); }
    .risk-card.r-alto { border-left: 4px solid var(--danger); }
    .risk-card.r-alto .dot { background: var(--danger); }
    .risk-card strong { font-size: 1.4rem; color: var(--text-primary); display: block; }
    .risk-card small { color: var(--text-muted); font-size: 0.78rem; }

    /* ── Search + filter toolbar ───────────────────────────────────── */
    .search-toolbar {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px;
    }
    .search-box {
      flex: 1; position: relative;
    }
    .search-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted); font-size: 1rem; pointer-events: none;
    }
    .search-box input {
      width: 100%; padding: 9px 14px 9px 36px;
      border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 0.85rem; color: var(--text-primary);
      background: var(--bg-card);
      box-shadow: 0 1px 3px rgba(13,30,65,0.05);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-box input:focus {
      outline: none; border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(0,90,158,0.1);
    }

    /* Filter button + dropdown */
    .filter-btn-wrap { position: relative; z-index: 100; }
    .btn-filter {
      display: flex; align-items: center; gap: 6px;
      padding: 9px 16px; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-secondary); font-size: 0.83rem; cursor: pointer;
      box-shadow: 0 1px 3px rgba(13,30,65,0.05);
      transition: all 0.15s; white-space: nowrap;
    }
    .btn-filter:hover { border-color: var(--primary); color: var(--primary); }
    .btn-filter.btn-filter-on {
      border-color: var(--primary); background: rgba(0,90,158,0.07);
      color: var(--primary); font-weight: 600;
    }
    .filter-badge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--primary); color: #fff; font-size: 0.68rem; font-weight: 700;
    }

    .filter-backdrop {
      position: fixed; inset: 0; z-index: 99;
    }
    .filter-panel {
      position: absolute; top: calc(100% + 8px); right: 0;
      width: 300px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius-lg);
      box-shadow: 0 8px 24px rgba(13,30,65,0.14);
      animation: fadeIn 0.15s; z-index: 200;
    }
    .fp-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid var(--border);
    }
    .fp-header strong { font-size: 0.88rem; color: var(--text-primary); }
    .fp-close {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 1rem; padding: 2px 6px;
      border-radius: 4px;
    }
    .fp-close:hover { background: var(--bg-hover); }
    .fp-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .fp-field label {
      display: block; font-size: 0.7rem; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 4px;
    }
    .fp-field select {
      width: 100%; padding: 7px 10px;
      border: 1px solid var(--border); border-radius: var(--radius);
      background: var(--bg-base); color: var(--text-primary); font-size: 0.83rem;
    }
    .fp-field select:focus { outline: none; border-color: var(--primary); }
    .fp-footer {
      padding: 10px 16px; border-top: 1px solid var(--border);
    }
    .fp-clear {
      width: 100%; padding: 7px; border-radius: var(--radius);
      border: 1px solid var(--border); background: none;
      font-size: 0.8rem; color: var(--text-muted); cursor: pointer;
      transition: all 0.15s;
    }
    .fp-clear:hover {
      background: rgba(255,76,76,0.07); border-color: var(--danger); color: var(--danger);
    }

    /* ── Table ─────────────────────────────────────────────────────── */
    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.78rem; white-space: nowrap; }
    thead th {
      text-align: left; padding: 10px 12px; background: var(--bg-surface);
      border-bottom: 2px solid var(--border); color: var(--text-secondary);
      font-weight: 600; font-size: 0.72rem; text-transform: none; letter-spacing: 0;
      white-space: nowrap;
    }
    tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tbody tr.row-clickable { cursor: pointer; transition: background 0.15s; }
    tbody tr.row-clickable:hover { background: var(--bg-hover); }
    tbody tr.row-fuera { background: rgba(255, 76, 76, 0.03); }
    .col-ticket { width: 110px; }
    .col-open { width: 28px; }
    .col-adj { width: 90px; }
    .col-asunto { min-width: 180px; }
    .col-detalle { min-width: 160px; }
    .cell-nowrap { white-space: nowrap; }
    .cell-date { white-space: nowrap; }
    .cell-center { text-align: center; }
    .cell-truncate { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ticket { font-family: var(--font-mono, monospace); color: var(--primary); font-weight: 600; }
    .open-arrow { color: var(--text-muted); font-size: 1.2rem; }

    .pill {
      display: inline-block; padding: 2px 9px; border-radius: 12px;
      font-size: 0.72rem; font-weight: 600;
      background: var(--bg-hover); color: var(--text-secondary);
    }
    .pill.p-alta,    .pill.e-pendiente  { background: rgba(255, 76, 76, 0.12);  color: var(--danger); }
    .pill.p-media,   .pill.e-en-proceso { background: rgba(245, 166, 35, 0.15); color: var(--warning); }
    .pill.p-baja,    .pill.e-finalizado { background: rgba(16, 185, 129, 0.15); color: var(--success); }
    .pill.pill-tipo { background: rgba(0, 90, 158, 0.1); color: var(--primary); }

    .empty-state { text-align: center; padding: 60px 20px; white-space: normal; }
    .empty-icon { font-size: 3rem; opacity: 0.4; margin-bottom: 12px; }
    .empty-state h3 { color: var(--text-primary); margin-bottom: 6px; }
    .empty-state p { color: var(--text-muted); }
    .loading-state { padding: 60px; text-align: center; color: var(--text-muted); }
    .spinner {
      width: 32px; height: 32px; border: 3px solid var(--border);
      border-top-color: var(--primary); border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 16px; border-top: 1px solid var(--border); }
    .page-info { font-size: 0.85rem; color: var(--text-secondary); }

    /* ── Side panel overlay ────────────────────────────────────────── */
    .side-panel-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(13, 30, 65, 0.35);
      display: flex; justify-content: flex-end;
      animation: fadeIn 0.2s;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .side-panel {
      width: min(560px, 100%); height: 100vh; overflow-y: auto;
      background: #fff; box-shadow: -4px 0 24px rgba(13, 30, 65, 0.18);
      animation: slideIn 0.25s; display: flex; flex-direction: column;
    }
    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

    /* Panel header */
    .panel-header {
      padding: 14px 20px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-surface); position: sticky; top: 0; z-index: 5; gap: 12px;
    }
    .panel-title-area { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ticket-big { font-family: var(--font-mono, monospace); color: var(--primary); font-weight: 700; font-size: 0.85rem; }
    .panel-content-type { font-size: 0.75rem; color: var(--text-muted); }
    .panel-header-btns { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
    .close-btn {
      background: none; border: none; font-size: 1.3rem; cursor: pointer;
      color: var(--text-muted); padding: 4px 8px; border-radius: 4px;
    }
    .close-btn:hover { background: var(--bg-hover); }

    /* ── SharePoint-style field list ──────────────────────────────── */
    .sp-meta-row {
      display: flex; gap: 28px; padding: 14px 20px 12px;
      background: var(--bg-surface); border-bottom: 1px solid var(--border);
    }
    .sp-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .sp-meta-label { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .sp-meta-value { font-size: 0.82rem; color: var(--text-secondary); }
    .sp-divider { height: 1px; background: var(--border); margin: 0; }

    .sp-fields { flex: 1; }
    .sp-field { padding: 10px 20px; border-bottom: 1px solid var(--border); }
    .sp-field-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .sp-icon { font-size: 0.8rem; color: var(--text-muted); width: 14px; flex-shrink: 0; }
    .sp-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); }
    .sp-value { font-size: 0.86rem; color: var(--text-primary); padding-left: 20px; }
    .sp-empty { color: #a19f9d; font-style: italic; font-size: 0.83rem; }
    .sp-correo {
      max-height: 100px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
      font-size: 0.78rem; color: var(--text-secondary);
      background: var(--bg-base); padding: 8px 10px; border-radius: var(--radius);
      margin-top: 2px;
    }
    .sp-adjuntos { display: flex; flex-direction: column; gap: 5px; }
    .sp-adjunto {
      cursor: pointer; color: var(--primary); font-size: 0.83rem;
      display: flex; align-items: center; gap: 4px;
    }
    .sp-adjunto:hover { text-decoration: underline; }

    /* ── Prediction block ─────────────────────────────────────────── */
    .prediction-block {
      margin: 14px 20px; padding: 16px; border-radius: var(--radius-lg);
      display: flex; justify-content: space-between; align-items: center; border: 2px solid;
    }
    .prediction-block.bajo  { background: rgba(16, 185, 129, 0.08); border-color: var(--success); }
    .prediction-block.medio { background: rgba(245, 166, 35, 0.08);  border-color: var(--warning); }
    .prediction-block.alto  { background: rgba(255, 76, 76, 0.08);   border-color: var(--danger);  }
    .prediction-block small { display: block; color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .prediction-block strong { font-size: 1rem; color: var(--text-primary); }
    .pred-pct { font-size: 1.6rem; font-weight: 700; color: var(--text-primary); }
    .prediction-block.alto  .pred-pct { color: var(--danger); }
    .prediction-block.medio .pred-pct { color: var(--warning); }
    .prediction-block.bajo  .pred-pct { color: var(--success); }

    /* ── Edit section ─────────────────────────────────────────────── */
    .panel-section { padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .panel-section h3 { font-size: 0.88rem; font-weight: 600; margin-bottom: 12px; color: var(--text-primary); }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .field label { display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .field input, .field select {
      width: 100%; padding: 7px 10px; border: 1px solid var(--border);
      border-radius: var(--radius); background: #fff; font-size: 0.83rem; color: var(--text-primary);
    }
    .panel-actions { margin-top: 12px; display: flex; gap: 8px; }

    .comments {
      background: var(--bg-base); padding: 10px; border-radius: var(--radius);
      font-size: 0.78rem; white-space: pre-wrap; max-height: 180px; overflow-y: auto;
      color: var(--text-secondary);
    }
    .comment-add { margin-top: 10px; display: flex; gap: 8px; align-items: flex-start; }
    .comment-add textarea {
      flex: 1; padding: 7px 10px; border: 1px solid var(--border);
      border-radius: var(--radius); font-family: inherit; font-size: 0.83rem; resize: vertical;
    }

    @media (max-width: 768px) {
      .field-grid { grid-template-columns: 1fr; }
      .risk-summary { grid-template-columns: 1fr; }
      .side-panel { width: 100%; }
    }
  `],
})
export class ListaSolicitudesComponent implements OnInit {
  solicitudes = signal<SolicitudListItem[]>([]);
  selectedDetail = signal<SolicitudDetail | null>(null);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  pages = signal(1);

  aseguradoras: Aseguradora[] = [];
  tiposSolicitud: CatalogoItem[] = [];
  estados: CatalogoItem[] = [];
  prioridades: CatalogoItem[] = [];
  ramos: CatalogoItem[] = [];

  searchTerm = '';
  filterEstado = '';
  filterPrioridad = '';
  filterAseguradora = '';
  filterRamo = '';
  filterPrediccion = '';
  orderBy: string = 'created_at';

  editForm: any = {};
  newComment = '';
  showFilters = false;

  countBajo = computed(() => this.solicitudes().filter(s => (s.probabilidad || 0) < 0.4).length);
  countMedio = computed(() => this.solicitudes().filter(s => (s.probabilidad || 0) >= 0.4 && (s.probabilidad || 0) <= 0.7).length);
  countAlto = computed(() => this.solicitudes().filter(s => (s.probabilidad || 0) > 0.7).length);

  private searchTimer: any;

  constructor(
    private service: SolicitudesService,
    private catalogos: CatalogosService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.catalogos.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogos.getTiposSolicitud().subscribe(d => this.tiposSolicitud = d);
    this.catalogos.getEstadosSolicitud().subscribe(d => this.estados = d);
    this.catalogos.getPrioridades().subscribe(d => this.prioridades = d);
    this.catalogos.getRamos().subscribe(d => this.ramos = d);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.service.listarSharepoint({
      page: this.page(),
      size: 20,
      estado_id: this.filterEstado || null,
      prioridad_id: this.filterPrioridad || null,
      aseguradora_id: this.filterAseguradora || null,
      ramo_id: this.filterRamo || null,
      prediccion: this.filterPrediccion || null,
      search: this.searchTerm || null,
      order_by: this.orderBy,
      order_dir: 'desc',
    }).subscribe({
      next: (r) => {
        this.solicitudes.set(r.items);
        this.total.set(r.total);
        this.pages.set(r.pages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 400);
  }
  applyFilters() { this.page.set(1); this.load(); }
  activeFilterCount(): number {
    return [this.filterEstado, this.filterPrioridad, this.filterAseguradora,
            this.filterRamo, this.filterPrediccion].filter(Boolean).length;
  }

  clearFilters() {
    this.filterEstado = ''; this.filterPrioridad = '';
    this.filterAseguradora = ''; this.filterRamo = ''; this.filterPrediccion = '';
    this.orderBy = 'created_at'; this.page.set(1); this.load();
  }
  goPage(p: number) { if (p >= 1 && p <= this.pages()) { this.page.set(p); this.load(); } }

  openDetail(s: SolicitudListItem) {
    this.service.detalle(s.id).subscribe({
      next: (d) => {
        this.selectedDetail.set(d);
        this.editForm = {
          cliente: d.cliente,
          tipo_solicitud_id: d.tipo_solicitud_id ?? null,
          estado_id: d.estado_id ?? null,
          prioridad_id: d.prioridad_id ?? null,
          aseguradora_id: d.aseguradora_id ?? null,
          ramo_id: d.ramo_id ?? null,
        };
        this.newComment = '';
      },
      error: (err) => alert('Error cargando detalle: ' + (err.error?.detail || err.message)),
    });
  }

  closeDetail() {
    this.selectedDetail.set(null);
    this.editForm = {};
    this.newComment = '';
  }

  saveChanges() {
    const id = this.selectedDetail()?.id;
    if (!id) return;
    this.saving.set(true);
    this.service.actualizar(id, this.editForm).subscribe({
      next: (d) => {
        this.selectedDetail.set(d);
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        alert('Error al guardar: ' + (err.error?.detail || err.message));
      },
    });
  }

  addComment() {
    const id = this.selectedDetail()?.id;
    if (!id || !this.newComment.trim()) return;
    this.service.agregarComentario(id, this.newComment).subscribe(res => {
      const d = this.selectedDetail();
      if (d) this.selectedDetail.set({ ...d, comentarios: res.comentarios });
      this.newComment = '';
    });
  }

  deleteSolicitud() {
    const id = this.selectedDetail()?.id;
    if (!id || !confirm('¿Eliminar esta solicitud? Esta acción no se puede deshacer.')) return;
    this.service.eliminar(id).subscribe(() => {
      this.closeDetail();
      this.load();
    });
  }

  downloadAttach(a: AdjuntoMeta) {
    const id = this.selectedDetail()?.id;
    if (!id) return;
    this.service.descargarAdjuntoPorNombre(id, a.filename).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = a.filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  formatDate(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDateShort(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  stripHtml(html?: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  formatProb(p?: number): string {
    if (p == null) return '—';
    return Math.round(p * 100) + '%';
  }

  formatBytes(b?: number): string {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  riskClass(p?: number): string {
    if (p == null) return '';
    if (p > 0.7) return 'alto';
    if (p >= 0.4) return 'medio';
    return 'bajo';
  }

  predClass(p?: number): string { return this.riskClass(p) || 'bajo'; }

  prioridadClass(nombre?: string): string {
    const n = (nombre || '').toLowerCase();
    if (n === 'alta') return 'p-alta';
    if (n === 'media') return 'p-media';
    if (n === 'baja') return 'p-baja';
    return '';
  }

  estadoClass(nombre?: string): string {
    const n = (nombre || '').toLowerCase().replace(/\s+/g, '-');
    if (n === 'pendiente') return 'e-pendiente';
    if (n === 'en-proceso') return 'e-en-proceso';
    if (n === 'finalizado') return 'e-finalizado';
    return '';
  }
}
