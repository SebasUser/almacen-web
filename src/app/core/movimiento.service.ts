import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Movimiento, MovimientoLoteRequest, MovimientoRequest, Pagina, UsuarioResumen } from './models';

export interface FiltrosMovimientos {
  q: string;
  tipo: string;
  usuarioId: string;
  /** '' = todos, 'vigentes' o 'anulados' */
  anulado: string;
  desde: string;
  hasta: string;
  page: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private readonly http = inject(HttpClient);

  historial(equipoId: number): Observable<Movimiento[]> {
    return this.http.get<Movimiento[]>(`${environment.apiUrl}/equipos/${equipoId}/movimientos`);
  }

  registrar(equipoId: number, body: MovimientoRequest): Observable<Movimiento> {
    return this.http.post<Movimiento>(`${environment.apiUrl}/equipos/${equipoId}/movimientos`, body);
  }

  /** Lista global de movimientos (más recientes primero) con filtros opcionales. */
  listar(f: FiltrosMovimientos): Observable<Pagina<Movimiento>> {
    let params = new HttpParams().set('page', f.page).set('size', f.size);
    if (f.q.trim()) params = params.set('q', f.q.trim());
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.usuarioId) params = params.set('usuarioId', f.usuarioId);
    if (f.anulado === 'vigentes') params = params.set('anulado', false);
    if (f.anulado === 'anulados') params = params.set('anulado', true);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    return this.http.get<Pagina<Movimiento>>(`${environment.apiUrl}/movimientos`, { params });
  }

  /** Usuarios que han registrado movimientos (para el filtro "Registrado por"). */
  usuarios(): Observable<UsuarioResumen[]> {
    return this.http.get<UsuarioResumen[]>(`${environment.apiUrl}/movimientos/usuarios`);
  }

  /** El mismo movimiento para varios equipos: se registran todos o ninguno. */
  registrarLote(body: MovimientoLoteRequest): Observable<Movimiento[]> {
    return this.http.post<Movimiento[]>(`${environment.apiUrl}/movimientos/lote`, body);
  }

  /** Anula un movimiento equivocado (solo ADMIN). Queda en el historial marcado como anulado. */
  anular(id: number, motivo: string): Observable<Movimiento> {
    return this.http.post<Movimiento>(`${environment.apiUrl}/movimientos/${id}/anular`, { motivo });
  }
}
