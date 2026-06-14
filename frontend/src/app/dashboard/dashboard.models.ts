// Tipos del endpoint GET /dashboard/resumen

export interface SolicitudRiesgo {
  id: string;
  nro_ticket?: string;
  cliente?: string;
  tipo_solicitud?: string;
  ejecutivo?: string;
  aseguradora?: string;
  ramo?: string;
  probabilidad?: number;
  prediccion?: string;
  estado?: string;
  prioridad?: string;
  fecha_recepcion?: string;
}

export interface SolicitudSinAsignar {
  id: string;
  nro_ticket?: string;
  cliente?: string;
  tipo_solicitud?: string;
  prioridad?: string;
  fecha_recepcion?: string;
}

export interface CargaEjecutivo {
  ejecutivo: string;
  total: number;
  en_riesgo: number;
  carga_pct: number;
}

export interface EstadoCount {
  nombre: string;
  count: number;
}

export interface TendenciaDia {
  fecha: string;
  ingresadas: number;
  fuera_ans: number;
}

export interface DistRiesgo {
  bajo: number;
  medio: number;
  alto: number;
  critico: number;
}

export interface DashboardResumen {
  // KPIs
  total: number;
  fuera_ans: number;
  dentro_ans: number;
  pendientes: number;
  en_proceso: number;
  finalizadas: number;
  sin_asignar: number;
  alto_riesgo: number;
  criticos: number;
  promedio_riesgo: number;
  alertas_no_leidas: number;
  // Distribuciones
  estados: EstadoCount[];
  dist_riesgo: DistRiesgo;
  // Listas operativas
  solicitudes_riesgo: SolicitudRiesgo[];
  sin_asignar_lista: SolicitudSinAsignar[];
  carga_ejecutivos: CargaEjecutivo[];
  tendencia_semanal: TendenciaDia[];
}
