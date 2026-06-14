export interface TrendPoint {
  label: string;
  ingresadas: number;
  fueraAns: number;
  riesgoProm: number;
}

export interface Kpi {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  sparkline?: number[];
}

export interface RiskBand {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface RiskSummary {
  avgProbability: number;
  fueraAns: number;
  dentroAns: number;
  total: number;
  bands: RiskBand[];
}

export interface StatusItem {
  label: string;
  count: number;
  color: string;
}

export interface CriticalRequest {
  id: string;
  nroTicket: string;
  cliente: string;
  aseguradora: string;
  probabilidad: number;
  tipo: string;
  horasRestantes: number;
}

export interface Executive {
  id: string;
  nombre: string;
  pendientes: number;
  fueraAns: number;
  carga: number;
}

export interface AlertItem {
  id: string;
  tipo: 'critico' | 'advertencia' | 'info';
  mensaje: string;
  tiempo: string;
  leida: boolean;
}

export interface DashboardData {
  kpis: Kpi[];
  risk: RiskSummary;
  status: StatusItem[];
  criticalRequests: CriticalRequest[];
  totalCritical: number;
  executives: Executive[];
  alerts: AlertItem[];
  newAlerts: number;
  weeklyTrend: TrendPoint[];
}

export type DateRange = '7d' | '30d' | '90d';
