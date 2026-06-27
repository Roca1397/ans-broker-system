import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SolicitudesService, CatalogosService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  SolicitudDetail, Aseguradora, CatalogoItem, AdjuntoMeta, EjecutivoUser,
} from '../../models/models';

/**
 * Panel lateral de detalle/edición de una solicitud.
 * Reutilizable desde Solicitudes y Predicciones.
 *
 * Uso:
 *   <app-solicitud-detalle-panel
 *     [solicitudId]="id"
 *     (closed)="onClosed()"
 *     (saved)="onSaved()">
 *   </app-solicitud-detalle-panel>
 */
@Component({
  selector: 'app-solicitud-detalle-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel-overlay" *ngIf="solicitudId" (click)="close()">
      <aside class="side-panel" (click)="$event.stopPropagation()">

        <!-- Sticky header -->
        <header class="panel-head">
          <div class="panel-head-left">
            <span class="ticket-chip">{{ detail()?.nro_ticket || '…' }}</span>
            <span class="source-chip">{{ detail()?.fuente || 'manual' }}</span>
          </div>
          <div class="panel-head-right">
            <button *ngIf="auth.isAdmin()" class="btn-icon danger" (click)="deleteSolicitud()" title="Eliminar solicitud">
              <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
                <path d="M3 5h14M8 5V3h4v2M6 5v11a1 1 0 001 1h6a1 1 0 001-1V5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="btn-icon" (click)="close()" title="Cerrar">
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Loading -->
        <div *ngIf="loading()" class="panel-loading">
          <div class="spinner"></div>
        </div>

        <ng-container *ngIf="!loading() && detail() as d">

          <!-- Meta bar -->
          <div class="meta-bar">
            <div class="meta-item">
              <span class="meta-label">Recepción</span>
              <span class="meta-val">{{ formatDate(d.fecha_recepcion) || '—' }}</span>
            </div>
            <div class="meta-sep"></div>
            <div class="meta-item">
              <span class="meta-label">Remitente</span>
              <span class="meta-val">{{ d.remitente || '—' }}</span>
            </div>
            <ng-container *ngIf="(d.datos_adjuntos?.length || 0) > 0">
              <div class="meta-sep"></div>
              <div class="meta-item">
                <span class="meta-label">Adjuntos</span>
                <span class="meta-val">📎 {{ d.datos_adjuntos?.length }}</span>
              </div>
            </ng-container>
          </div>

          <!-- Scrollable body -->
          <div class="panel-body">

            <!-- Tipificación -->
            <section class="form-section">
              <h4 class="section-title">Tipificación</h4>
              <div class="field-grid">

                <div class="field">
                  <label class="field-label">Cliente</label>
                  <select [(ngModel)]="form.cliente">
                    <option value="">— Sin asignar —</option>
                    <option *ngFor="let c of clientes" [value]="c.nombre">{{ c.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Tipo de solicitud</label>
                  <select [(ngModel)]="form.tipo_solicitud_id">
                    <option [ngValue]="null">—</option>
                    <option *ngFor="let t of tiposSolicitud" [ngValue]="t.id">{{ t.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Estado</label>
                  <select [(ngModel)]="form.estado_id">
                    <option [ngValue]="null">—</option>
                    <option *ngFor="let e of estados" [ngValue]="e.id">{{ e.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Prioridad</label>
                  <select [(ngModel)]="form.prioridad_id">
                    <option [ngValue]="null">—</option>
                    <option *ngFor="let p of prioridades" [ngValue]="p.id">{{ p.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Aseguradora</label>
                  <select [(ngModel)]="form.aseguradora_id">
                    <option [ngValue]="null">—</option>
                    <option *ngFor="let a of aseguradoras" [ngValue]="a.id">{{ a.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Ramo</label>
                  <select [(ngModel)]="form.ramo_id">
                    <option [ngValue]="null">—</option>
                    <option *ngFor="let r of ramos" [ngValue]="r.id">{{ r.nombre }}</option>
                  </select>
                </div>

                <div class="field">
                  <label class="field-label">Nro. Atenciones</label>
                  <input type="number" [(ngModel)]="form.nro_atenciones" min="1" step="1" placeholder="1" />
                </div>

                <div class="field field-full" *ngIf="auth.isAdmin()">
                  <label class="field-label">Ejecutivo asignado</label>
                  <select [(ngModel)]="form.ejecutivo_id">
                    <option [ngValue]="null">— Sin asignar —</option>
                    <option *ngFor="let e of ejecutivos" [value]="e.id">{{ e.full_name }}</option>
                  </select>
                </div>
                <div class="field field-full" *ngIf="!auth.isAdmin()">
                  <label class="field-label">Ejecutivo asignado</label>
                  <div class="field-readonly">{{ d.ejecutivo || '— Sin asignar —' }}</div>
                </div>

              </div>
            </section>

            <!-- Correo -->
            <section class="form-section">
              <h4 class="section-title">Correo</h4>
              <div class="field field-full">
                <label class="field-label">Asunto</label>
                <input type="text" [(ngModel)]="form.asunto" placeholder="Asunto del correo" />
              </div>
              <div class="field field-full" style="margin-top:10px">
                <label class="field-label">Cuerpo del correo</label>
                <textarea [(ngModel)]="form.cuerpo_correo" rows="5" placeholder="Cuerpo del correo..."></textarea>
              </div>
            </section>

            <!-- Predicción ANS -->
            <div class="pred-block" [class]="predClass(d.probabilidad)">
              <div class="pred-left">
                <small>Predicción ANS</small>
                <strong>{{ d.prediccion || '—' }}</strong>
              </div>
              <div class="pred-right">
                <small>Probabilidad de incumplimiento</small>
                <span class="pred-pct">{{ formatProb(d.probabilidad) }}</span>
              </div>
            </div>

            <!-- Fechas operativas -->
            <section class="form-section">
              <div class="field">
                <label class="field-label">Fecha de atención</label>
                <input type="datetime-local" [(ngModel)]="form.fecha_finalizado" />
              </div>
              <div class="field" style="margin-top:10px">
                <label class="field-label">Fecha de envío a aseguradora</label>
                <input type="datetime-local" [(ngModel)]="form.fecha_envio_aseguradora" />
              </div>
            </section>

            <!-- Adjuntos -->
            <section class="form-section">
              <div class="adj-header">
                <h4 class="section-title" style="margin:0">Adjuntos</h4>
                <label class="btn-upload" [class.btn-uploading]="uploading()">
                  <svg *ngIf="!uploading()" viewBox="0 0 20 20" fill="none" width="13" height="13">
                    <path d="M10 3v10M5 8l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M3 17h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  </svg>
                  <div *ngIf="uploading()" class="btn-spinner"></div>
                  {{ uploading() ? 'Subiendo...' : 'Adjuntar archivo' }}
                  <input type="file" multiple style="display:none" (change)="onFilesSelected($event)" [disabled]="uploading()" />
                </label>
              </div>

              <div class="adj-error" *ngIf="uploadError()">{{ uploadError() }}</div>

              <ng-container *ngIf="(d.datos_adjuntos?.length || 0) > 0; else noAdj">
                <div *ngFor="let a of d.datos_adjuntos" class="adjunto-row" (click)="downloadAttach(a)">
                  <svg viewBox="0 0 20 20" fill="none" width="14" height="14" style="flex-shrink:0">
                    <path d="M12 2H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V8l-4-6z" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M12 2v6h6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                  </svg>
                  <span class="adj-name">{{ a.filename }}</span>
                  <small class="adj-size">{{ formatBytes(a.size) }}</small>
                  <button class="adj-del" (click)="$event.stopPropagation(); deleteAttach(a)" title="Eliminar">✕</button>
                </div>
              </ng-container>
              <ng-template #noAdj>
                <p class="no-comments" style="margin-top:10px">Sin adjuntos.</p>
              </ng-template>
            </section>

            <!-- Comentarios -->
            <section class="form-section">
              <h4 class="section-title">Comentarios</h4>
              <pre class="comments-box" *ngIf="d.comentarios">{{ d.comentarios }}</pre>
              <p class="no-comments" *ngIf="!d.comentarios">Sin comentarios.</p>
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
              <button class="btn btn-outline" (click)="close()">Cancelar</button>
              <button class="btn btn-primary save-btn" (click)="save()" [disabled]="saving()">
                <svg *ngIf="!saving()" viewBox="0 0 20 20" fill="none" width="14" height="14">
                  <path d="M4 14v2h12v-2M10 3v9M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div *ngIf="saving()" class="btn-spinner"></div>
                {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </footer>

        </ng-container>
      </aside>
    </div>
  `,
  styles: [`
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

    .panel-loading { display: flex; justify-content: center; align-items: center; padding: 60px; }
    .spinner { width: 30px; height: 30px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

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
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
    .btn-icon.danger:hover { background: rgba(255,76,76,0.1); border-color: var(--danger); color: var(--danger); }

    .meta-bar {
      display: flex; align-items: center; flex-wrap: wrap;
      padding: 10px 18px; background: var(--bg-surface);
      border-bottom: 2px solid var(--border); flex-shrink: 0;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 600; margin-bottom: 1px; }
    .meta-val { font-size: 0.78rem; color: var(--text-primary); }
    .meta-sep { width: 1px; height: 30px; background: var(--border); margin: 0 16px; }

    .panel-body { flex: 1; overflow-y: auto; padding: 0; }
    .panel-body::-webkit-scrollbar { width: 4px; }
    .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .form-section { padding: 18px 20px; border-bottom: 1px solid var(--border); }
    .section-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin: 0 0 14px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field-full { width: 100%; grid-column: 1 / -1; }
    .field-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted); }
    .field-readonly { font-size: 0.84rem; color: var(--text-primary); padding: 8px 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); }
    .field input, .field select, .field textarea {
      padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius);
      font-size: 0.84rem; color: var(--text-primary); background: var(--bg-base);
      font-family: inherit; transition: border-color 0.15s; box-sizing: border-box; width: 100%;
    }
    .field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: var(--primary); background: #fff; }
    .field textarea { resize: vertical; min-height: 90px; }

    .pred-block { margin: 0; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
    .pred-block.bajo  { background: rgba(16,185,129,0.06); border-left: 4px solid var(--success); }
    .pred-block.medio { background: rgba(245,166,35,0.06);  border-left: 4px solid var(--warning); }
    .pred-block.alto  { background: rgba(255,76,76,0.06);   border-left: 4px solid var(--danger); }
    .pred-left small, .pred-right small { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 3px; }
    .pred-left strong { font-size: 0.92rem; color: var(--text-primary); }
    .pred-pct { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
    .pred-block.alto .pred-pct  { color: var(--danger); }
    .pred-block.medio .pred-pct { color: var(--warning); }
    .pred-block.bajo .pred-pct  { color: var(--success); }

    .adj-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .btn-upload {
      display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
      border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-base);
      color: var(--text-secondary); font-size: 0.78rem; cursor: pointer; transition: all 0.15s;
    }
    .btn-upload:hover { border-color: var(--primary); color: var(--primary); background: rgba(0,90,158,0.06); }
    .btn-upload.btn-uploading { opacity: 0.7; cursor: not-allowed; }
    .adj-error { font-size: 0.76rem; color: var(--danger); background: rgba(255,76,76,0.08); border: 1px solid rgba(255,76,76,0.2); padding: 5px 10px; border-radius: var(--radius); margin-bottom: 8px; }
    .adjunto-row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-base); color: var(--text-primary); cursor: pointer; transition: background 0.12s; margin-bottom: 6px; }
    .adjunto-row:hover { background: var(--bg-hover); }
    .adj-name { flex: 1; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--primary); }
    .adj-size { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; }
    .adj-del { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; padding: 2px 5px; border-radius: 4px; line-height: 1; transition: all 0.15s; }
    .adj-del:hover { background: rgba(255,76,76,0.1); color: var(--danger); }

    .comments-box { background: var(--bg-base); padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--border); font-size: 0.78rem; white-space: pre-wrap; max-height: 160px; overflow-y: auto; color: var(--text-secondary); margin: 0 0 10px; }
    .no-comments { color: var(--text-muted); font-size: 0.83rem; margin: 0 0 10px; }
    .comment-add { display: flex; gap: 8px; align-items: flex-start; }
    .comment-add textarea { flex: 1; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-family: inherit; font-size: 0.82rem; resize: vertical; background: var(--bg-base); color: var(--text-primary); }
    .comment-add textarea:focus { outline: none; border-color: var(--primary); }

    .panel-footer { flex-shrink: 0; padding: 12px 18px; border-top: 2px solid var(--border); background: var(--bg-surface); }
    .save-error { font-size: 0.78rem; color: var(--danger); margin-bottom: 8px; background: rgba(255,76,76,0.08); padding: 6px 10px; border-radius: var(--radius); border: 1px solid rgba(255,76,76,0.2); }
    .footer-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .save-btn { display: flex; align-items: center; gap: 6px; min-width: 150px; justify-content: center; }
    .btn-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    .btn { padding: 8px 16px; border-radius: var(--radius); font-size: 0.84rem; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .btn-outline { border-color: var(--border); background: none; color: var(--text-secondary); }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
    .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 5px 12px; font-size: 0.78rem; }

    @media (max-width: 768px) {
      .field-grid { grid-template-columns: 1fr; }
      .side-panel { width: 100%; }
      .meta-sep { display: none; }
    }
  `],
})
export class SolicitudDetallePanelComponent implements OnChanges {
  @Input() solicitudId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<void>();

  detail    = signal<SolicitudDetail | null>(null);
  loading   = signal(false);
  saving    = signal(false);
  saveError = signal<string | null>(null);
  uploading = signal(false);
  uploadError = signal<string | null>(null);

  form: any = {};
  newComment = '';

  aseguradoras:   Aseguradora[]  = [];
  tiposSolicitud: CatalogoItem[] = [];
  estados:        CatalogoItem[] = [];
  prioridades:    CatalogoItem[] = [];
  ramos:          CatalogoItem[] = [];
  clientes:       CatalogoItem[] = [];
  ejecutivos:     EjecutivoUser[] = [];

  private catalogsLoaded = false;

  constructor(
    private svc:      SolicitudesService,
    private catalogos: CatalogosService,
    public  auth:     AuthService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['solicitudId']) {
      const id = changes['solicitudId'].currentValue as string | null;
      if (id) {
        this._ensureCatalogs();
        this._loadDetail(id);
      } else {
        this.detail.set(null);
      }
    }
  }

  close() {
    this.detail.set(null);
    this.form = {};
    this.newComment = '';
    this.saveError.set(null);
    this.uploadError.set(null);
    this.closed.emit();
  }

  save() {
    const id = this.detail()?.id;
    if (!id) return;

    const raw = this.form;
    const payload: any = {
      cliente:           raw.cliente || null,
      tipo_solicitud_id: raw.tipo_solicitud_id ?? null,
      estado_id:         raw.estado_id ?? null,
      prioridad_id:      raw.prioridad_id ?? null,
      aseguradora_id:    raw.aseguradora_id ?? null,
      ramo_id:           raw.ramo_id ?? null,
      asunto:            raw.asunto || null,
      cuerpo_correo:     raw.cuerpo_correo || null,
      fecha_finalizado:  raw.fecha_finalizado
        ? new Date(raw.fecha_finalizado).toISOString() : null,
      fecha_envio_aseguradora: raw.fecha_envio_aseguradora
        ? new Date(raw.fecha_envio_aseguradora).toISOString() : null,
      nro_atenciones: raw.nro_atenciones ? Math.max(1, parseInt(raw.nro_atenciones, 10)) : null,
      ...(this.auth.isAdmin() ? { ejecutivo_id: raw.ejecutivo_id || null } : {}),
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.svc.actualizar(id, payload).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail;
        let msg: string;
        if (Array.isArray(detail)) {
          msg = detail.map((e: any) => {
            const field = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : '';
            return field ? `${field}: ${e.msg}` : e.msg;
          }).join(' | ');
        } else {
          msg = typeof detail === 'string' ? detail : (err?.message || 'Error al guardar');
        }
        this.saveError.set(msg);
      },
    });
  }

  addComment() {
    const id = this.detail()?.id;
    if (!id || !this.newComment.trim()) return;
    this.svc.agregarComentario(id, this.newComment).subscribe(res => {
      const d = this.detail();
      if (d) this.detail.set({ ...d, comentarios: res.comentarios });
      this.newComment = '';
    });
  }

  deleteSolicitud() {
    const id = this.detail()?.id;
    if (!id || !confirm('¿Eliminar esta solicitud? Esta acción no se puede deshacer.')) return;
    this.svc.eliminar(id).subscribe(() => {
      this.close();
      this.saved.emit();
    });
  }

  downloadAttach(a: AdjuntoMeta) {
    const id = this.detail()?.id;
    if (!id) return;
    const key = (a as any).stored_filename || a.filename;
    this.uploadError.set(null);
    this.svc.descargarAdjuntoPorNombre(id, key).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = a.filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: (err) => {
        this.uploadError.set('No se pudo descargar: ' + (err?.error?.detail || err?.message || `HTTP ${err?.status}`));
      },
    });
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const id = this.detail()?.id;
    if (!id) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    this.svc.subirAdjuntos(id, files).subscribe({
      next: (res) => {
        const d = this.detail();
        if (d) this.detail.set({ ...d, datos_adjuntos: res.datos_adjuntos });
        this.uploading.set(false);
        input.value = '';
      },
      error: (err) => {
        this.uploadError.set(err?.error?.detail || err?.message || 'Error al subir archivos');
        this.uploading.set(false);
        input.value = '';
      },
    });
  }

  deleteAttach(a: AdjuntoMeta) {
    const id = this.detail()?.id;
    if (!id || !confirm(`¿Eliminar el adjunto "${a.filename}"?`)) return;
    const key = (a as any).stored_filename || a.filename;
    this.svc.eliminarAdjunto(id, key).subscribe({
      next: (res) => {
        const d = this.detail();
        if (d) this.detail.set({ ...d, datos_adjuntos: res.datos_adjuntos || [] });
      },
      error: (err) => this.uploadError.set(err?.error?.detail || err?.message || 'Error al eliminar adjunto'),
    });
  }

  /* ── Helpers ─────────────────────────────────── */

  formatDate(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

  predClass(p?: number): string {
    if (p == null) return 'bajo';
    if (p > 0.7) return 'alto';
    if (p >= 0.4) return 'medio';
    return 'bajo';
  }

  private _toLocalDatetimeInput(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private _loadDetail(id: string) {
    this.loading.set(true);
    this.saveError.set(null);
    this.detail.set(null);
    this.svc.detalle(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.form = {
          cliente:           d.cliente ?? '',
          tipo_solicitud_id: d.tipo_solicitud_id ?? null,
          estado_id:         d.estado_id ?? null,
          prioridad_id:      d.prioridad_id ?? null,
          aseguradora_id:    d.aseguradora_id ?? null,
          ramo_id:           d.ramo_id ?? null,
          asunto:            d.asunto ?? '',
          cuerpo_correo:     d.cuerpo_correo ?? '',
          fecha_finalizado:  d.fecha_finalizado ? this._toLocalDatetimeInput(d.fecha_finalizado) : '',
          fecha_envio_aseguradora: d.fecha_envio_aseguradora ? this._toLocalDatetimeInput(d.fecha_envio_aseguradora) : '',
          ejecutivo_id:      d.ejecutivo_id ?? null,
          nro_atenciones:    d.nro_atenciones ?? 1,
        };
        this.newComment = '';
        this.loading.set(false);
      },
      error: () => {
        this.saveError.set('No se pudo cargar la solicitud.');
        this.loading.set(false);
      },
    });
  }

  private _ensureCatalogs() {
    if (this.catalogsLoaded) return;
    this.catalogsLoaded = true;
    this.catalogos.getAseguradoras().subscribe(d => this.aseguradoras = d);
    this.catalogos.getTiposSolicitud().subscribe(d => this.tiposSolicitud = d);
    this.catalogos.getEstadosSolicitud().subscribe(d => this.estados = d);
    this.catalogos.getPrioridades().subscribe(d => this.prioridades = d);
    this.catalogos.getRamos().subscribe(d => this.ramos = d);
    this.catalogos.getClientes().subscribe(d => this.clientes = d);
    this.svc.getEjecutivos().subscribe({ next: d => this.ejecutivos = d, error: () => {} });
  }
}
