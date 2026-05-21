import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  Solicitud, SolicitudConPrediccion, Prediccion, DashboardStats,
  Alerta, Aseguradora, TipoOperacion, PaginatedResponse, BulkUploadResult,
  SolicitudListItem, SolicitudDetail, SolicitudUpdate,
  CatalogoItem, Cliente, ClienteRemitente, EjecutivoUser, User,
} from '../models/models';

// ════════════════════════════════════════════════════════════
// REEMPLAZA: frontend/src/app/services/api.service.ts
// Cambios:
//   - SolicitudesService extendido con métodos SharePoint-like
//   - CatalogosService extendido con tipos-solicitud, estados, prioridades, ramos, clientes
//   - Nuevo AdminService con CRUD de catálogos, clientes y asociaciones
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private base = `${environment.apiUrl}/solicitudes`;

  constructor(private http: HttpClient) {}

  // ── Legado ──────────────────────────────────────────────
  listar(params: any = {}) {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null) p = p.set(k, params[k]); });
    return this.http.get<PaginatedResponse<Solicitud>>(`${this.base}/`, { params: p });
  }

  crear(data: any) {
    return this.http.post<Solicitud>(`${this.base}/`, data);
  }

  obtener(id: string) {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  cargaMasiva(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<BulkUploadResult>(`${this.base}/bulk-upload`, fd);
  }

  // ── NUEVOS métodos SharePoint-like ──────────────────────
  listarSharepoint(params: any = {}) {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null && params[k] !== '') p = p.set(k, params[k]); });
    return this.http.get<PaginatedResponse<SolicitudListItem>>(`${this.base}/lista`, { params: p });
  }

  detalle(id: string) {
    return this.http.get<SolicitudDetail>(`${this.base}/${id}/detalle`);
  }

  actualizar(id: string, data: SolicitudUpdate) {
    return this.http.patch<SolicitudDetail>(`${this.base}/${id}`, data);
  }

  agregarComentario(id: string, comentario: string) {
    return this.http.post<{ ok: boolean; comentarios: string }>(
      `${this.base}/${id}/comentario`, { comentarios: comentario }
    );
  }

  eliminar(id: string) {
    return this.http.delete(`${this.base}/${id}`);
  }

  crearManual(data: any) {
    return this.http.post<{ id: string; nro_ticket: string; prediccion: string; probabilidad: number }>(
      `${this.base}/manual`, data
    );
  }

  urlAdjunto(id: string) {
    return `${this.base}/${id}/adjunto`;
  }

  urlAdjuntoPorNombre(id: string, nombre: string) {
    return `${this.base}/${id}/adjuntos/${encodeURIComponent(nombre)}`;
  }

  descargarAdjunto(id: string) {
    return this.http.get(this.urlAdjunto(id), { responseType: 'blob' });
  }

  descargarAdjuntoPorNombre(id: string, nombre: string) {
    return this.http.get(this.urlAdjuntoPorNombre(id, nombre), { responseType: 'blob' });
  }

  subirAdjuntos(id: string, files: File[]) {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f, f.name));
    return this.http.post<{ ok: boolean; datos_adjuntos: any[] }>(
      `${this.base}/${id}/adjuntos`, fd
    );
  }

  eliminarAdjunto(id: string, nombre: string) {
    return this.http.delete<{ ok: boolean; datos_adjuntos: any[] | null }>(
      `${this.base}/${id}/adjuntos/${encodeURIComponent(nombre)}`
    );
  }

  getEjecutivos() {
    return this.http.get<EjecutivoUser[]>(`${environment.apiUrl}/users/ejecutivos`);
  }
}

