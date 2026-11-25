import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { AuditoriaService } from '../../core/auditoria.service';
import { ETIQUETA_CONDICION, ETIQUETA_TIPO, textoEstado } from '../../core/etiquetas';
import { fechaHora } from '../../core/formato';
import { CondicionEquipo, EquipoEliminado, Pagina, TipoMovimiento } from '../../core/models';

interface Campo {
  k: string;
  v: string;
}

interface MovimientoEliminado {
  fecha: string;
  tipo: string;
  detalles: string[];
  anulado: string | null;
}

interface DetalleEliminado {
  datos: Campo[];
  compra: Campo[];
  observaciones: string | null;
  historial: MovimientoEliminado[];
  nota: string | null;
}

const VACIO = '—';
const CLAVES_COMPRA = new Set(['Compra', 'Proveedor', 'Factura', 'Guía', 'Garantía']);

/** Convierte el texto guardado al eliminar (líneas «Clave: valor» + historial) en secciones ordenadas. */
export function interpretarDetalle(texto: string): DetalleEliminado {
  const r: DetalleEliminado = { datos: [], compra: [], observaciones: null, historial: [], nota: null };
  let enHistorial = false;

  for (const cruda of texto.split('\n')) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (linea.startsWith('Historial (')) {
      enHistorial = true;
      continue;
    }

    if (enHistorial) {
      if (linea.startsWith('- ')) {
        const partes = linea.slice(2).split(' | ');
        const anulado = partes.find((x) => x.startsWith('ANULADO por')) ?? null;
        const detalles = partes.slice(2).filter((x) => x !== anulado);
        const tipo = partes[1] ?? '';
        r.historial.push({
          fecha: partes[0] ?? '',
          tipo: ETIQUETA_TIPO[tipo as TipoMovimiento] ?? tipo,
          detalles,
          anulado,
        });
      } else {
        r.nota = linea;
      }
      continue;
    }

    const costos = /^Costo sin IGV: US\$ (.*?) \| S\/ (.*?) \| T\.C\. (.*)$/.exec(linea);
    if (costos) {
      r.compra.push(
        { k: 'Costo sin IGV (US$)', v: costos[1] },
        { k: 'Costo sin IGV (S/)', v: costos[2] },
        { k: 'Tipo de cambio', v: costos[3] },
      );
      continue;
    }

    for (const trozo of linea.split(' | ')) {
      const i = trozo.indexOf(': ');
      if (i < 0) continue;
      const clave = trozo.slice(0, i);
      let valor = trozo.slice(i + 2);
      if (clave === 'Código') continue; // ya está en la fila
      if (clave === 'Observaciones') {
        r.observaciones = valor === VACIO ? null : valor;
      } else if (CLAVES_COMPRA.has(clave)) {
        r.compra.push({ k: clave === 'Compra' ? 'Fecha de compra' : clave, v: valor });
      } else {
        if (clave === 'Estado') valor = textoEstado(valor);
        if (clave === 'Condición') valor = ETIQUETA_CONDICION[valor as CondicionEquipo] ?? valor;
        r.datos.push({ k: clave, v: valor });
      }
    }
  }
  return r;
}

