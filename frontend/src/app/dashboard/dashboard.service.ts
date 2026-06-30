import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DashboardResumen, AnsBreakdownItem } from './dashboard.models';
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

  getAnsCumplimiento(): Observable<{ breakdown: AnsBreakdownItem[] }> {
    return this.http.get<{ breakdown: AnsBreakdownItem[] }>(
      `${this.base}/dashboard/ans-cumplimiento`
    ).pipe(catchError(() => of({ breakdown: [] })));
  }
}
