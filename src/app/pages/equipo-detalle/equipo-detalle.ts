import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/errores';
import { fechaDe, fechaHora, horaDe } from '../../core/formato';
import { EquipoService } from '../../core/equipo.service';
import {
  ACCIONES_POR_ESTADO,
  AYUDA_CONDICION,
  CLASE_TIPO,
  ETIQUETA_CONDICION,
  ETIQUETA_TIPO,
  accionesDe,
  clasePorCondicion,
  esSalida,
  etiquetaDestino,
  rotuloOrigenDestino,
  requiereDestino,
  textoEstado,
} from '../../core/etiquetas';
import { Equipo, Movimiento, MovimientoRequest, TipoMovimiento } from '../../core/models';
import { MovimientoService } from '../../core/movimiento.service';

@Component({
  selector: 'app-equipo-detalle',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <a class="volver" routerLink="/inventario">← Volver al inventario</a>

      @if (cargando()) {
        <p class="muted">Cargando…</p>
      } @else if (errorCarga()) {
        <div class="alert alert-error">{{ errorCarga() }}</div>
      } @else if (equipo(); as e) {
        <div class="page-header">
          <div>
            <div class="titulo">
              <h1>{{ e.codigoTk }}</h1>
              <span [class]="'badge badge-' + e.estado.toLowerCase()">{{ texto(e.estado) }}</span>
              <span [class]="'badge ' + claseCondicion(e.condicion)">{{ etiquetaCondicion[e.condicion] }}</span>
            </div>
            <p class="subtitle">{{ e.descripcion ?? 'Sin descripción' }}</p>
          </div>
          <div class="row">
            @if (auth.esAdmin()) {
              <a class="btn btn-secondary" [routerLink]="['/inventario', e.id, 'editar']">Editar</a>
            }
            @if (acciones().length > 0) {
              <button class="btn" (click)="abrirPanel()" [disabled]="abierto()">Registrar movimiento</button>
            }
          </div>
        </div>

        @if (aviso()) {
          <div class="alert alert-ok" role="status" style="margin-bottom: 16px">{{ aviso() }}</div>
        }

        @if (e.condicion !== 'OPERATIVO' || e.observaciones) {
          <section [class]="'aviso-ficha aviso-' + e.condicion.toLowerCase()" role="note">
            <div class="aviso-cabecera">
              <strong>{{ etiquetaCondicion[e.condicion] }}</strong>
              <span>{{ ayudaCondicion[e.condicion] }}</span>
            </div>
            @if (e.observaciones) {
              <p class="aviso-obs"><span class="aviso-rotulo">Observaciones</span>{{ e.observaciones }}</p>
            } @else if (e.condicion !== 'OPERATIVO') {
              <p class="aviso-obs muted">Sin observaciones registradas.</p>
            }
          </section>
        }

        @if (accionesEstado().length === 0) {
          <div class="alert nota" style="margin-bottom: 16px">
            Este equipo está {{ texto(e.estado).toLowerCase() }} y ya no admite movimientos.
          </div>
        }

        @if (abierto()) {
          <form class="card panel" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
            <h3>Registrar movimiento</h3>

            <div class="form-grid">
              <div class="field">
                <label for="tipo">Tipo de movimiento *</label>
                <select
                  id="tipo"
                  class="input"
                  formControlName="tipo"
                  (change)="alCambiarTipo()"
                  [class.invalid]="invalido(form.controls.tipo)"
                >
                  @for (a of acciones(); track a) {
                    <option [value]="a">{{ etiqueta(a) }}</option>
                  }
                </select>
              </div>

              @if (pideDestino()) {
                <div class="field">
                  <label for="destino">{{ nombreDestino() }} *</label>
                  <input
                    id="destino"
                    class="input"
                    formControlName="origenDestino"
                    [placeholder]="'Nombre del ' + nombreDestino().toLowerCase()"
                    [class.invalid]="invalido(form.controls.origenDestino)"
                  />
                  @if (invalido(form.controls.origenDestino)) {
                    <span class="error">Indica {{ nombreDestino() === 'Cliente' ? 'el cliente' : 'la persona' }}</span>
                  }
                </div>
              }

              <div class="field">
                <label for="fecha">Fecha y hora</label>
                <input id="fecha" type="datetime-local" class="input" formControlName="fecha" />
                <span class="hint">Si lo dejas vacío se usa la fecha y hora actual</span>
              </div>
            </div>

            <div class="form-grid">
              @if (salida()) {
                <div class="field">
                  <label for="oc">Orden de compra (OC)</label>
                  <input id="oc" class="input" formControlName="oc" />
                </div>
                <div class="field">
                  <label for="rq">Requerimiento (RQ)</label>
                  <input id="rq" class="input" formControlName="rq" />
                </div>
              }
              <div class="field">
                <label for="guia">Guía</label>
                <input id="guia" class="input" formControlName="guia" />
              </div>
              @if (salida()) {
                <div class="field">
                  <label for="factura">Factura</label>
                  <input id="factura" class="input" formControlName="factura" />
                </div>
              }
            </div>

            <div class="field">
              <label for="obs">Observaciones</label>
              <textarea id="obs" class="input" formControlName="observaciones"></textarea>
            </div>

            @if (errorForm()) {
              <div class="alert alert-error" role="alert">{{ errorForm() }}</div>
            }

            <div class="row acciones">
              <button type="button" class="btn btn-secondary" (click)="cerrarPanel()" [disabled]="guardando()">
                Cancelar
              </button>
              <button type="submit" class="btn" [disabled]="guardando()">
                {{ guardando() ? 'Guardando…' : 'Registrar' }}
              </button>
            </div>
          </form>
        }

        <div class="cols">
          <div class="stack">
            <section class="card">
              <h3 class="seccion">Datos del equipo</h3>
              <dl class="grid">
                @for (d of datos(); track d.k) {
                  <div>
                    <dt>{{ d.k }}</dt>
                    <dd>{{ d.v }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section class="card">
              <h3 class="seccion">Compra y garantía</h3>
              <dl class="grid">
                @for (d of compra(); track d.k) {
                  <div>
                    <dt>{{ d.k }}</dt>
                    <dd>{{ d.v }}</dd>
                  </div>
                }
              </dl>
            </section>

          </div>

          <section class="card historial">
            <div class="hist-cab">
              <h3>Historial</h3>
              @if (!cargandoHistorial() && !errorHistorial()) {
                <span class="muted">{{ movimientos().length }} {{ movimientos().length === 1 ? 'movimiento' : 'movimientos' }}</span>
              }
            </div>
            @if (errorHistorial()) {
              <div class="alert alert-error">{{ errorHistorial() }}</div>
            } @else if (cargandoHistorial()) {
              <p class="muted">Cargando historial…</p>
            } @else {
              <ol class="linea">
                @for (m of movimientos(); track m.id) {
                  <li [class.anulado]="m.anulado">
                    <span [class]="'nodo nodo-' + (m.anulado ? 'anulado' : clase(m.tipo))"></span>
                    <article class="mov">
                      <header class="mov-cab">
                        <div class="mov-titulo">
                          <strong>{{ etiqueta(m.tipo) }}</strong>
                          @if (m.anulado) {
                            <span class="badge badge-baja">Anulado</span>
                          }
                        </div>
                        <time class="mov-fecha">{{ fechaDe(m.fecha) }} · {{ horaDe(m.fecha) }}</time>
                      </header>

                      @if (m.origenDestino) {
                        <div class="mov-dato">
                          <span class="rotulo">{{ rotulo(m.tipo) }}</span>
                          <span>{{ m.origenDestino }}</span>
                        </div>
                      }
                      @if (m.oc || m.rq || m.guia || m.factura) {
                        <div class="docs">
                          @if (m.oc) { <span class="chip">OC: {{ m.oc }}</span> }
                          @if (m.rq) { <span class="chip">RQ: {{ m.rq }}</span> }
                          @if (m.guia) { <span class="chip">Guía: {{ m.guia }}</span> }
                          @if (m.factura) { <span class="chip">Factura: {{ m.factura }}</span> }
                        </div>
                      }
                      @if (m.observaciones) {
                        <p class="mov-nota">{{ m.observaciones }}</p>
                      }
                      @if (m.anulado) {
                        <div class="aviso-anulado">
                          Anulado por {{ m.anuladoPor ?? '—' }} el {{ fechaHora(m.fechaAnulacion) }}.
                          Motivo: {{ m.motivoAnulacion ?? '—' }}
                        </div>
                      }

                      <footer class="mov-pie">
                        <span class="muted">Registrado por <strong>{{ m.usuario ?? 'Carga inicial (sistema)' }}</strong></span>
                        @if (puedeAnular(m)) {
                          <button type="button" class="btn btn-ghost btn-sm borrar" (click)="pedirAnular(m)">
                            Anular
                          </button>
                        }
                      </footer>
                    </article>
                  </li>
                } @empty {
                  <li class="muted">Sin movimientos registrados.</li>
                }
              </ol>
            }
          </section>
        </div>
      }
    </div>

    @if (aAnular(); as mv) {
      <div class="overlay" (click)="cancelarAnular()">
        <div class="modal card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h2>Anular movimiento</h2>
          <p>
            Se anulará <strong>{{ etiqueta(mv.tipo) }}</strong> del {{ fechaHora(mv.fecha) }}.
          </p>
          <p class="muted">
            El movimiento seguirá visible en el historial como anulado y el equipo volverá a su estado anterior.
            Después podrás registrar el movimiento correcto.
          </p>
          <div class="field">
            <label for="motivo-anular">Motivo *</label>
            <textarea
              id="motivo-anular"
              class="input"
              [value]="motivoAnular()"
              (input)="motivoAnular.set(valorDe($event))"
              placeholder="ej. Se registró como venta pero fue un alquiler"
            ></textarea>
          </div>
          @if (errorAnular()) {
            <div class="alert alert-error" role="alert">{{ errorAnular() }}</div>
          }
          <div class="row acciones">
            <button class="btn btn-secondary" (click)="cancelarAnular()" [disabled]="anulando()">Cancelar</button>
            <button class="btn btn-danger" (click)="confirmarAnular()" [disabled]="anulando()">
              {{ anulando() ? 'Anulando…' : 'Anular movimiento' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .volver { display: inline-block; margin-bottom: 12px; color: var(--text-muted); }
    .titulo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 20px; align-items: start; }
    @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
    .stack { display: grid; gap: 20px; }
    .seccion { margin-bottom: 14px; }
    a.btn { text-decoration: none; }
    a.btn:hover { text-decoration: none; }
    .aviso-ficha { border-radius: var(--radius); border: 1px solid; border-left-width: 6px; padding: 14px 18px; margin-bottom: 16px; display: grid; gap: 6px; }
    .aviso-cabecera { display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }
    .aviso-cabecera strong { font-size: 15px; text-transform: uppercase; letter-spacing: 0.03em; }
    .aviso-obs { margin: 0; font-size: 15px; font-weight: 500; color: var(--text); }
    .aviso-rotulo { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; margin-bottom: 2px; }
    .aviso-operativo { background: var(--st-disponible-bg); border-color: var(--st-disponible); color: var(--st-disponible); }
    .aviso-solo_venta { background: var(--st-alquilado-bg); border-color: var(--st-alquilado); color: var(--st-alquilado); }
    .aviso-no_operativo { background: var(--st-baja-bg); border-color: var(--st-baja); color: var(--st-baja); }
    .aviso-por_revisar { background: var(--st-vendido-bg); border-color: var(--st-vendido); color: var(--st-vendido); }
    .nota { background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); }

    dl.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px 20px; margin: 0; }
    dt { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
    dd { margin: 0; font-weight: 500; word-break: break-word; }

    .panel { margin-bottom: 20px; display: grid; gap: 16px; border-color: var(--primary); }
    .acciones { justify-content: flex-end; }

    .hist-cab { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px; }
    .linea { list-style: none; margin: 0; padding: 0; position: relative; display: grid; gap: 14px; }
    .linea::before { content: ''; position: absolute; left: 7px; top: 14px; bottom: 14px; width: 2px; background: var(--border); }
    .linea li { position: relative; padding-left: 28px; }
    .nodo { position: absolute; left: 0; top: 14px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid var(--surface); box-shadow: 0 0 0 1px var(--border); background: #98a2b3; }
    .nodo-disponible { background: var(--st-disponible); }
    .nodo-alquilado { background: var(--st-alquilado); }
    .nodo-vendido { background: var(--st-vendido); }
    .nodo-asignado { background: var(--st-asignado); }
    .nodo-anulado { background: #98a2b3; }
    .mov { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; display: grid; gap: 8px; }
    .mov-cab { display: flex; justify-content: space-between; align-items: baseline; gap: 4px 12px; flex-wrap: wrap; }
    .mov-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .mov-titulo strong { font-size: 14px; }
    .mov-fecha { font-size: 12.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .mov-dato { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .rotulo { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); min-width: 84px; }
    .docs { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 1px 10px; font-size: 12px; }
    .mov-nota { margin: 0; padding: 8px 10px; background: var(--surface); border-left: 3px solid var(--border); border-radius: 4px; font-size: 13px; color: var(--text-muted); }
    .mov-pie { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12.5px; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 2px; }
    .mov-pie strong { color: var(--text); font-weight: 600; }
    .linea li.anulado .mov { opacity: 0.8; }
    .linea li.anulado .mov-titulo strong { text-decoration: line-through; color: var(--text-muted); }
    .aviso-anulado { background: var(--danger-soft); color: var(--danger); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; }
    .borrar { color: var(--danger); }
    .borrar:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
    .overlay { position: fixed; inset: 0; background: rgba(25, 25, 25, 0.55); display: grid; place-items: center; padding: 16px; z-index: 50; }
    .modal { width: 100%; max-width: 460px; display: grid; gap: 12px; box-shadow: var(--shadow-lg); }
  `,
})
export class EquipoDetalle {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly equiposSvc = inject(EquipoService);
  private readonly movimientosSvc = inject(MovimientoService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly equipo = signal<Equipo | null>(null);
  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly cargandoHistorial = signal(true);
  protected readonly errorHistorial = signal<string | null>(null);

  protected readonly abierto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorForm = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly tipoSel = signal<TipoMovimiento | ''>('');

  protected readonly fechaHora = fechaHora;
  protected readonly fechaDe = fechaDe;
  protected readonly horaDe = horaDe;
  protected readonly rotulo = rotuloOrigenDestino;

  protected readonly aAnular = signal<Movimiento | null>(null);
  protected readonly motivoAnular = signal('');
  protected readonly anulando = signal(false);
  protected readonly errorAnular = signal<string | null>(null);

  /** Solo se puede anular el último movimiento vigente (no anulado). */
  protected readonly idUltimoVigente = computed(() => {
    const vigentes = this.movimientos().filter((m) => !m.anulado);
    return vigentes.length > 0 ? Math.max(...vigentes.map((m) => m.id)) : null;
  });

  protected readonly form = this.fb.group({
    tipo: ['', [Validators.required]],
    origenDestino: ['', [Validators.maxLength(150)]],
    fecha: [''],
    oc: ['', [Validators.maxLength(50)]],
    rq: ['', [Validators.maxLength(50)]],
    guia: ['', [Validators.maxLength(50)]],
    factura: ['', [Validators.maxLength(50)]],
    observaciones: ['', [Validators.maxLength(255)]],
  });

  /** Movimientos que admite según su estado (sin considerar la condición). */
  protected readonly accionesEstado = computed(() => {
    const e = this.equipo();
    return e ? ACCIONES_POR_ESTADO[e.estado] : [];
  });

  /** Movimientos que se pueden registrar según su estado y su condición. */
  protected readonly acciones = computed(() => {
    const e = this.equipo();
    return e ? accionesDe(e) : [];
  });

  protected readonly pideDestino = computed(() => {
    const t = this.tipoSel();
    return t !== '' && requiereDestino(t);
  });

  protected readonly salida = computed(() => {
    const t = this.tipoSel();
    return t !== '' && esSalida(t);
  });

  protected readonly nombreDestino = computed(() => {
    const t = this.tipoSel();
    return t === '' ? 'Cliente' : etiquetaDestino(t);
  });

  protected readonly datos = computed(() => {
    const e = this.equipo();
    if (!e) return [];
    return [
      { k: 'Categoría', v: e.categoria },
      { k: 'Marca', v: e.marca ?? '—' },
      { k: 'Número de serie', v: e.numeroSerie ?? '—' },
      ...Object.entries(e.atributos ?? {}).map(([k, v]) => ({ k, v: k === 'Pulgadas' ? `${v}"` : v })),
      { k: 'Condición', v: ETIQUETA_CONDICION[e.condicion] },
      { k: 'Ubicación', v: this.ubicacion(e) },
      { k: 'Registrado el', v: fechaHora(e.createdAt) },
    ];
  });

  protected readonly compra = computed(() => {
    const e = this.equipo();
    if (!e) return [];
    return [
      { k: 'Fecha de compra', v: this.fecha(e.fechaCompra) },
      { k: 'Proveedor', v: e.proveedor ?? '—' },
      { k: 'Factura', v: e.factura ?? '—' },
      { k: 'Guía', v: e.guia ?? '—' },
      { k: 'Costo sin IGV (US$)', v: e.costoUsd != null ? `US$ ${e.costoUsd.toFixed(2)}` : '—' },
      { k: 'Tipo de cambio', v: e.tipoCambio != null ? e.tipoCambio.toFixed(4) : '—' },
      { k: 'Costo sin IGV (S/)', v: e.costoPen != null ? `S/ ${e.costoPen.toFixed(2)}` : '—' },
      { k: 'Garantía', v: e.garantia ?? '—' },
    ];
  });

  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizadorAviso));
    this.cargar(true);
  }

  protected readonly etiqueta = (t: TipoMovimiento) => ETIQUETA_TIPO[t];
  protected readonly clase = (t: TipoMovimiento) => CLASE_TIPO[t];
  protected readonly texto = textoEstado;
  protected readonly etiquetaCondicion = ETIQUETA_CONDICION;
  protected readonly ayudaCondicion = AYUDA_CONDICION;
  protected readonly claseCondicion = clasePorCondicion;

  protected invalido(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  // ---------- carga ----------

  private cargar(primeraVez = false): void {
    this.equiposSvc.obtener(this.id).subscribe({
      next: (equipo) => {
        this.equipo.set(equipo);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        if (primeraVez) {
          this.errorCarga.set(e.status === 404 ? 'No existe el equipo solicitado' : mensajeError(e));
        }
        this.cargando.set(false);
      },
    });
    this.cargarHistorial();
  }

  /** El historial se carga aparte: si falla, la ficha igual se muestra y se avisa del error. */
  private cargarHistorial(): void {
    this.cargandoHistorial.set(true);
    this.errorHistorial.set(null);
    this.movimientosSvc.historial(this.id).subscribe({
      next: (historial) => {
        this.movimientos.set(historial);
        this.cargandoHistorial.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorHistorial.set('No se pudo cargar el historial: ' + mensajeError(e));
        this.cargandoHistorial.set(false);
      },
    });
  }

  // ---------- movimiento ----------

  protected abrirPanel(): void {
    this.errorForm.set(null);
    this.form.reset({
      tipo: this.acciones()[0] ?? '',
      origenDestino: '',
      fecha: '',
      oc: '',
      rq: '',
      guia: '',
      factura: '',
      observaciones: '',
    });
    this.alCambiarTipo();
    this.abierto.set(true);
  }

  protected cerrarPanel(): void {
    this.abierto.set(false);
  }

  protected alCambiarTipo(): void {
    const tipo = this.form.controls.tipo.value as TipoMovimiento | '';
    this.tipoSel.set(tipo);
    const destino = this.form.controls.origenDestino;
    destino.setValidators(
      tipo !== '' && requiereDestino(tipo)
        ? [Validators.required, Validators.maxLength(150)]
        : [Validators.maxLength(150)],
    );
    destino.updateValueAndValidity();
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorForm.set(null);

    const v = this.form.getRawValue();
    const tipo = v.tipo as TipoMovimiento;
    const t = (s: string) => s.trim() || null;

    const body: MovimientoRequest = {
      tipo,
      origenDestino: requiereDestino(tipo) ? t(v.origenDestino) : null,
      fecha: v.fecha || null,
      oc: esSalida(tipo) ? t(v.oc) : null,
      rq: esSalida(tipo) ? t(v.rq) : null,
      guia: t(v.guia),
      factura: esSalida(tipo) ? t(v.factura) : null,
      observaciones: t(v.observaciones),
    };

    this.movimientosSvc.registrar(this.id, body).subscribe({
      next: () => {
        this.guardando.set(false);
        this.abierto.set(false);
        this.mostrarAviso(`Movimiento registrado: ${ETIQUETA_TIPO[tipo]}`);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorForm.set(mensajeError(e));
        // Si el estado cambió mientras tanto (otro usuario), se refresca la ficha
        if (e.status === 409) {
          this.cargar();
        }
      },
    });
  }

  // ---------- anular movimiento (solo ADMIN) ----------

  protected puedeAnular(m: Movimiento): boolean {
    return this.auth.esAdmin() && !m.anulado && m.tipo !== 'ENTRADA' && m.id === this.idUltimoVigente();
  }

  protected pedirAnular(m: Movimiento): void {
    this.errorAnular.set(null);
    this.motivoAnular.set('');
    this.aAnular.set(m);
  }

  protected cancelarAnular(): void {
    if (this.anulando()) return;
    this.aAnular.set(null);
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLTextAreaElement).value;
  }

  protected confirmarAnular(): void {
    const m = this.aAnular();
    if (!m) return;

    const motivo = this.motivoAnular().trim();
    if (motivo.length < 5) {
      this.errorAnular.set('Indica el motivo de la anulación (mínimo 5 caracteres)');
      return;
    }

    this.anulando.set(true);
    this.errorAnular.set(null);

    this.movimientosSvc.anular(m.id, motivo).subscribe({
      next: () => {
        this.anulando.set(false);
        this.aAnular.set(null);
        this.mostrarAviso(`Movimiento anulado: ${ETIQUETA_TIPO[m.tipo]}`);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.anulando.set(false);
        this.errorAnular.set(mensajeError(e));
        // Si otro usuario cambió el equipo mientras tanto, se refresca la ficha
        if (e.status === 409) {
          this.cargar();
        }
      },
    });
  }

  private mostrarAviso(texto: string): void {
    this.aviso.set(texto);
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 5000);
  }

  // ---------- presentación ----------

  private ubicacion(e: Equipo): string {
    switch (e.ubicacionTipo) {
      case 'ALMACEN_X':
        return 'Almacén X';
      case 'CLIENTE':
        return 'Cliente: ' + (e.ubicacionDetalle ?? '—');
      case 'PERSONAL':
        return 'Personal: ' + (e.ubicacionDetalle ?? '—');
    }
  }

  private fecha(valor: string | null): string {
    return valor ? valor.split('-').reverse().join('/') : '—';
  }
}
