import { Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { CLASE_TIPO, ETIQUETA_TIPO, rotuloOrigenDestino } from '../../core/etiquetas';
import { fechaHora } from '../../core/formato';
import { Movimiento, Pagina, TipoMovimiento, UsuarioResumen } from '../../core/models';
import { MovimientoService } from '../../core/movimiento.service';

@Component({
  selector: 'app-movimientos',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Movimientos</h1>
          <p class="subtitle">
            @if (pagina(); as p) {
              {{ p.totalElements }} movimientos registrados
            } @else {
              Cargando…
            }
          </p>
        </div>
      </div>

      <div class="card filtros">
        <div class="field grow">
          <label for="buscar">Buscar</label>
          <input
            id="buscar"
            class="input"
            placeholder="Código o serie del equipo, cliente/persona, OC, RQ, guía o factura"
            [value]="q()"
            (input)="onBuscar(valorDe($event))"
          />
        </div>

        <div class="field">
          <label for="tipo">Tipo de movimiento</label>
          <select id="tipo" class="input" (change)="onFiltro(tipo, valorDe($event))">
            <option value="" [selected]="tipo() === ''">Todos</option>
            @for (t of tipos; track t) {
              <option [value]="t" [selected]="t === tipo()">{{ etiqueta(t) }}</option>
            }
          </select>
        </div>

        <div class="field fecha">
          <label for="desde">Desde</label>
          <input
            id="desde"
            type="date"
            class="input"
            [value]="fechaDesde()"
            [attr.max]="fechaHasta() || null"
            (change)="onFiltro(fechaDesde, valorDe($event))"
          />
        </div>

        <div class="field fecha">
          <label for="hasta">Hasta</label>
          <input
            id="hasta"
            type="date"
            class="input"
            [value]="fechaHasta()"
            [attr.min]="fechaDesde() || null"
            (change)="onFiltro(fechaHasta, valorDe($event))"
          />
        </div>

        <div class="field">
          <label for="usuario">Registrado por</label>
          <select id="usuario" class="input" (change)="onFiltro(usuarioId, valorDe($event))">
            <option value="" [selected]="usuarioId() === ''">Todos</option>
            @for (u of usuarios(); track u.id) {
              <option [value]="u.id" [selected]="'' + u.id === usuarioId()">{{ u.nombre }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="anulado">Anulaciones</label>
          <select id="anulado" class="input" (change)="onFiltro(anulado, valorDe($event))">
            <option value="" [selected]="anulado() === ''">Todos</option>
            <option value="vigentes" [selected]="anulado() === 'vigentes'">Solo vigentes</option>
            <option value="anulados" [selected]="anulado() === 'anulados'">Solo anulados</option>
          </select>
        </div>

        <button class="btn btn-secondary limpiar" (click)="limpiar()" [disabled]="!hayFiltros()">Limpiar</button>
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
                <th>Tipo</th>
                <th>Equipo</th>
                <th>Origen / Destino</th>
                <th>Documentos</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              @for (m of p.content; track m.id) {
                <tr [class.anulado]="m.anulado">
                  <td class="nowrap">{{ fechaHora(m.fecha) }}</td>
                  <td>
                    <span [class]="'badge badge-' + clase(m.tipo)">{{ etiqueta(m.tipo) }}</span>
                    @if (m.anulado) {
                      <span
                        class="badge badge-baja etiqueta-anulado"
                        [title]="'Anulado por ' + (m.anuladoPor ?? '—') + ': ' + (m.motivoAnulacion ?? '')"
                        >Anulado</span
                      >
                    }
                  </td>
                  <td class="code nowrap"><a [routerLink]="['/inventario', m.equipoId]">{{ m.codigoTk }}</a></td>
                  <td>
                    @if (m.origenDestino) {
                      <div class="od">
                        <small class="muted">{{ rotulo(m.tipo) }}</small>
                        <span>{{ m.origenDestino }}</span>
                      </div>
                    } @else {
                      —
                    }
                  </td>
                  <td>
                    @if (m.oc || m.rq || m.guia || m.factura) {
                      <div class="docs">
                        @if (m.oc) { <span class="chip">OC: {{ m.oc }}</span> }
                        @if (m.rq) { <span class="chip">RQ: {{ m.rq }}</span> }
                        @if (m.guia) { <span class="chip">Guía: {{ m.guia }}</span> }
                        @if (m.factura) { <span class="chip">Factura: {{ m.factura }}</span> }
                      </div>
                    } @else {
                      —
                    }
                  </td>
                  <td>{{ m.usuario ?? 'Carga inicial' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="vacio">No hay movimientos con ese filtro.</td>
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
    .filtros .grow { flex: 1; min-width: 260px; }
    .filtros .field:not(.grow) { width: 160px; }
    .filtros .field.fecha { width: 160px; }
    .filtros .limpiar { margin-left: auto; }
    .cargando { opacity: 0.55; pointer-events: none; transition: opacity 0.15s; }
    .nowrap { white-space: nowrap; }
    .od { display: grid; line-height: 1.3; }
    .od small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    tr.anulado td { color: var(--text-muted); }
    tr.anulado .code a { text-decoration: line-through; }
    .etiqueta-anulado { margin-left: 6px; }
    .code a { color: var(--primary); }
    .code a:hover { text-decoration: underline; }
    .vacio { text-align: center; padding: 40px 16px !important; color: var(--text-muted); }
    .docs { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 10px; font-size: 12px; white-space: nowrap; }
    .pie { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .input.tam { width: 76px; height: 30px; }
    .alert { margin-bottom: 16px; }
  `,
})
export class Movimientos {
  private readonly svc = inject(MovimientoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tamanos = [10, 20, 50];
  protected readonly tipos: TipoMovimiento[] = [
    'ENTRADA',
    'SALIDA_ALQUILER',
    'SALIDA_VENTA',
    'ASIGNACION_PERSONAL',
    'DEVOLUCION_CLIENTE',
    'RETORNO_PERSONAL',
  ];

  protected readonly pagina = signal<Pagina<Movimiento> | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly usuarios = signal<UsuarioResumen[]>([]);

  protected readonly q = signal('');
  protected readonly tipo = signal('');
  protected readonly usuarioId = signal('');
  protected readonly anulado = signal('');
  protected readonly fechaDesde = signal('');
  protected readonly fechaHasta = signal('');
  protected readonly page = signal(0);
  protected readonly size = signal(20);

  protected readonly hayFiltros = computed(
    () =>
      !!(
        this.q() ||
        this.tipo() ||
        this.usuarioId() ||
        this.anulado() ||
        this.fechaDesde() ||
        this.fechaHasta()
      ),
  );

  protected readonly desde = computed(() => {
    const p = this.pagina();
    return !p || p.totalElements === 0 ? 0 : p.page * p.size + 1;
  });

  protected readonly hasta = computed(() => {
    const p = this.pagina();
    return p ? Math.min((p.page + 1) * p.size, p.totalElements) : 0;
  });

  protected readonly fechaHora = fechaHora;
  protected readonly etiqueta = (t: TipoMovimiento) => ETIQUETA_TIPO[t];
  protected readonly clase = (t: TipoMovimiento) => CLASE_TIPO[t];
  protected readonly rotulo = rotuloOrigenDestino;

  private readonly recarga$ = new Subject<void>();
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));

    // switchMap cancela la consulta anterior si llega una nueva
    this.recarga$
      .pipe(
        tap(() => {
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.svc
            .listar({
              q: this.q(),
              tipo: this.tipo(),
              usuarioId: this.usuarioId(),
              anulado: this.anulado(),
              desde: this.fechaDesde(),
              hasta: this.fechaHasta(),
              page: this.page(),
              size: this.size(),
            })
            .pipe(
            catchError(() => {
              this.error.set('No se pudieron cargar los movimientos');
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

    this.svc.usuarios().subscribe({ next: (u) => this.usuarios.set(u), error: () => undefined });
    this.recarga$.next();
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected onBuscar(valor: string): void {
    this.q.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.page.set(0);
      this.recarga$.next();
    }, 350);
  }

  protected onFiltro(campo: WritableSignal<string>, valor: string): void {
    campo.set(valor);
    this.page.set(0);
    this.recarga$.next();
  }

  protected onTamano(valor: string): void {
    this.size.set(Number(valor));
    this.page.set(0);
    this.recarga$.next();
  }

  protected irA(pagina: number): void {
    this.page.set(pagina);
    this.recarga$.next();
  }

  protected limpiar(): void {
    clearTimeout(this.temporizador);
    this.q.set('');
    this.tipo.set('');
    this.usuarioId.set('');
    this.anulado.set('');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.page.set(0);
    this.recarga$.next();
  }
}
