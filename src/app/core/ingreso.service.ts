import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IngresoLoteRequest, IngresoLoteResponse } from './models';

@Injectable({ providedIn: 'root' })
export class IngresoService {
  private readonly http = inject(HttpClient);

  /** Ingreso de varios equipos al almacén X: se registran todos o ninguno. */
  registrarLote(body: IngresoLoteRequest): Observable<IngresoLoteResponse> {
    return this.http.post<IngresoLoteResponse>(`${environment.apiUrl}/ingresos/lote`, body);
  }
}