@Component({
  selector: 'app-eliminados',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Equipos eliminados</h1>
          <p class="subtitle">
            @if (pagina(); as p) {
              {{ p.totalElements }} equipos eliminados
            } @else {
              Cargando…
            }
          </p>
        </div>
      </div>

      <div class="card filtros">
        <div class="field grow">
          <label for="buscar">Buscar por código</label>
          <input
            id="buscar"
            class="input"
            placeholder="Código del equipo"
            [value]="q()"
            (input)="onBuscar(valorDe($event))"
          />
        </div>
        <button class="btn btn-secondary" (click)="limpiar()" [disabled]="q() === ''">Limpiar</button>
      </div>

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      @if (pagina(); as p) {
        <div class="table-wrap" [class.cargando]="cargando()">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Estado al eliminar</th>
                <th>Movimientos</th>
                <th>Motivo</th>
                <th>Eliminado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (e of p.content; track e.id) {
                <tr>
                  <td class="nowrap">{{ fechaHora(e.fechaEliminacion) }}</td>
                  <td class="code nowrap">{{ e.codigoTk }}</td>
                  <td class="desc" [title]="e.descripcion ?? ''">{{ e.descripcion ?? '—' }}</td>
                  <td>
                    <span [class]="'badge badge-' + e.estado.toLowerCase()">{{ texto(e.estado) }}</span>
                  </td>
                  <td>{{ e.totalMovimientos }}</td>
                  <td class="motivo">{{ e.motivo }}</td>
                  <td>{{ e.eliminadoPor }}</td>
                  <td class="nowrap">
                    <button class="btn btn-secondary btn-sm" (click)="alternar(e.id)">
                      {{ abierto() === e.id ? 'Ocultar' : 'Ver detalle' }}
                    </button>
                  </td>
                </tr>
                @if (abierto() === e.id) {
                  <tr class="detalle">
                    <td colspan="8">
                      @let d = interpretar(e.detalle);
                      <div class="panel">
                        <div class="motivo-caja">
                          <span class="rotulo">Motivo de la eliminación</span>
                          <p>{{ e.motivo }}</p>
                          <small class="muted">
                            Eliminado por <strong>{{ e.eliminadoPor }}</strong> el {{ fechaHora(e.fechaEliminacion) }}
                          </small>
                        </div>

                        <div class="rejilla">
                          <section class="bloque">
                            <h4>Datos del equipo</h4>
                            <dl>
                              @for (c of d.datos; track c.k) {
                                <div>
                                  <dt>{{ c.k }}</dt>
                                  <dd>{{ c.v }}</dd>
                                </div>
                              }
                            </dl>
                          </section>

                          <section class="bloque">
                            <h4>Compra y garantía</h4>
                            @if (conDatos(d.compra).length > 0) {
                              <dl>
                                @for (c of conDatos(d.compra); track c.k) {
                                  <div>
                                    <dt>{{ c.k }}</dt>
                                    <dd>{{ c.v }}</dd>
                                  </div>
                                }
                              </dl>
                            } @else {
                              <p class="muted">Sin datos de compra registrados.</p>
                            }
                            @if (d.observaciones) {
                              <h4 class="sub">Observaciones</h4>
                              <p class="obs">{{ d.observaciones }}</p>
                            }
                          </section>

                          <section class="bloque">
                            <h4>Historial ({{ d.historial.length }})</h4>
                            <ol class="mini">
                              @for (m of d.historial; track $index) {
                                <li [class.anulado]="m.anulado">
                                  <div class="mini-cab">
                                    <strong>{{ m.tipo }}</strong>
                                    <span class="muted">{{ m.fecha }}</span>
                                  </div>
                                  @if (m.detalles.length > 0) {
                                    <div class="muted">{{ m.detalles.join(' · ') }}</div>
                                  }
                                  @if (m.anulado) {
                                    <div class="mini-anulado">{{ m.anulado }}</div>
                                  }
                                </li>
                              } @empty {
                                <li class="muted">Sin movimientos.</li>
                              }
                            </ol>
                            @if (d.nota) {
                              <p class="muted nota">{{ d.nota }}</p>
                            }
                          </section>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="8" class="vacio">No hay equipos eliminados con ese filtro.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pie">
          <span class="muted">Mostrando {{ desde() }}–{{ hasta() }} de {{ p.totalElements }}</span>
          <div class="row">
            <label class="muted" for="tam">Por página</label>
            <select id="tam" class="input tam" (change)="onTamano(valorDe($event))">
              @for (n of tamanos; track n) {
                <option [value]="n" [selected]="n === size()">{{ n }}</option>
              }
            </select>
            <button class="btn btn-secondary btn-sm" [disabled]="p.page === 0" (click)="irA(p.page - 1)">
              Anterior
            </button>
            <span class="muted">Página {{ p.page + 1 }} de {{ p.totalPages || 1 }}</span>
            <button
              class="btn btn-secondary btn-sm"
              [disabled]="p.page + 1 >= p.totalPages"
              (click)="irA(p.page + 1)"
            >
              Siguiente
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .filtros { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px; padding: 16px 20px; }
    .filtros .grow { flex: 1; min-width: 240px; max-width: 420px; }
    .cargando { opacity: 0.55; pointer-events: none; transition: opacity 0.15s; }
    .nowrap { white-space: nowrap; }
    .desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .motivo { max-width: 280px; }
    .vacio { text-align: center; padding: 40px 16px !important; color: var(--text-muted); }
    tr.detalle td { background: #f8f8f8; padding: 18px 20px; }
    .panel { display: grid; gap: 16px; }
    .motivo-caja { background: var(--danger-soft); border: 1px solid #f5c6c2; border-left: 5px solid var(--danger); border-radius: var(--radius); padding: 12px 16px; display: grid; gap: 4px; }
    .motivo-caja p { font-size: 15px; font-weight: 500; color: var(--text); }
    .rotulo { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--danger); }
    .rejilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; align-items: start; }
    .bloque { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .bloque h4 { margin: 0 0 12px; font-size: 13.5px; font-weight: 600; }
    .bloque h4.sub { margin-top: 16px; }
    dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px 16px; }
    dt { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    dd { margin: 0; font-weight: 500; font-size: 13.5px; word-break: break-word; }
    .obs { margin: 0; font-size: 13.5px; }
    .mini { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .mini li { border-left: 3px solid var(--border); padding-left: 10px; display: grid; gap: 2px; font-size: 13px; }
    .mini-cab { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .mini li.anulado strong { text-decoration: line-through; color: var(--text-muted); }
    .mini-anulado { color: var(--danger); font-size: 12px; }
    .nota { margin-top: 10px; font-size: 12px; }
    .pie { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .input.tam { width: 76px; height: 30px; }
    .alert { margin-bottom: 16px; }
  `,
})
export class Eliminados {
  private readonly svc = inject(AuditoriaService);

  protected readonly tamanos = [10, 20, 50];

  protected readonly pagina = signal<Pagina<EquipoEliminado> | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly abierto = signal<number | null>(null);

  protected readonly q = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(20);

  protected readonly desde = computed(() => {
    const p = this.pagina();
    return !p || p.totalElements === 0 ? 0 : p.page * p.size + 1;
  });

  protected readonly hasta = computed(() => {
    const p = this.pagina();
    return p ? Math.min((p.page + 1) * p.size, p.totalElements) : 0;
  });

  protected readonly fechaHora = fechaHora;
  protected readonly texto = textoEstado;
  protected readonly interpretar = interpretarDetalle;

  /** Oculta los datos vacíos («—») para que la ficha no se llene de guiones. */
  protected conDatos(campos: Campo[]): Campo[] {
    return campos.filter((c) => c.v !== VACIO);
  }

  private readonly recarga$ = new Subject<void>();
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    // switchMap cancela la consulta anterior si llega una nueva
    this.recarga$
      .pipe(
        tap(() => {
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.svc.equiposEliminados(this.q(), this.page(), this.size()).pipe(
            catchError(() => {
              this.error.set('No se pudo cargar la lista de equipos eliminados');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        if (p) this.pagina.set(p);
        this.cargando.set(false);
      });

    this.recarga$.next();
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected alternar(id: number): void {
    this.abierto.set(this.abierto() === id ? null : id);
  }

  protected onBuscar(valor: string): void {
    this.q.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.page.set(0);
      this.abierto.set(null);
      this.recarga$.next();
    }, 350);
  }

  protected onTamano(valor: string): void {
    this.size.set(Number(valor));
    this.page.set(0);
    this.abierto.set(null);
    this.recarga$.next();
  }

  protected irA(pagina: number): void {
    this.page.set(pagina);
    this.abierto.set(null);
    this.recarga$.next();
  }

  protected limpiar(): void {
    clearTimeout(this.temporizador);
    this.q.set('');
    this.page.set(0);
    this.abierto.set(null);
    this.recarga$.next();
  }
}
