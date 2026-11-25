import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/errores';
import { EquipoService } from '../../core/equipo.service';
import { fechaDe, horaDe } from '../../core/formato';
import { CONDICIONES, ETIQUETA_CONDICION, clasePorCondicion, textoEstado } from '../../core/etiquetas';
import { Equipo, Pagina } from '../../core/models';

@Component({
  selector: 'app-inventario',
  imports: [RouterLink],
  host: { '(document:keydown.escape)': 'alEscape()' },
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Inventario</h1>
          <p class="subtitle">
            @if (pagina(); as p) {
              {{ p.totalElements }} equipos encontrados
            } @else {
              Cargando…
            }
          </p>
        </div>
        <a class="btn" routerLink="/inventario/nuevo">+ Nuevo equipo</a>
      </div>

      @if (aviso()) {
        <div class="alert alert-ok aviso" role="status">{{ aviso() }}</div>
      }

      <div class="card filtros">
        <div class="field grow">
          <label for="buscar">Buscar</label>
          <input
            id="buscar"
            class="input"
            placeholder="Código, serie o descripción"
            [value]="q()"
            (input)="onBuscar(valorDe($event))"
          />
        </div>

        <div class="field">
          <label for="marca">Marca</label>
          <select id="marca" class="input" (change)="onFiltro(marca, valorDe($event))">
            <option value="" [selected]="marca() === ''">Todas</option>
            @for (m of marcas(); track m) {
              <option [value]="m" [selected]="m === marca()">{{ m }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="pulgadas">Pulgadas</label>
          <select id="pulgadas" class="input" (change)="onFiltro(pulg, valorDe($event))">
            <option value="" [selected]="pulg() === ''">Todas</option>
            @for (n of pulgadas(); track n) {
              <option [value]="n" [selected]="n === pulg()">{{ n }}"</option>
            }
          </select>
        </div>

        <div class="field">
          <label for="estado">Situación</label>
          <select id="estado" class="input" (change)="onFiltro(estado, valorDe($event))">
            <option value="" [selected]="estado() === ''">Todas</option>
            <option value="DISPONIBLE" [selected]="estado() === 'DISPONIBLE'">En almacén</option>
            <option value="ALQUILADO" [selected]="estado() === 'ALQUILADO'">Alquilado</option>
            <option value="ASIGNADO" [selected]="estado() === 'ASIGNADO'">Asignado</option>
            <option value="VENDIDO" [selected]="estado() === 'VENDIDO'">Vendido</option>
            <option value="BAJA" [selected]="estado() === 'BAJA'">De baja</option>
          </select>
        </div>

        <div class="field">
          <label for="condicion">Condición</label>
          <select id="condicion" class="input" (change)="onFiltro(condicion, valorDe($event))">
            <option value="" [selected]="condicion() === ''">Todas</option>
            @for (c of condiciones; track c) {
              <option [value]="c" [selected]="c === condicion()">{{ etiquetaCondicion[c] }}</option>
            }
          </select>
        </div>

        <div class="field fecha">
          <label for="desde">Registrado desde</label>
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
          <label for="hasta">Registrado hasta</label>
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
          <label for="orden">Ordenar por</label>
          <select id="orden" class="input" (change)="onFiltro(orden, valorDe($event))">
            <option value="recientes" [selected]="orden() === 'recientes'">Más recientes</option>
            <option value="antiguos" [selected]="orden() === 'antiguos'">Más antiguos</option>
            <option value="codigo" [selected]="orden() === 'codigo'">Código</option>
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
                <th>Código</th>
                <th class="col-marca">Marca</th>
                <th class="c">Pulg.</th>
                <th>Descripción</th>
                <th class="col-serie">Serie</th>
                <th>Situación</th>
                <th>Condición</th>
                @if (auth.esAdmin()) {
                  <th>Acciones</th>
                }
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              @for (e of p.content; track e.id) {
                <tr class="clickable" (click)="abrir(e)">
                  <td class="code"><a [routerLink]="['/inventario', e.id]">{{ e.codigoTk }}</a></td>
                  <td class="col-marca">{{ e.marca ?? '—' }}</td>
                  <td class="c">{{ pulgadasDe(e) }}</td>
                  <td class="desc" [title]="e.descripcion ?? ''">{{ e.descripcion ?? '—' }}</td>
                  <td class="col-serie">{{ e.numeroSerie ?? '—' }}</td>
                  <td>
                    <div class="sit">
                      <span [class]="'badge badge-' + e.estado.toLowerCase()">{{ texto(e.estado) }}</span>
                      @if (detalleUbicacion(e); as d) {
                        <small class="muted" [title]="d">{{ d }}</small>
                      }
                    </div>
                  </td>
                  <td class="cond">
                    <span
                      [class]="'badge ' + claseCondicion(e.condicion)"
                      [title]="e.observaciones ? 'Observaciones: ' + e.observaciones : ''"
                      >{{ etiquetaCondicion[e.condicion] }}</span
                    >
                  </td>
                  @if (auth.esAdmin()) {
                    <td (click)="$event.stopPropagation()">
                      <div class="celda-acciones">
                        <a class="btn btn-secondary btn-sm" [routerLink]="['/inventario', e.id, 'editar']">Editar</a>
                        <button class="btn btn-ghost btn-sm borrar" (click)="pedirEliminar(e)">Eliminar</button>
                      </div>
                    </td>
                  }
                  <td class="reg">
                    <div>{{ fechaDe(e.createdAt) }}</div>
                    <small class="muted">{{ horaDe(e.createdAt) }}</small>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="auth.esAdmin() ? 9 : 8" class="vacio">
                    No se encontraron equipos con esos filtros.
                  </td>
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

    @if (aEliminar(); as eq) {
      <div class="overlay" (click)="cancelarEliminar()">
        <div class="modal card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h2>Eliminar equipo</h2>
          <p>¿Seguro que quieres eliminar <strong>{{ eq.codigoTk }}</strong>?</p>
          <p class="muted">
            Se borrará el equipo y su historial de movimientos, pero quedará una constancia (con el motivo,
            tu usuario y la fecha) que solo ve el administrador. Esta acción no se puede deshacer.
          </p>
          <div class="field">
            <label for="motivo-eliminar">Motivo de la eliminación *</label>
            <textarea
              id="motivo-eliminar"
              class="input"
              [value]="motivoEliminar()"
              (input)="motivoEliminar.set(valorDe($event))"
              placeholder="ej. Registrado por error / equipo duplicado"
            ></textarea>
          </div>
          @if (errorEliminar()) {
            <div class="alert alert-error">{{ errorEliminar() }}</div>
          }
          <div class="row acciones">
            <button class="btn btn-secondary" (click)="cancelarEliminar()" [disabled]="eliminando()">Cancelar</button>
            <button class="btn btn-danger" (click)="confirmarEliminar()" [disabled]="eliminando()">
              {{ eliminando() ? 'Eliminando…' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .filtros { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px; padding: 16px 20px; }
    .filtros .grow { flex: 1; min-width: 240px; }
    .filtros .field:not(.grow) { width: 150px; }
    .filtros .field.fecha { width: 168px; }
    .filtros .limpiar { margin-left: auto; }
    .cargando { opacity: 0.55; pointer-events: none; transition: opacity 0.15s; }
    /* La descripción absorbe el espacio sobrante y se recorta con «…»; el resto no se parte, así nunca hace falta desplazarse */
    .table { font-size: 13px; table-layout: auto; }
    .table th { font-size: 11.5px; padding: 10px 12px; }
    .table td { padding: 10px 12px; white-space: nowrap; }
    .table .c { text-align: center; width: 1%; padding-left: 8px; padding-right: 8px; }
    .reg { line-height: 1.3; }
    .reg small { display: block; }
    .desc { width: 100%; max-width: 0; min-width: 120px; overflow: hidden; text-overflow: ellipsis; }
    .sit { display: grid; gap: 2px; justify-items: start; }
    .sit small { max-width: 150px; overflow: hidden; text-overflow: ellipsis; font-size: 11.5px; }
    /* En pantallas más angostas se ocultan columnas secundarias (siguen en la ficha y se pueden buscar) */
    @media (max-width: 1500px) { .col-serie { display: none; } }
    @media (max-width: 1250px) { .col-marca { display: none; } }
    .code a { color: var(--primary); }
    .code a:hover { text-decoration: underline; }
    .vacio { text-align: center; padding: 40px 16px !important; color: var(--text-muted); }
    .pie { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; }
    .input.tam { width: 76px; height: 30px; }
    .alert { margin-bottom: 16px; }
    .aviso { margin-bottom: 16px; }

    a.btn { text-decoration: none; }
    a.btn:hover { text-decoration: none; }
    .celda-acciones { display: inline-flex; gap: 4px; white-space: nowrap; }
    .borrar { color: var(--danger); }
    .borrar:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }

    .overlay { position: fixed; inset: 0; background: rgba(25, 25, 25, 0.55); display: grid; place-items: center; padding: 16px; z-index: 50; }
    .modal { width: 100%; max-width: 440px; display: grid; gap: 12px; box-shadow: var(--shadow-lg); }
    .acciones { justify-content: flex-end; margin-top: 8px; }
  `,
})
export class Inventario {
  private readonly svc = inject(EquipoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly tamanos = [10, 20, 50];

  protected readonly pagina = signal<Pagina<Equipo> | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly marcas = signal<string[]>([]);
  protected readonly pulgadas = signal<string[]>([]);

  protected readonly q = signal('');
  protected readonly marca = signal('');
  protected readonly pulg = signal('');
  protected readonly estado = signal('');
  protected readonly condicion = signal('');
  protected readonly condiciones = CONDICIONES;
  protected readonly etiquetaCondicion = ETIQUETA_CONDICION;
  protected readonly claseCondicion = clasePorCondicion;
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly fechaDesde = signal('');
  protected readonly fechaHasta = signal('');
  protected readonly orden = signal('recientes');
  protected readonly fechaDe = fechaDe;
  protected readonly horaDe = horaDe;

  protected readonly aEliminar = signal<Equipo | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly errorEliminar = signal<string | null>(null);
  protected readonly motivoEliminar = signal('');

  protected readonly hayFiltros = computed(
    () =>
      !!(
        this.q() ||
        this.marca() ||
        this.pulg() ||
        this.estado() ||
        this.condicion() ||
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

  private readonly recarga$ = new Subject<void>();
  private temporizador?: ReturnType<typeof setTimeout>;
  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.temporizador);
      clearTimeout(this.temporizadorAviso);
    });

    // Aviso que viene de otra pantalla (equipo creado o actualizado)
    const estadoNav = history.state as { aviso?: string } | null;
    if (estadoNav?.aviso) {
      this.mostrarAviso(estadoNav.aviso);
      const resto = { ...history.state };
      delete resto.aviso;
      history.replaceState(resto, '');
    }

    // switchMap cancela la consulta anterior si llega una nueva (filtros rápidos)
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
              marca: this.marca(),
              pulgadas: this.pulg(),
              estado: this.estado(),
              condicion: this.condicion(),
              desde: this.fechaDesde(),
              hasta: this.fechaHasta(),
              page: this.page(),
              size: this.size(),
              orden: this.orden(),
            })
            .pipe(
              catchError((e: HttpErrorResponse) => {
                this.error.set(e.status === 400 ? mensajeError(e) : 'No se pudo cargar el inventario');
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

    this.svc.marcas().subscribe((m) => this.marcas.set(m));
    this.svc.pulgadas().subscribe((n) => this.pulgadas.set(n));
    this.recarga$.next();
  }

  /** Abre la ficha del equipo al pulsar cualquier parte de la fila. */
  protected abrir(e: Equipo): void {
    this.router.navigate(['/inventario', e.id]);
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
    this.marca.set('');
    this.pulg.set('');
    this.estado.set('');
    this.condicion.set('');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.page.set(0);
    this.recarga$.next();
  }

  // ---------- eliminar ----------

  protected pedirEliminar(e: Equipo): void {
    this.errorEliminar.set(null);
    this.motivoEliminar.set('');
    this.aEliminar.set(e);
  }

  protected cancelarEliminar(): void {
    if (this.eliminando()) return;
    this.aEliminar.set(null);
  }

  /** Cierra el cuadro de confirmación con la tecla Escape. */
  alEscape(): void {
    this.cancelarEliminar();
  }

  protected confirmarEliminar(): void {
    const equipo = this.aEliminar();
    if (!equipo) return;

    const motivo = this.motivoEliminar().trim();
    if (motivo.length < 5) {
      this.errorEliminar.set('Indica el motivo de la eliminación (mínimo 5 caracteres)');
      return;
    }

    this.eliminando.set(true);
    this.errorEliminar.set(null);

    this.svc.eliminar(equipo.id, motivo).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.aEliminar.set(null);
        this.mostrarAviso(`Equipo ${equipo.codigoTk} eliminado`);

        // Si se borró el último de la página, retrocede una página
        const p = this.pagina();
        if (p && p.content.length === 1 && this.page() > 0) {
          this.page.set(this.page() - 1);
        }
        this.recarga$.next();
        this.recargarFiltros();
      },
      error: (e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.errorEliminar.set(mensajeError(e));
      },
    });
  }

  /** Actualiza las listas de marca y pulgadas por si el equipo borrado era el último de una. */
  private recargarFiltros(): void {
    this.svc.marcas().subscribe((m) => this.marcas.set(m));
    this.svc.pulgadas().subscribe((n) => this.pulgadas.set(n));
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 5000);
  }

  // ---------- presentación ----------

  protected readonly texto = textoEstado;

  protected pulgadasDe(e: Equipo): string {
    const valor = e.atributos?.['Pulgadas'];
    return valor ? `${valor}"` : '—';
  }

  /** Dónde está el equipo cuando no está en el almacén (cliente o persona); vacío si está en el almacén. */
  protected detalleUbicacion(e: Equipo): string {
    return e.ubicacionTipo === 'ALMACEN_X' ? '' : (e.ubicacionDetalle ?? '');
  }
}