// ════════════════════════════════════════════════════════════
// PREDICCIONES (legado)
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class PrediccionesService {
  private base = `${environment.apiUrl}/predicciones`;

  constructor(private http: HttpClient) {}

  predecir(data: any) {
    return this.http.post<Prediccion>(`${this.base}/predict`, data);
  }

  resultados(params: any = {}) {
    let p = new HttpParams();
    Object.keys(params).forEach(k => { if (params[k] != null) p = p.set(k, params[k]); });
    return this.http.get<SolicitudConPrediccion[]>(`${this.base}/resultados`, { params: p });
  }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getStats() {
    return this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats`);
  }
}

// ════════════════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private base = `${environment.apiUrl}/alertas`;

  constructor(private http: HttpClient) {}

  listar(soloNoLeidas = false) {
    return this.http.get<Alerta[]>(`${this.base}/`, { params: { solo_no_leidas: soloNoLeidas } });
  }

  marcarLeida(id: string) {
    return this.http.patch(`${this.base}/${id}/marcar-leida`, {});
  }

  marcarTodasLeidas() {
    return this.http.patch(`${this.base}/marcar-todas-leidas`, {});
  }
}

// ════════════════════════════════════════════════════════════
// CATÁLOGOS
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private base = `${environment.apiUrl}/catalogos`;

  constructor(private http: HttpClient) {}

  getAseguradoras() {
    return this.http.get<Aseguradora[]>(`${this.base}/aseguradoras`);
  }

  getTiposOperacion() {
    return this.http.get<TipoOperacion[]>(`${this.base}/tipos-operacion`);
  }

  getTiposSolicitud() {
    return this.http.get<CatalogoItem[]>(`${this.base}/tipos-solicitud`);
  }

  getEstadosSolicitud() {
    return this.http.get<CatalogoItem[]>(`${this.base}/estados-solicitud`);
  }

  getPrioridades() {
    return this.http.get<CatalogoItem[]>(`${this.base}/prioridades`);
  }

  getRamos() {
    return this.http.get<CatalogoItem[]>(`${this.base}/ramos`);
  }

  getClientes() {
    return this.http.get<Cliente[]>(`${this.base}/clientes`);
  }
}

// ════════════════════════════════════════════════════════════
// ADMIN (sólo admin)
// ════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class AdminService {
  private base = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // Catálogo genérico (tipos-solicitud, estados-solicitud, prioridades, ramos)
  list(catalog: 'tipos-solicitud'|'estados-solicitud'|'prioridades'|'ramos') {
    return this.http.get<CatalogoItem[]>(`${this.base}/${catalog}`);
  }
  createCat(catalog: string, body: { nombre: string; activo?: boolean }) {
    return this.http.post<CatalogoItem>(`${this.base}/${catalog}`, body);
  }
  updateCat(catalog: string, id: number, body: any) {
    return this.http.patch<CatalogoItem>(`${this.base}/${catalog}/${id}`, body);
  }
  deleteCat(catalog: string, id: number) {
    return this.http.delete(`${this.base}/${catalog}/${id}`);
  }

  // Aseguradoras
  listAseguradoras() {
    return this.http.get<Aseguradora[]>(`${this.base}/aseguradoras`);
  }
  createAseguradora(body: any) {
    return this.http.post<Aseguradora>(`${this.base}/aseguradoras`, body);
  }
  updateAseguradora(id: number, body: any) {
    return this.http.patch<Aseguradora>(`${this.base}/aseguradoras/${id}`, body);
  }
  deleteAseguradora(id: number) {
    return this.http.delete(`${this.base}/aseguradoras/${id}`);
  }

  // Clientes
  listClientes() {
    return this.http.get<Cliente[]>(`${this.base}/clientes`);
  }
  createCliente(body: { nombre: string; contacto?: string | null; direccion?: string | null; activo?: boolean }) {
    return this.http.post<Cliente>(`${this.base}/clientes`, body);
  }
  updateCliente(id: number, body: any) {
    return this.http.patch<Cliente>(`${this.base}/clientes/${id}`, body);
  }
  deleteCliente(id: number) {
    return this.http.delete(`${this.base}/clientes/${id}`);
  }

  // Asociaciones cliente <-> remitente
  listAsociaciones() {
    return this.http.get<ClienteRemitente[]>(`${this.base}/clientes-remitentes`);
  }
  createAsociacion(body: any) {
    return this.http.post<ClienteRemitente>(`${this.base}/clientes-remitentes`, body);
  }
  updateAsociacion(id: number, body: any) {
    return this.http.patch<ClienteRemitente>(`${this.base}/clientes-remitentes/${id}`, body);
  }
  deleteAsociacion(id: number) {
    return this.http.delete(`${this.base}/clientes-remitentes/${id}`);
  }

  // Usuarios
  listUsuarios() {
    return this.http.get<User[]>(`${this.base}/usuarios`);
  }
  createUsuario(body: { email: string; full_name: string; password: string; role: string; is_active?: boolean }) {
    return this.http.post<User>(`${this.base}/usuarios`, body);
  }
  updateUsuario(id: string, body: { full_name?: string; role?: string; is_active?: boolean; password?: string }) {
    return this.http.patch<User>(`${this.base}/usuarios/${id}`, body);
  }
  deleteUsuario(id: string) {
    return this.http.delete(`${this.base}/usuarios/${id}`);
  }
}
