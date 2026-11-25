import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { LoginResponse, Rol, Sesion, Usuario } from './models';

const CLAVE_SESION = 'almacen.sesion';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(this.leerSesion());

  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly esAdmin = computed(() => this._sesion()?.rol === 'ADMIN');

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap((respuesta) => {
          this.guardarSesion(respuesta);
          this._sesion.set(respuesta);
        }),
      );
  }

  logout(redirigir = true, aviso?: string): void {
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // sin almacenamiento disponible: se ignora
    }
    this._sesion.set(null);
    if (redirigir) {
      this.router.navigateByUrl('/login', { state: aviso ? { aviso } : undefined });
    }
  }

  /** Vuelve a leer nombre y rol desde la API, por si se cambiaron desde la pantalla Usuarios. */
  refrescarPerfil(): void {
    if (!this._sesion()) return;
    this.http.get<Usuario>(`${environment.apiUrl}/cuenta/me`).subscribe({
      next: (u) => this.aplicarPerfil(u.nombre, u.rol, u.foto ?? null),
      error: () => undefined,
    });
  }

  private aplicarPerfil(nombre: string, rol: Rol, foto: string | null): void {
    const actual = this._sesion();
    if (!actual || (actual.nombre === nombre && actual.rol === rol && (actual.foto ?? null) === foto)) return;
    const nueva: Sesion = { ...actual, nombre, rol, foto };
    this.guardarSesion(nueva);
    this._sesion.set(nueva);
  }

  token(): string | null {
    return this._sesion()?.token ?? null;
  }

  private guardarSesion(sesion: Sesion): void {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // sin almacenamiento disponible: la sesión dura solo mientras la pestaña esté abierta
    }
  }

  private leerSesion(): Sesion | null {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo) as Sesion;
      if (this.tokenVencido(sesion.token)) {
        localStorage.removeItem(CLAVE_SESION);
        return null;
      }
      return sesion;
    } catch {
      return null;
    }
  }

  private tokenVencido(token: string): boolean {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const datos = JSON.parse(atob(base64));
      return typeof datos.exp !== 'number' || datos.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}