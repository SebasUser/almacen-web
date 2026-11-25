import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AccionTransferencia, Usuario, UsuarioActualizarRequest, UsuarioCrearRequest } from './models';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/usuarios`;
  private readonly cuenta = `${environment.apiUrl}/cuenta`;

  // ---------- solo ADMIN ----------

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.base);
  }

  crear(body: UsuarioCrearRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.base, body);
  }

  actualizar(id: number, body: UsuarioActualizarRequest): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.base}/${id}`, body);
  }

  /** Nombra administrador a otra persona y retira o desactiva al admin actual (confirmado con su contraseña). */
  transferirAdministracion(id: number, accion: AccionTransferencia, passwordActual: string): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/${id}/transferir-administracion`, { accion, passwordActual });
  }

  restablecerPassword(id: number, nuevaPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/password`, { nuevaPassword });
  }

  // ---------- cualquier usuario autenticado ----------

  perfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.cuenta}/me`);
  }

  /** Sube la foto de perfil (data URL ya reducida) o la quita. Devuelve el perfil actualizado. */
  subirFoto(foto: string): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.cuenta}/foto`, { foto });
  }

  quitarFoto(): Observable<Usuario> {
    return this.http.delete<Usuario>(`${this.cuenta}/foto`);
  }

  cambiarPassword(passwordActual: string, passwordNueva: string): Observable<void> {
    return this.http.post<void>(`${this.cuenta}/password`, { passwordActual, passwordNueva });
  }
}
