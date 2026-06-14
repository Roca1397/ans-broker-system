import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DashboardResumen } from './dashboard.models';
import { Alerta } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getResumen(): Observable<DashboardResumen> {
    return this.http.get<DashboardResumen>(`${this.base}/dashboard/resumen`);
  }

  getAlertasRecientes(limit = 5): Observable<Alerta[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<Alerta[]>(`${this.base}/alertas/`, { params });
  }
}
