import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EquipoEliminado, Pagina } from './models';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);

  /** Constancias de equipos eliminados (solo ADMIN), las más recientes primero. */
  equiposEliminados(q: string, page: number, size: number): Observable<Pagina<EquipoEliminado>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q.trim()) params = params.set('q', q.trim());
    return this.http.get<Pagina<EquipoEliminado>>(`${environment.apiUrl}/auditoria/equipos-eliminados`, { params });
  }
}
