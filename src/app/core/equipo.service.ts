import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Equipo, EquipoRequest, Pagina } from './models';

export interface FiltrosEquipos {
  q: string;
  marca: string;
  pulgadas: string;
  estado: string;
  condicion: string;
  page: number;
  size: number;
  desde: string;
  hasta: string;
  orden: string;
}

@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/equipos`;

  listar(f: FiltrosEquipos): Observable<Pagina<Equipo>> {
    let params = new HttpParams().set('page', f.page).set('size', f.size);
    // Desempate por id para que la paginación sea estable cuando varios equipos tienen la misma fecha
    const orden =
      f.orden === 'recientes'
        ? ['createdAt,desc', 'id,desc']
        : f.orden === 'antiguos'
          ? ['createdAt,asc', 'id,asc']
          : ['codigoTk,asc', 'id,asc'];
    orden.forEach((o) => (params = params.append('sort', o)));
    if (f.q.trim()) params = params.set('q', f.q.trim());
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.marca) params = params.set('marca', f.marca);
    if (f.pulgadas) params = params.set('pulgadas', f.pulgadas);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.condicion) params = params.set('condicion', f.condicion);
    return this.http.get<Pagina<Equipo>>(this.base, { params });
  }

  marcas(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/marcas`);
  }

  pulgadas(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/pulgadas`);
  }

  /** Búsqueda exacta para el escaneo: por código TK y, si no hay, por número de serie. */
  porCodigo(valor: string): Observable<Equipo> {
    return this.http.get<Equipo>(`${this.base}/codigo`, { params: { valor } });
  }

  obtener(id: number): Observable<Equipo> {
    return this.http.get<Equipo>(`${this.base}/${id}`);
  }

  crear(body: EquipoRequest): Observable<Equipo> {
    return this.http.post<Equipo>(this.base, body);
  }

  actualizar(id: number, body: EquipoRequest): Observable<Equipo> {
    return this.http.put<Equipo>(`${this.base}/${id}`, body);
  }

  /** La API exige un motivo (mínimo 5 caracteres) y guarda una constancia de la eliminación. */
  eliminar(id: number, motivo: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { params: { motivo } });
  }
}