import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, map } from 'rxjs/operators';
import { of, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthToken, User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'ans_token';
  private readonly USER_KEY = 'ans_user';

  currentUser = signal<User | null>(this.getStoredUser());

  readonly isAdminSig = computed(() => (this.currentUser()?.role || '') === 'administrador');

  // Resolves once the startup user-refresh is done (or immediately if not logged in).
  // Guards await this so they always evaluate against the current DB role.
  readonly isReady$: Promise<void>;

  constructor(private http: HttpClient, private router: Router) {
    if (this.isLoggedIn()) {
      this.isReady$ = firstValueFrom(
        this.refreshCurrentUser().pipe(catchError(() => of(null)), map(() => void 0))
      );
    } else {
      this.isReady$ = Promise.resolve();
    }
  }

  refreshCurrentUser() {
    return this.http.get<User>(`${environment.apiUrl}/users/me`).pipe(
      tap(user => {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      })
    );
  }

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
    return (this.currentUser()?.role || '') === 'administrador';
  }

  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
}
