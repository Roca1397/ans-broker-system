// ════════════════════════════════════════════════════════════
//  Modelos del frontend Angular
//  Se preservan los modelos legados y se AGREGAN los nuevos.
//  REEMPLAZA: frontend/src/app/models/models.ts
// ════════════════════════════════════════════════════════════

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: User;
}

// ── Catálogos ──────────────────────────────────────────────
export interface Aseguradora {
  id: number;
  nombre: string;
  codigo: string;
  ans_horas_limite: number;
  contacto?: string | null;
  direccion?: string | null;
  activo?: boolean;
}

export interface TipoOperacion {
  id: number;
  nombre: string;
  codigo: string;
  peso_complejidad: number;
}

export interface CatalogoItem {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Cliente extends CatalogoItem {
  contacto?: string | null;
  direccion?: string | null;
}

export interface ClienteRemitente {
  id: number;
  cliente: string;
  remitente: string;
  cliente_id?: number | null;
  aseguradora_id?: number | null;
  ramo_id?: number | null;
  activo: boolean;
  aseguradora_nombre?: string | null;
  ramo_nombre?: string | null;
}

// ── Solicitudes (legado) ───────────────────────────────────
export interface Solicitud {
  id: string;
  numero_solicitud?: string;
  nro_ticket?: string;
  fecha_ingreso?: string;
  tipo_operacion_id?: number;
  aseguradora_id?: number;
  cantidad_asegurados?: number;
  tiempo_estimado_atencion?: number;
  fecha_esperada_atencion?: string;
  estado: string;
  observaciones?: string;
  fuente: string;
  created_at: string;
}

export interface EjecutivoUser {
  id: string;
  full_name: string;
  email: string;
}

// ── Solicitud lista (SharePoint-like) ──────────────────────
export interface SolicitudListItem {
  id: string;
  nro_ticket?: string;
  cliente?: string;
  tipo_solicitud?: string;
  estado?: string;
  aseguradora?: string;
  prioridad?: string;
  ramo?: string;
  fecha_recepcion?: string;
  fecha_finalizado?: string;
  remitente?: string;
  asunto?: string;
  detalle_correo?: string;
  probabilidad?: number;
  prediccion?: string;
  tiene_adjuntos: boolean;
  fuente?: string;
  ejecutivo?: string;
  created_at: string;
}

export interface AdjuntoMeta {
  filename: string;
  stored_filename?: string;
  path?: string;
  size?: number;
  tipo?: string;
  content_type?: string;
}

export interface SolicitudDetail extends SolicitudListItem {
  cuerpo_correo?: string;
  comentarios?: string;
  datos_adjuntos?: AdjuntoMeta[];
  tipo_solicitud_id?: number | null;
  estado_id?: number | null;
  aseguradora_id?: number | null;
  prioridad_id?: number | null;
  ramo_id?: number | null;
  ejecutivo_id?: string | null;
}

export interface SolicitudUpdate {
  cliente?: string;
  tipo_solicitud_id?: number | null;
  estado_id?: number | null;
  aseguradora_id?: number | null;
  prioridad_id?: number | null;
  ramo_id?: number | null;
  fecha_finalizado?: string | null;
  comentarios?: string;
  asunto?: string;
  cuerpo_correo?: string;
  ejecutivo_id?: string | null;
}

// ── Predicciones ───────────────────────────────────────────
export interface Prediccion {
  cumple_ans: boolean;
  probabilidad_riesgo: number;
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
  mensaje: string;
  recomendacion: string;
  modelo_version: string;
  tiempo_prediccion_ms: number;
}

export interface SolicitudConPrediccion {
  id: string;
  numero_solicitud?: string;
  fecha_ingreso?: string;
  fecha_esperada_atencion?: string;
  cantidad_asegurados?: number;
  tiempo_estimado_atencion?: number;
  estado: string;
  fuente: string;
  tipo_operacion?: string;
  aseguradora?: string;
  ans_horas_limite?: number;
  usuario_nombre?: string;
  cumple_ans?: boolean;
  probabilidad_riesgo?: number;
  nivel_riesgo?: string;
  prediccion_fecha?: string;
}

// ── Dashboard / Alertas ────────────────────────────────────
export interface DashboardStats {
  total_solicitudes: number;
  dentro_ans: number;
  fuera_ans: number;
  criticos: number;
  alto_riesgo: number;
  promedio_riesgo: number;
  pendientes: number;
  alertas_no_leidas: number;
  por_aseguradora: { nombre: string; total: number }[];
  por_tipo_operacion: { nombre: string; total: number }[];
  tendencia_semanal: { fecha: string; total: number; dentro: number; fuera: number }[];
  vencidos?: number;
}

export interface Alerta {
  id: string;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  numero_solicitud?: string;
  solicitud_id: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface BulkUploadResult {
  total: number;
  exitosos: number;
  errores: number;
  detalles_errores: { fila: number; error: string }[];
}
