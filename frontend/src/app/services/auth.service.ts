import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthToken, User } from '../models/models';

/**
 * REEMPLAZA: frontend/src/app/services/auth.service.ts
 * Cambios respecto a v1:
 *   - Agregado método isAdmin()
 *   - Agregado signal computado isAdminSig
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'ans_token';
  private readonly USER_KEY = 'ans_user';

  currentUser = signal<User | null>(this.getStoredUser());

  readonly isAdminSig = computed(() => (this.currentUser()?.role || '') === 'admin');

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<AuthToken>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }

  register(data: { email: string; full_name: string; password: string; role?: string }) {
    return this.http.post<User>(`${environment.apiUrl}/auth/register`, data);
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** Helper utilizable desde templates */
  isAdmin(): boolean {
    return (this.currentUser()?.role || '') === 'admin';
  }

  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
