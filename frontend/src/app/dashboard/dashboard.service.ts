import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DashboardData, DateRange } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardMockService {

  getDashboard(range: DateRange = '30d'): Observable<DashboardData> {
    const multiplier = range === '7d' ? 0.25 : range === '90d' ? 3 : 1;
    const base = Math.round(148 * multiplier);

    return of({
      kpis: [
        {
          id: 'total',
          label: 'Total Solicitudes',
          value: base,
          trend: 8.4,
          trendLabel: 'vs periodo anterior',
          color: 'default',
          sparkline: [20, 28, 22, 35, 30, 42, 38],
        },
        {
          id: 'fuera_ans',
          label: 'Fuera de ANS',
          value: Math.round(base * 0.23),
          unit: '',
          trend: -12.1,
          trendLabel: 'vs periodo anterior',
          color: 'danger',
          sparkline: [12, 15, 10, 18, 9, 11, 8],
        },
        {
          id: 'riesgo_prom',
          label: 'Riesgo Promedio',
          value: '38.2',
          unit: '%',
          trend: -3.5,
          trendLabel: 'vs periodo anterior',
          color: 'warning',
          sparkline: [42, 40, 38, 45, 36, 39, 38],
        },
        {
          id: 'pendientes',
          label: 'Pendientes',
          value: Math.round(base * 0.15),
          trend: 2.1,
          trendLabel: 'vs periodo anterior',
          color: 'info',
          sparkline: [8, 10, 7, 12, 9, 11, 10],
        },
      ],
      risk: {
        avgProbability: 0.382,
        fueraAns: Math.round(base * 0.23),
        dentroAns: Math.round(base * 0.77),
        total: base,
        bands: [
          { label: 'Bajo (0-30%)',    count: Math.round(base * 0.45), pct: 45, color: '#22c55e' },
          { label: 'Medio (30-50%)',  count: Math.round(base * 0.30), pct: 30, color: '#f59e0b' },
          { label: 'Alto (50-70%)',   count: Math.round(base * 0.15), pct: 15, color: '#ef4444' },
          { label: 'Critico (70%+)', count: Math.round(base * 0.10), pct: 10, color: '#7c3aed' },
        ],
      },
      status: [
        { label: 'Pendiente',   count: Math.round(base * 0.22), color: '#f59e0b' },
        { label: 'En Proceso',  count: Math.round(base * 0.38), color: '#3b82f6' },
        { label: 'Finalizado',  count: Math.round(base * 0.35), color: '#22c55e' },
        { label: 'Vencido',     count: Math.round(base * 0.05), color: '#ef4444' },
      ],
      criticalRequests: [
        { id: '1', nroTicket: 'NT2026042', cliente: 'Empresa ABC S.A.C.', aseguradora: 'Rimac', probabilidad: 0.91, tipo: 'Inclusion', horasRestantes: 2 },
        { id: '2', nroTicket: 'NT2026038', cliente: 'Corporacion XYZ', aseguradora: 'Pacifico', probabilidad: 0.87, tipo: 'Renovacion', horasRestantes: 5 },
        { id: '3', nroTicket: 'NT2026035', cliente: 'Servicios Globales', aseguradora: 'Mapfre', probabilidad: 0.82, tipo: 'Exclusion', horasRestantes: 8 },
        { id: '4', nroTicket: 'NT2026031', cliente: 'Tech Solutions Peru', aseguradora: 'La Positiva', probabilidad: 0.78, tipo: 'Emision', horasRestantes: 11 },
        { id: '5', nroTicket: 'NT2026028', cliente: 'Grupo Industrial SA', aseguradora: 'Interseguro', probabilidad: 0.74, tipo: 'Inclusion', horasRestantes: 14 },
      ],
      totalCritical: Math.round(base * 0.1),
      executives: [
        { id: '1', nombre: 'Ana Torres',    pendientes: 12, fueraAns: 3, carga: 78 },
        { id: '2', nombre: 'Carlos Rojas',  pendientes: 9,  fueraAns: 1, carga: 61 },
        { id: '3', nombre: 'Maria Lopez',   pendientes: 15, fueraAns: 4, carga: 92 },
        { id: '4', nombre: 'Jose Mendoza',  pendientes: 7,  fueraAns: 2, carga: 45 },
        { id: '5', nombre: 'Rosa Vargas',   pendientes: 11, fueraAns: 2, carga: 70 },
      ],
      alerts: [
        { id: '1', tipo: 'critico',     mensaje: 'NT2026042 vence en 2 horas — riesgo 91%',          tiempo: 'Hace 5 min',  leida: false },
        { id: '2', tipo: 'critico',     mensaje: 'NT2026038 supero umbral critico (87%)',              tiempo: 'Hace 18 min', leida: false },
        { id: '3', tipo: 'advertencia', mensaje: '5 solicitudes superaron 50% de probabilidad hoy',   tiempo: 'Hace 1 h',    leida: false },
        { id: '4', tipo: 'info',        mensaje: 'Modelo RF v2 recargado correctamente',              tiempo: 'Hace 3 h',    leida: true },
        { id: '5', tipo: 'advertencia', mensaje: 'Carga de ejecutivo Maria Lopez supera 90%',         tiempo: 'Hace 4 h',    leida: true },
      ],
      newAlerts: 3,
      weeklyTrend: [
        { label: 'Lun', ingresadas: 24, fueraAns: 6,  riesgoProm: 38 },
        { label: 'Mar', ingresadas: 31, fueraAns: 8,  riesgoProm: 42 },
        { label: 'Mie', ingresadas: 18, fueraAns: 4,  riesgoProm: 33 },
        { label: 'Jue', ingresadas: 27, fueraAns: 7,  riesgoProm: 40 },
        { label: 'Vie', ingresadas: 35, fueraAns: 9,  riesgoProm: 45 },
        { label: 'Sab', ingresadas: 12, fueraAns: 2,  riesgoProm: 28 },
        { label: 'Dom', ingresadas: 8,  fueraAns: 1,  riesgoProm: 22 },
      ],
    });
  }
}
