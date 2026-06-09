import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SolicitudesService, CatalogosService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  SolicitudListItem, SolicitudDetail, Aseguradora, CatalogoItem, AdjuntoMeta, EjecutivoUser,
} from '../../models/models';

@Component({
  selector: 'app-lista-solicitudes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <!-- ── PAGE HEADER ─────────────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1>Solicitudes</h1>
        <p class="muted">{{ total() }} registros · ordenados por riesgo</p>
      </div>
      <div class="header-actions">
        <a routerLink="/solicitudes/carga-masiva" class="btn btn-outline">⤒ Carga Masiva</a>
        <a routerLink="/solicitudes/nueva" class="btn btn-primary">+ Nueva Solicitud</a>
      </div>
    </div>
    <!-- ── SEARCH + FILTERS ──────────────────────────────────────── -->
    <div *ngIf="showFilters" class="filter-backdrop" (click)="showFilters = false"></div>
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
        <table>
          <thead>
            <tr>
              <th class="col-ticket">Ticket</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th class="cell-center">Nro. Atenciones</th>
              <th>Ejecutivo</th>
              <th>Aseguradora</th>
              <th>Ramo</th>
              <th>Remitente</th>
              <th>Recepción</th>
              <th class="col-asunto">Asunto</th>
              <th class="col-adj"></th>
              <th class="col-open"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of solicitudes()" (click)="openDetail(s)" class="row-clickable">
              <td><span class="ticket">{{ s.nro_ticket || '—' }}</span></td>
              <td class="cell-nowrap">{{ s.cliente || '—' }}</td>
              <td>
                <span *ngIf="s.tipo_solicitud" class="pill pill-tipo">{{ s.tipo_solicitud }}</span>
                <span *ngIf="!s.tipo_solicitud" class="muted-dash">—</span>
              </td>
              <td><span class="pill" [class]="estadoClass(s.estado)">{{ s.estado || '—' }}</span></td>
              <td>
                <span *ngIf="s.prioridad" class="pill" [class]="prioridadClass(s.prioridad)">{{ s.prioridad }}</span>
                <span *ngIf="!s.prioridad" class="muted-dash">—</span>
              </td>
              <td class="cell-center"><span class="font-mono">{{ s.nro_atenciones ?? 1 }}</span></td>
              <td class="cell-nowrap">{{ s.ejecutivo || '—' }}</td>
              <td class="cell-nowrap">{{ s.aseguradora || '—' }}</td>
              <td>{{ s.ramo || '—' }}</td>
              <td class="cell-nowrap">{{ s.remitente || '—' }}</td>
              <td class="cell-date"><small>{{ formatDateShort(s.fecha_recepcion) || '—' }}</small></td>
              <td class="cell-truncate">{{ s.asunto }}</td>
              <td class="cell-center">
                <span *ngIf="s.tiene_adjuntos" class="adj-icon" title="Tiene adjuntos">📎</span>
              </td>
              <td><span class="open-arrow">›</span></td>
            </tr>
            <tr *ngIf="solicitudes().length === 0">
              <td colspan="14">
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

    <!-- ── SIDE PANEL ─────────────────────────────────────────────── -->
    <div class="panel-overlay" *ngIf="selectedDetail()" (click)="closeDetail()">
      <aside class="side-panel" (click)="$event.stopPropagation()">

        <!-- Sticky header -->
        <header class="panel-head">
          <div class="panel-head-left">
            <span class="ticket-chip">{{ selectedDetail()!.nro_ticket }}</span>
            <span class="source-chip">{{ selectedDetail()!.fuente || 'manual' }}</span>
          </div>
          <div class="panel-head-right">
            <button *ngIf="auth.isAdmin()" class="btn-icon danger" (click)="deleteSolicitud()" title="Eliminar solicitud">
              <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                <path d="M3 5h14M8 5V3h4v2M6 5v11a1 1 0 001 1h6a1 1 0 001-1V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="btn-icon" (click)="closeDetail()" title="Cerrar">
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Meta bar (readonly) -->
        <div class="meta-bar">
          <div class="meta-item">
            <span class="meta-label">Recepción</span>
            <span class="meta-val">{{ formatDate(selectedDetail()!.fecha_recepcion) || '—' }}</span>
          </div>
          <div class="meta-sep"></div>
          <div class="meta-item">
            <span class="meta-label">Remitente</span>
            <span class="meta-val">{{ selectedDetail()!.remitente || '—' }}</span>
          </div>
          <div class="meta-sep" *ngIf="(selectedDetail()!.datos_adjuntos?.length || 0) > 0"></div>
          <div class="meta-item" *ngIf="(selectedDetail()!.datos_adjuntos?.length || 0) > 0">
            <span class="meta-label">Adjuntos</span>
            <span class="meta-val">📎 {{ selectedDetail()!.datos_adjuntos?.length }}</span>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="panel-body">

          <!-- ── Sección: Tipificación ──────────────────────────── -->
          <section class="form-section">
            <h4 class="section-title">Tipificación</h4>
            <div class="field-grid">

              <div class="field">
                <label class="field-label">Cliente</label>
                <select [(ngModel)]="editForm.cliente">
                  <option value="">— Sin asignar —</option>
                  <option *ngFor="let c of clientes" [value]="c.nombre">{{ c.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Tipo de solicitud</label>
                <select [(ngModel)]="editForm.tipo_solicitud_id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let t of tiposSolicitud" [ngValue]="t.id">{{ t.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Estado</label>
                <select [(ngModel)]="editForm.estado_id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let e of estados" [ngValue]="e.id">{{ e.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Prioridad</label>
                <select [(ngModel)]="editForm.prioridad_id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let p of prioridades" [ngValue]="p.id">{{ p.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Aseguradora</label>
                <select [(ngModel)]="editForm.aseguradora_id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let a of aseguradoras" [ngValue]="a.id">{{ a.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Ramo</label>
                <select [(ngModel)]="editForm.ramo_id">
                  <option [ngValue]="null">—</option>
                  <option *ngFor="let r of ramos" [ngValue]="r.id">{{ r.nombre }}</option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Nro. Atenciones</label>
                <input type="number" [(ngModel)]="editForm.nro_atenciones" min="1" step="1" placeholder="1" />
              </div>

              <!-- Solo el administrador puede cambiar el ejecutivo asignado -->
              <div class="field field-full" *ngIf="auth.isAdmin()">
                <label class="field-label">Ejecutivo asignado</label>
                <select [(ngModel)]="editForm.ejecutivo_id">
                  <option [ngValue]="null">— Sin asignar —</option>
                  <option *ngFor="let e of ejecutivos" [value]="e.id">{{ e.full_name }}</option>
                </select>
              </div>
              <div class="field field-full" *ngIf="!auth.isAdmin()">
                <label class="field-label">Ejecutivo asignado</label>
                <div class="field-readonly">{{ selectedDetail()?.ejecutivo || '— Sin asignar —' }}</div>
              </div>

            </div>
          </section>

          <!-- ── Sección: Correo ────────────────────────────────── -->
          <section class="form-section">
            <h4 class="section-title">Correo</h4>
            <div class="field field-full">
              <label class="field-label">Asunto</label>
              <input type="text" [(ngModel)]="editForm.asunto" placeholder="Asunto del correo" />
            </div>
            <div class="field field-full" style="margin-top: 10px;">
              <label class="field-label">Cuerpo del correo</label>
              <textarea [(ngModel)]="editForm.cuerpo_correo" rows="5" placeholder="Cuerpo del correo..."></textarea>
            </div>
          </section>

          <!-- ── Predicción ANS ─────────────────────────────────── -->
          <div class="pred-block" [class]="predClass(selectedDetail()!.probabilidad)">
            <div class="pred-left">
              <small>Predicción ANS</small>
              <strong>{{ selectedDetail()!.prediccion || '—' }}</strong>
            </div>
            <div class="pred-right">
              <small>Probabilidad de incumplimiento</small>
              <span class="pred-pct">{{ formatProb(selectedDetail()!.probabilidad) }}</span>
            </div>
          </div>

          <!-- ── Fecha límite ────────────────────────────────────── -->
          <section class="form-section">
            <div class="field">
              <label class="field-label">Fecha límite (cierre)</label>
              <input type="datetime-local" [(ngModel)]="editForm.fecha_finalizado" />
            </div>
            <div class="field">
              <label class="field-label">Fecha de envío a aseguradora</label>
              <input type="datetime-local" [(ngModel)]="editForm.fecha_envio_aseguradora" />
            </div>
          </section>

          <!-- ── Adjuntos ───────────────────────────────────────── -->
          <section class="form-section">
            <div class="adj-header">
              <h4 class="section-title" style="margin:0">Adjuntos</h4>
              <label class="btn-upload" [class.btn-uploading]="uploadingFiles()">
                <svg *ngIf="!uploadingFiles()" viewBox="0 0 20 20" fill="none" width="13" height="13">
                  <path d="M10 3v10M5 8l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M3 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <div *ngIf="uploadingFiles()" class="btn-spinner"></div>
                {{ uploadingFiles() ? 'Subiendo...' : 'Adjuntar archivo' }}
                <input type="file" multiple style="display:none" (change)="onFilesSelected($event)" [disabled]="uploadingFiles()" />
              </label>
            </div>

            <div class="adj-error" *ngIf="uploadError()">{{ uploadError() }}</div>

            <div class="adjunto-list" *ngIf="(selectedDetail()!.datos_adjuntos?.length || 0) > 0; else noAdj">
              <div *ngFor="let a of selectedDetail()!.datos_adjuntos" class="adjunto-row" (click)="downloadAttach(a)">
                <svg viewBox="0 0 20 20" fill="none" width="14" height="14" style="flex-shrink:0"><path d="M12 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V8l-4-6z" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v6h6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
                <span class="adj-name">{{ a.filename }}</span>
                <small class="adj-size">{{ formatBytes(a.size) }}</small>
                <button class="adj-del" (click)="$event.stopPropagation(); deleteAttach(a)" title="Eliminar adjunto">✕</button>
              </div>
            </div>
            <ng-template #noAdj>
              <p class="no-comments" style="margin-top:10px">Sin adjuntos.</p>
            </ng-template>
          </section>

          <!-- ── Comentarios ────────────────────────────────────── -->
          <section class="form-section">
            <h4 class="section-title">Comentarios</h4>
            <pre class="comments-box" *ngIf="selectedDetail()!.comentarios">{{ selectedDetail()!.comentarios }}</pre>
            <p class="no-comments" *ngIf="!selectedDetail()!.comentarios">Sin comentarios.</p>
            <div class="comment-add">
              <textarea [(ngModel)]="newComment" rows="2" placeholder="Agregar comentario..."></textarea>
              <button class="btn btn-outline btn-sm" (click)="addComment()" [disabled]="!newComment.trim()">
                Agregar
              </button>
            </div>
          </section>

        </div><!-- /panel-body -->

        <!-- Sticky footer -->
        <footer class="panel-footer">
          <div class="save-error" *ngIf="saveError()">{{ saveError() }}</div>
          <div class="footer-actions">
            <button class="btn btn-outline" (click)="closeDetail()">Cancelar</button>
            <button class="btn btn-primary save-btn" (click)="saveChanges()" [disabled]="saving()">
              <svg *ngIf="!saving()" viewBox="0 0 20 20" fill="none" width="14" height="14">
                <path d="M4 14v2h12v-2M10 3v9M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div *ngIf="saving()" class="btn-spinner"></div>
              {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </footer>

      </aside>
    </div>
  `,
  styles: [`
    /* ── Page header ──────────────────────────────────────────── */
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; }
    .page-header h1 { font-size: 1.5rem; color: var(--text-primary); margin-bottom: 4px; }
    .muted { color: var(--text-muted); font-size: 0.85rem; }
    .header-actions { display: flex; gap: 8px; }

    /* ── Risk summary ────────────────────────────────────────── */
    .risk-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .risk-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius-lg); padding: 14px 18px;
      display: flex; align-items: center; gap: 14px;
    }
    .risk-card .dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
    .risk-card.r-bajo  { border-left: 4px solid var(--success); }
    .risk-card.r-bajo .dot { background: var(--success); }
    .risk-card.r-medio { border-left: 4px solid var(--warning); }
    .risk-card.r-medio .dot { background: var(--warning); }
    .risk-card.r-alto  { border-left: 4px solid var(--danger); }
    .risk-card.r-alto .dot  { background: var(--danger); }
    .risk-card strong { font-size: 1.35rem; color: var(--text-primary); display: block; }
    .risk-card small  { color: var(--text-muted); font-size: 0.75rem; }

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

    /* ── Table ───────────────────────────────────────────────── */
    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.78rem; white-space: nowrap; }
    thead th {
      text-align: left; padding: 10px 12px;
      background: var(--bg-surface); border-bottom: 2px solid var(--border);
      color: var(--text-secondary); font-size: 0.72rem; font-weight: 600;
    }
    tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; color: var(--text-primary); }
    tbody tr.row-clickable { cursor: pointer; transition: background 0.12s; }
    tbody tr.row-clickable:hover { background: var(--bg-hover); }
    tbody tr.row-fuera { background: rgba(255,76,76,0.03); }
    .col-ticket { width: 110px; }
    .col-adj    { width: 36px; }
    .col-open   { width: 28px; }
    .col-asunto { min-width: 160px; }
    .cell-nowrap  { white-space: nowrap; }
    .cell-date    { white-space: nowrap; }
    .cell-center  { text-align: center; }
    .cell-truncate { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
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

    /* ── Side panel ──────────────────────────────────────────── */
    .panel-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(11,37,69,0.32); backdrop-filter: blur(2px);
      display: flex; justify-content: flex-end;
      animation: fadeOverlay 0.18s;
    }
    @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }
    .side-panel {
      width: min(560px, 100%); height: 100vh;
      background: var(--bg-card);
      box-shadow: -6px 0 32px rgba(11,37,69,0.16);
      display: flex; flex-direction: column;
      animation: slidePanel 0.22s cubic-bezier(.4,0,.2,1);
    }
    @keyframes slidePanel { from { transform: translateX(100%); } to { transform: translateX(0); } }

    /* Panel header (sticky) */
    .panel-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid var(--border);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .panel-head-left { display: flex; align-items: center; gap: 8px; }
    .panel-head-right { display: flex; align-items: center; gap: 6px; }
    .ticket-chip {
      font-family: var(--font-mono, monospace); font-size: 0.82rem;
      font-weight: 700; color: var(--primary);
      background: rgba(0,90,158,0.1); padding: 3px 10px; border-radius: 20px;
    }
    .source-chip {
      font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
      background: var(--bg-hover); padding: 3px 8px; border-radius: 20px;
    }
    .btn-icon {
      width: 32px; height: 32px; border-radius: 8px;
      border: 1px solid var(--border); background: none;
      color: var(--text-muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
    .btn-icon.danger:hover { background: rgba(255,76,76,0.1); border-color: var(--danger); color: var(--danger); }

    /* Meta bar */
    .meta-bar {
      display: flex; align-items: center; flex-wrap: wrap; gap: 0;
      padding: 10px 18px; background: var(--bg-surface);
      border-bottom: 2px solid var(--border); flex-shrink: 0;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; margin-bottom: 1px; }
    .meta-val { font-size: 0.78rem; color: var(--text-primary); }
    .meta-sep { width: 1px; height: 30px; background: var(--border); margin: 0 16px; }

    /* Scrollable body */
    .panel-body { flex: 1; overflow-y: auto; padding: 0; }
    .panel-body::-webkit-scrollbar { width: 4px; }
    .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    /* Form sections */
    .form-section { padding: 18px 20px; border-bottom: 1px solid var(--border); }
    .section-title {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: var(--text-muted);
      margin: 0 0 14px;
    }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-full { width: 100%; }
    .field-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted); }
    .field input,
    .field select,
    .field textarea {
      padding: 8px 10px;
      border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 0.84rem; color: var(--text-primary);
      background: var(--bg-base); font-family: inherit;
      transition: border-color 0.15s;
      box-sizing: border-box; width: 100%;
    }
    .field input:focus,
    .field select:focus,
    .field textarea:focus { outline: none; border-color: var(--primary); background: #fff; }
    .field textarea { resize: vertical; min-height: 90px; }

    /* Predicción block */
    .pred-block {
      margin: 0; padding: 16px 20px;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .pred-block.bajo  { background: rgba(16,185,129,0.06); border-left: 4px solid var(--success); }
    .pred-block.medio { background: rgba(245,166,35,0.06);  border-left: 4px solid var(--warning); }
    .pred-block.alto  { background: rgba(255,76,76,0.06);   border-left: 4px solid var(--danger);  }
    .pred-left small, .pred-right small { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 3px; }
    .pred-left strong { font-size: 0.92rem; color: var(--text-primary); }
    .pred-pct { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
    .pred-block.alto .pred-pct  { color: var(--danger); }
    .pred-block.medio .pred-pct { color: var(--warning); }
    .pred-block.bajo .pred-pct  { color: var(--success); }

    /* Adjuntos */
    .adj-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .btn-upload {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 12px; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg-base);
      color: var(--text-secondary); font-size: 0.78rem; cursor: pointer;
      transition: all 0.15s;
    }
    .btn-upload:hover { border-color: var(--primary); color: var(--primary); background: rgba(0,90,158,0.06); }
    .btn-upload.btn-uploading { opacity: 0.7; cursor: not-allowed; }
    .adj-error { font-size: 0.76rem; color: var(--danger); background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); padding: 5px 10px; border-radius: var(--radius); margin-bottom: 8px; }
    .adjunto-list { display: flex; flex-direction: column; gap: 6px; }
    .adjunto-row {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg-base);
      color: var(--text-primary); cursor: pointer; transition: background 0.12s;
    }
    .adjunto-row:hover { background: var(--bg-hover); }
    .adj-name { flex: 1; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--primary); }
    .adj-name:hover { text-decoration: underline; }
    .adj-size { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; }
    .adj-del {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 0.75rem; padding: 2px 5px;
      border-radius: 4px; line-height: 1; transition: all 0.15s;
    }
    .adj-del:hover { background: rgba(255,76,76,0.1); color: var(--danger); }

    /* Comentarios */
    .comments-box {
      background: var(--bg-base); padding: 10px 12px; border-radius: var(--radius);
      border: 1px solid var(--border); font-size: 0.78rem; white-space: pre-wrap;
      max-height: 160px; overflow-y: auto; color: var(--text-secondary); margin: 0 0 10px;
    }
    .no-comments { color: var(--text-muted); font-size: 0.83rem; margin: 0 0 10px; }
    .comment-add { display: flex; gap: 8px; align-items: flex-start; }
    .comment-add textarea {
      flex: 1; padding: 7px 10px; border: 1px solid var(--border);
      border-radius: var(--radius); font-family: inherit; font-size: 0.82rem;
      resize: vertical; background: var(--bg-base); color: var(--text-primary);
    }
    .comment-add textarea:focus { outline: none; border-color: var(--primary); }

    /* Sticky footer */
    .panel-footer {
      flex-shrink: 0; padding: 12px 18px;
      border-top: 2px solid var(--border);
      background: var(--bg-surface);
    }
    .save-error { font-size: 0.78rem; color: var(--danger); margin-bottom: 8px; background: rgba(255,76,76,0.08); padding: 6px 10px; border-radius: var(--radius); border: 1px solid rgba(255,76,76,0.2); }
    .footer-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .save-btn { display: flex; align-items: center; gap: 6px; min-width: 150px; justify-content: center; }
    .btn-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

    /* Responsive */
    @media (max-width: 768px) {
      .risk-summary { grid-template-columns: 1fr; }
      .field-grid { grid-template-columns: 1fr; }
      .side-panel { width: 100%; }
      .meta-bar { gap: 8px; }
      .meta-sep { display: none; }
    }
  `],
})
export class ListaSolicitudesComponent implements OnInit {
  solicitudes  = signal<SolicitudListItem[]>([]);
  selectedDetail = signal<SolicitudDetail | null>(null);
  loading    = signal(true);
  saving     = signal(false);
  loadError      = signal<string | null>(null);
  saveError      = signal<string | null>(null);
  uploadingFiles = signal(false);
  uploadError    = signal<string | null>(null);
  total      = signal(0);
  page       = signal(1);
  pages      = signal(1);

  aseguradoras:  Aseguradora[]   = [];
  tiposSolicitud: CatalogoItem[] = [];
  estados:       CatalogoItem[]  = [];
  prioridades:   CatalogoItem[]  = [];
  ramos:         CatalogoItem[]  = [];
  clientes:      CatalogoItem[]  = [];
  ejecutivos:    EjecutivoUser[] = [];

  searchTerm = '';
  filterEstado = '';
  filterPrioridad = '';
  filterAseguradora = '';
  filterRamo = '';
  filterPrediccion = '';
  orderBy = 'created_at';
  showFilters = false;

  editForm: any = {};
  newComment = '';

  countBajo  = computed(() => this.solicitudes().filter(s => (s.probabilidad ?? 0) < 0.4).length);
  countMedio = computed(() => this.solicitudes().filter(s => { const p = s.probabilidad ?? 0; return p >= 0.4 && p <= 0.7; }).length);
  countAlto  = computed(() => this.solicitudes().filter(s => (s.probabilidad ?? 0) > 0.7).length);

  private searchTimer: any;

  constructor(
    private service:   SolicitudesService,
    private catalogos: CatalogosService,
    public  auth:      AuthService,
  ) {}

  ngOnInit() {
    this.catalogos.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogos.getTiposSolicitud().subscribe(d => this.tiposSolicitud = d);
    this.catalogos.getEstadosSolicitud().subscribe(d => this.estados = d);
    this.catalogos.getPrioridades().subscribe(d => this.prioridades = d);
    this.catalogos.getRamos().subscribe(d => this.ramos = d);
    this.catalogos.getClientes().subscribe(d => this.clientes = d);
    this.service.getEjecutivos().subscribe({ next: d => this.ejecutivos = d, error: () => {} });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.loadError.set(null);
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

  openDetail(s: SolicitudListItem) {
    this.saveError.set(null);
    this.service.detalle(s.id).subscribe({
      next: (d) => {
        this.selectedDetail.set(d);
        this.editForm = {
          cliente:           d.cliente ?? '',
          tipo_solicitud_id: d.tipo_solicitud_id ?? null,
          estado_id:         d.estado_id ?? null,
          prioridad_id:      d.prioridad_id ?? null,
          aseguradora_id:    d.aseguradora_id ?? null,
          ramo_id:           d.ramo_id ?? null,
          asunto:            d.asunto ?? '',
          cuerpo_correo:     d.cuerpo_correo ?? '',
          fecha_finalizado:  d.fecha_finalizado
            ? this.toLocalDatetimeInput(d.fecha_finalizado)
            : '',
          fecha_envio_aseguradora: d.fecha_envio_aseguradora
            ? this.toLocalDatetimeInput(d.fecha_envio_aseguradora)
            : '',
          ejecutivo_id:      d.ejecutivo_id ?? null,
          nro_atenciones:    d.nro_atenciones ?? 1,
        };
        this.newComment = '';
      },
      error: (err) => alert('Error cargando detalle: ' + (err?.error?.detail || err?.message)),
    });
  }

  closeDetail() {
    this.selectedDetail.set(null);
    this.editForm = {};
    this.newComment = '';
    this.saveError.set(null);
  }

  saveChanges() {
    const id = this.selectedDetail()?.id;
    if (!id) return;

    // Build a clean payload: empty strings → null, datetime-local → ISO 8601
    const raw = this.editForm;
    const payload: any = {
      cliente:           raw.cliente || null,
      tipo_solicitud_id: raw.tipo_solicitud_id ?? null,
      estado_id:         raw.estado_id ?? null,
      prioridad_id:      raw.prioridad_id ?? null,
      aseguradora_id:    raw.aseguradora_id ?? null,
      ramo_id:           raw.ramo_id ?? null,
      asunto:            raw.asunto || null,
      cuerpo_correo:     raw.cuerpo_correo || null,
      // datetime-local gives "YYYY-MM-DDTHH:MM"; Pydantic needs ISO-8601 or null
      fecha_finalizado:  raw.fecha_finalizado
        ? new Date(raw.fecha_finalizado).toISOString()
        : null,
      fecha_envio_aseguradora: raw.fecha_envio_aseguradora
        ? new Date(raw.fecha_envio_aseguradora).toISOString()
        : null,
      nro_atenciones: raw.nro_atenciones ? Math.max(1, parseInt(raw.nro_atenciones, 10)) : null,
      ...(this.auth.isAdmin() ? { ejecutivo_id: raw.ejecutivo_id || null } : {}),
    };

    console.log('[saveChanges] payload →', payload);

    this.saving.set(true);
    this.saveError.set(null);
    this.service.actualizar(id, payload).subscribe({
      next: (d) => {
        this.selectedDetail.set(d);
        this.saving.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('[saveChanges] PATCH error completo:', err);
        const detail = err?.error?.detail;
        let msg: string;
        if (Array.isArray(detail)) {
          // FastAPI 422: detail is [{loc, msg, type}, ...]
          msg = detail.map((e: any) => {
            const field = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : '';
            return field ? `${field}: ${e.msg}` : e.msg;
          }).join(' | ');
        } else if (typeof detail === 'string') {
          msg = detail;
        } else {
          msg = err?.message || 'Error al guardar';
        }
        this.saveError.set(msg);
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
    this.service.eliminar(id).subscribe(() => { this.closeDetail(); this.load(); });
  }

  downloadAttach(a: AdjuntoMeta) {
    const id = this.selectedDetail()?.id;
    if (!id) return;
    // Log the full adjunto object so we can inspect all available fields
    console.log('[downloadAttach] adjunto completo:', JSON.stringify(a));
    // Use stored_filename (physical file on disk) if present; fall back to filename
    const downloadKey = (a as any).stored_filename || a.filename;
    const displayName = a.filename;
    console.log('[downloadAttach] usando key para URL:', downloadKey);
    this.uploadError.set(null);
    this.service.descargarAdjuntoPorNombre(id, downloadKey).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (err) => {
        const detail = err?.error?.detail || err?.message || `HTTP ${err?.status}`;
        console.error('[downloadAttach] error:', err);
        this.uploadError.set('No se pudo descargar: ' + detail);
      },
    });
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const id = this.selectedDetail()?.id;
    if (!id) return;
    this.uploadingFiles.set(true);
    this.uploadError.set(null);
    this.service.subirAdjuntos(id, files).subscribe({
      next: (res) => {
        const d = this.selectedDetail();
        if (d) this.selectedDetail.set({ ...d, datos_adjuntos: res.datos_adjuntos });
        this.uploadingFiles.set(false);
        input.value = '';
      },
      error: (err) => {
        this.uploadError.set(err?.error?.detail || err?.message || 'Error al subir archivos');
        this.uploadingFiles.set(false);
        input.value = '';
      },
    });
  }

  deleteAttach(a: AdjuntoMeta) {
    const id = this.selectedDetail()?.id;
    if (!id || !confirm(`¿Eliminar el adjunto "${a.filename}"?`)) return;
    const deleteKey = (a as any).stored_filename || a.filename;
    this.service.eliminarAdjunto(id, deleteKey).subscribe({
      next: (res) => {
        const d = this.selectedDetail();
        if (d) this.selectedDetail.set({ ...d, datos_adjuntos: res.datos_adjuntos || [] });
      },
      error: (err) => {
        this.uploadError.set(err?.error?.detail || err?.message || 'Error al eliminar adjunto');
      },
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */

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

  formatProb(p?: number): string {
    if (p == null) return '—';
    return Math.round(p * 100) + '%';
  }

  formatBytes(b?: number): string {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  toLocalDatetimeInput(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  predClass(p?: number): string {
    if (p == null) return 'bajo';
    if (p > 0.7) return 'alto';
    if (p >= 0.4) return 'medio';
    return 'bajo';
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
}
