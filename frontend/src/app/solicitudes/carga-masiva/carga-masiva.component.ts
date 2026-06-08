import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SolicitudesService } from '../../services/api.service';
import { BulkUploadResult } from '../../models/models';

@Component({
  selector: 'app-carga-masiva',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-header flex-between">
      <div>
        <h1>Carga Masiva</h1>
        <p>Importa múltiples solicitudes desde Excel o CSV con predicción automática</p>
      </div>
      <a routerLink="/solicitudes" class="btn btn-outline">← Volver</a>
    </div>

    <div class="upload-layout">
      <!-- Drop Zone -->
      <div class="card upload-card"
           [class.drag-over]="isDragging"
           (dragover)="onDragOver($event)"
           (dragleave)="isDragging = false"
           (drop)="onDrop($event)">

        <input type="file" #fileInput accept=".xlsx,.xls,.csv"
               (change)="onFileSelect($event)" style="display:none" />

        <div class="drop-zone" (click)="fileInput.click()" *ngIf="!file && !loading">
          <div class="drop-icon">⤒</div>
          <h3>Arrastra tu archivo aquí</h3>
          <p>o haz clic para seleccionar</p>
          <div class="file-types">
            <span class="badge badge-info">.xlsx</span>
            <span class="badge badge-info">.xls</span>
            <span class="badge badge-info">.csv</span>
          </div>
        </div>

        <div class="file-selected" *ngIf="file && !loading && !result">
          <div class="file-icon">📄</div>
          <div>
            <div class="file-name">{{ file.name }}</div>
            <div class="file-size">{{ formatSize(file.size) }}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" (click)="upload()">⤒ Importar</button>
            <button class="btn btn-outline" (click)="clearFile()">✕</button>
          </div>
        </div>

        <div class="loading-state" *ngIf="loading">
          <div class="spinner"></div>
          <p>Procesando archivo y generando predicciones...</p>
          <small style="color:var(--text-muted)">Esto puede tardar unos segundos</small>
        </div>
      </div>

      <!-- Result -->
      <div class="card result-card" *ngIf="result">
        <h3 style="margin-bottom: 20px;">Resultado de la Importación</h3>

        <div class="result-stats">
          <div class="result-stat">
            <div class="rs-value font-mono">{{ result.total }}</div>
            <div class="rs-label">Total filas</div>
          </div>
          <div class="result-stat success">
            <div class="rs-value font-mono text-success">{{ result.exitosos }}</div>
            <div class="rs-label">Exitosos</div>
          </div>
          <div class="result-stat" [class.danger]="result.errores > 0">
            <div class="rs-value font-mono" [class.text-danger]="result.errores > 0">{{ result.errores }}</div>
            <div class="rs-label">Con errores</div>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-fill" [style.width]="(result.exitosos / result.total * 100) + '%'"></div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);text-align:center;margin-top:6px">
          {{ (result.exitosos / result.total * 100).toFixed(1) }}% procesado correctamente
        </div>

        <div *ngIf="result.detalles_errores.length > 0" class="errors-list">
          <h4>Detalle de errores:</h4>
          <div class="error-item" *ngFor="let e of result.detalles_errores">
            <span class="badge badge-danger">Fila {{ e.fila }}</span>
            <span style="font-size:0.82rem;color:var(--text-secondary)">{{ e.error }}</span>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn btn-outline" (click)="reset()">Importar otro archivo</button>
          <a routerLink="/predicciones" class="btn btn-primary">Ver predicciones →</a>
        </div>
      </div>

      <!-- Template Card -->
      <div class="card template-card">
        <h3 style="margin-bottom: 16px; font-size: 0.95rem;">Formato de Archivo Requerido</h3>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:16px">
          El archivo debe contener las siguientes columnas (en cualquier orden):
        </p>
        <div class="column-list">
          <div class="col-item" *ngFor="let c of requiredColumns">
            <span class="col-name font-mono">{{ c.name }}</span>
            <span class="col-desc">{{ c.desc }}</span>
            <span class="badge" [class]="c.required ? 'badge-danger' : 'badge-info'" style="font-size:0.65rem">
              {{ c.required ? 'Requerido' : 'Opcional' }}
            </span>
          </div>
        </div>
        <div class="example-row">
          <h4>Ejemplo de fila:</h4>
          <code>2024-06-15 09:00, 1, 3, 50, 24, 2024-06-17 09:00, Renovación express</code>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .upload-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }

    .upload-card { min-height: 280px; display: flex; align-items: center; justify-content: center; cursor: default;
      border: 2px dashed var(--border); transition: border-color 0.2s, background 0.2s;
      &.drag-over { border-color: var(--primary); background: var(--primary-glow); }
    }

    .drop-zone { text-align: center; padding: 40px; cursor: pointer; width: 100%;
      h3 { margin: 16px 0 8px; color: var(--text-secondary); }
      p  { font-size: 0.875rem; color: var(--text-muted); margin-bottom: 20px; }
    }
    .drop-icon { font-size: 3rem; color: var(--primary); opacity: 0.6; }
    .file-types { display: flex; gap: 8px; justify-content: center; }

    .file-selected { display: flex; align-items: center; gap: 16px; padding: 24px; width: 100%;
      .file-icon { font-size: 2rem; }
      .file-name { font-weight: 600; color: var(--text-primary); }
      .file-size { font-size: 0.8rem; color: var(--text-muted); }
      div:last-child { margin-left: auto; }
    }

    .result-card { grid-column: 1; }
    .result-stats { display: flex; gap: 20px; margin-bottom: 20px; }
    .result-stat { flex: 1; text-align: center; padding: 16px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);
      &.danger { border-color: rgba(255,71,87,0.3); }
    }
    .rs-value { font-size: 2rem; font-weight: 700; }
    .rs-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.04em; }

    .progress-bar-container { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--success); border-radius: 4px; transition: width 0.8s ease; }

    .errors-list { margin-top: 20px;
      h4 { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 10px; }
    }
    .error-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .result-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }

    .template-card { font-size: 0.85rem; }
    .column-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .col-item { display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-surface); border-radius: var(--radius); flex-wrap: wrap; }
    .col-name { color: var(--primary); font-size: 0.78rem; min-width: 160px; }
    .col-desc { color: var(--text-muted); font-size: 0.75rem; flex: 1; }
    .example-row { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px;
      h4 { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
      code { font-family: var(--font-mono); font-size: 0.72rem; color: var(--primary); word-break: break-all; }
    }

    @media (max-width: 1024px) { .upload-layout { grid-template-columns: 1fr; } }
  `],
})
export class CargaMasivaComponent {
  file: File | null = null;
  isDragging = false;
  loading = false;
  result: BulkUploadResult | null = null;

  requiredColumns = [
    { name: 'asunto',          desc: 'Asunto del correo o descripción breve',         required: true },
    { name: 'remitente',       desc: 'Correo del remitente',                           required: false },
    { name: 'cliente',         desc: 'Nombre del cliente',                             required: false },
    { name: 'aseguradora_id',  desc: 'ID de la aseguradora',                           required: false },
    { name: 'fecha_recepcion', desc: 'Fecha/hora de recepción (ISO)',                  required: false },
    { name: 'nro_atenciones',  desc: 'Cantidad de operaciones/atenciones (default: 1)', required: false },
    { name: 'comentarios',     desc: 'Notas adicionales',                              required: false },
  ];

  constructor(private service: SolicitudesService) {}

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }

  onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragging = false;
    const f = e.dataTransfer?.files[0];
    if (f) this.setFile(f);
  }

  onFileSelect(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.setFile(f);
  }

  setFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { alert('Formato no soportado. Use .xlsx, .xls o .csv'); return; }
    this.file = f;
    this.result = null;
  }

  upload() {
    if (!this.file) return;
    this.loading = true;
    this.service.cargaMasiva(this.file).subscribe({
      next: (r) => { this.result = r; this.loading = false; this.file = null; },
      error: (err) => { alert(err.error?.detail || 'Error al procesar'); this.loading = false; },
    });
  }

  clearFile() { this.file = null; this.result = null; }
  reset() { this.file = null; this.result = null; }
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
