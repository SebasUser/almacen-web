import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../core/errores';
import { EquipoService } from '../../core/equipo.service';
import {
  ACCIONES_POR_ESTADO,
  ETIQUETA_CONDICION,
  clasePorCondicion,
  motivoCondicion,
  ETIQUETA_TIPO,
  esSalida,
  etiquetaDestino,
  requiereDestino,
  textoEstado,
} from '../../core/etiquetas';
import { Equipo, Movimiento, MovimientoLoteRequest, TipoMovimiento } from '../../core/models';
import { MovimientoService } from '../../core/movimiento.service';

@Component({
  selector: 'app-lote',
  imports: [ReactiveFormsModule, RouterLink],
  host: { '(document:keydown.escape)': 'cancelar()' },
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Movimiento por lote</h1>
          <p class="subtitle">
            Registra el mismo movimiento para varios equipos: llenas los datos una sola vez y escaneas los monitores
          </p>
        </div>
      </div>

      @if (resultado(); as r) {
        <section class="card exito">
          <h2>{{ r.length }} movimientos registrados</h2>
          <p class="muted">
            {{ etiqueta(r[0].tipo) }}
            @if (r[0].origenDestino) {
              · {{ r[0].origenDestino }}
            }
          </p>
          <div class="docs">
            @for (m of r; track m.id) {
              <a class="chip" [routerLink]="['/inventario', m.equipoId]">{{ m.codigoTk }}</a>
            }
          </div>
          <div class="row">
            <button class="btn" (click)="nuevoLote()">Registrar otro lote</button>
            <a class="btn btn-secondary" routerLink="/movimientos">Ver movimientos</a>
          </div>
        </section>
      } @else {
        <form class="card bloque" [formGroup]="form" novalidate>
          <h3>1. Datos del movimiento</h3>
          <div class="form-grid">
            <div class="field">
              <label for="tipo">Tipo de movimiento *</label>
              <select id="tipo" class="input" formControlName="tipo" (change)="alCambiarTipo()">
                @for (t of tipos; track t) {
                  <option [value]="t">{{ etiqueta(t) }}</option>
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
                  autocomplete="off"
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
              <span class="hint">Vacío = ahora</span>
            </div>

            @if (salida()) {
              <div class="field">
                <label for="oc">Orden de compra (OC)</label>
                <input id="oc" class="input" formControlName="oc" autocomplete="off" />
              </div>
              <div class="field">
                <label for="rq">Requerimiento (RQ)</label>
                <input id="rq" class="input" formControlName="rq" autocomplete="off" />
              </div>
            }
            <div class="field">
              <label for="guia">Guía</label>
              <input id="guia" class="input" formControlName="guia" autocomplete="off" />
            </div>
            @if (salida()) {
              <div class="field">
                <label for="factura">Factura</label>
                <input id="factura" class="input" formControlName="factura" autocomplete="off" />
              </div>
            }
          </div>
          <div class="field">
            <label for="obs">Observaciones</label>
            <textarea id="obs" class="input" formControlName="observaciones"></textarea>
          </div>
        </form>

        <section class="card bloque">
          <h3>2. Escanea los equipos ({{ items().length }})</h3>
          <div class="fila">
            <input
              #entrada
              class="input grande"
              autocomplete="off"
              placeholder="Haz clic aquí y escanea…"
              aria-label="Código del equipo"
              [value]="valor()"
              (input)="valor.set(valorDe($event))"
              (keydown.enter)="escanear()"
            />
            <button class="btn" (click)="escanear()" [disabled]="valor().trim() === ''">Agregar</button>
          </div>

          @if (mensaje(); as m) {
            <div [class]="'alert ' + (m.ok ? 'alert-ok' : 'alert-error')" role="status">{{ m.texto }}</div>
          }

          @if (items().length > 0) {
            <div class="table-wrap lista">
              <table class="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Marca</th>
                    <th>Pulgadas</th>
                    <th>Estado actual</th>
                    <th>Condición</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of items(); track e.id) {
                    <tr [class.malo]="!permitido(e)">
                      <td class="code">{{ e.codigoTk }}</td>
                      <td>{{ e.marca ?? '—' }}</td>
                      <td>{{ e.atributos['Pulgadas'] ? e.atributos['Pulgadas'] + '"' : '—' }}</td>
                      <td>
                        <span [class]="'badge badge-' + e.estado.toLowerCase()">{{ texto(e.estado) }}</span>
                      </td>
                      <td>
                        <span [class]="'badge ' + claseCondicion(e.condicion)" [title]="e.observaciones ?? ''">{{
                          etiquetaCondicion[e.condicion]
                        }}</span>
                      </td>
                      <td class="nota-fila">
                        @if (problema(e); as motivo) {
                          No admite «{{ etiqueta(tipoSel()) }}»: {{ motivo }}
                        }
                      </td>
                      <td>
                        <button class="btn btn-ghost btn-sm" (click)="quitar(e.id)">Quitar</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted vacio">Aún no hay equipos en el lote. Escanea el primero.</p>
          }
        </section>

        @if (errorEnvio()) {
          <div class="alert alert-error" role="alert">{{ errorEnvio() }}</div>
        }

        <div class="row acciones">
          <span class="muted">{{ resumenCorto() }}</span>
          <button class="btn" (click)="revisar()" [disabled]="!listo()">Revisar y confirmar</button>
        </div>
      }
    </div>

    @if (confirmando()) {
      <div class="overlay" (click)="cancelar()">
        <div class="modal card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h2>¿Registrar {{ items().length }} movimientos?</h2>
          <p>
            <strong>{{ etiqueta(tipoSel()) }}</strong>
            @if (pideDestino()) {
              · {{ nombreDestino() }}: <strong>{{ destinoTexto() }}</strong>
            }
          </p>
          <div class="docs">
            @for (e of primeros(); track e.id) {
              <span class="chip">{{ e.codigoTk }}</span>
            }
            @if (items().length > primeros().length) {
              <span class="muted">y {{ items().length - primeros().length }} más</span>
            }
          </div>
          <p class="muted">
            Se registran todos a la vez; si uno no se puede, no se guarda ninguno. Si te equivocas, el administrador
            puede anular cada movimiento.
          </p>
          <div class="row acciones">
            <button class="btn btn-secondary" (click)="cancelar()" [disabled]="enviando()">Cancelar</button>
            <button class="btn" (click)="enviar()" [disabled]="enviando()">
              {{ enviando() ? 'Registrando…' : 'Registrar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .bloque { margin-bottom: 20px; }
    .bloque h3 { margin-bottom: 14px; }
    .fila { display: flex; gap: 10px; align-items: center; }
    .input.grande { height: 48px; font-size: 18px; font-weight: 600; }
    .alert { margin: 14px 0 0; }
    .lista { margin-top: 16px; }
    tr.malo td { background: var(--danger-soft); }
    .nota-fila { color: var(--danger); font-size: 12px; }
    .vacio { margin-top: 14px; }
    .acciones { justify-content: space-between; margin-top: 4px; }
    .exito { display: grid; gap: 14px; }
    .docs { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 1px 10px; font-size: 12px; text-decoration: none; color: inherit; }
    a.btn { text-decoration: none; }
    a.btn:hover { text-decoration: none; }
    .overlay { position: fixed; inset: 0; background: rgba(25, 25, 25, 0.55); display: grid; place-items: center; padding: 16px; z-index: 50; }
    .modal { width: 100%; max-width: 480px; display: grid; gap: 12px; box-shadow: var(--shadow-lg); }
    .modal .acciones { justify-content: flex-end; }
  `,
})
export class Lote {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly equipos = inject(EquipoService);
  private readonly movimientos = inject(MovimientoService);

  private readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');

  protected readonly tipos: TipoMovimiento[] = [
    'SALIDA_ALQUILER',
    'SALIDA_VENTA',
    'ASIGNACION_PERSONAL',
    'DEVOLUCION_CLIENTE',
    'RETORNO_PERSONAL',
  ];

  protected readonly form = this.fb.group({
    tipo: ['SALIDA_ALQUILER' as TipoMovimiento],
    origenDestino: ['', [Validators.required, Validators.maxLength(150)]],
    fecha: [''],
    oc: ['', [Validators.maxLength(50)]],
    rq: ['', [Validators.maxLength(50)]],
    guia: ['', [Validators.maxLength(50)]],
    factura: ['', [Validators.maxLength(50)]],
    observaciones: ['', [Validators.maxLength(255)]],
  });

  protected readonly tipoSel = signal<TipoMovimiento>('SALIDA_ALQUILER');
  protected readonly items = signal<Equipo[]>([]);
  protected readonly valor = signal('');
  protected readonly mensaje = signal<{ ok: boolean; texto: string } | null>(null);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly resultado = signal<Movimiento[] | null>(null);

  protected readonly pideDestino = computed(() => requiereDestino(this.tipoSel()));
  protected readonly salida = computed(() => esSalida(this.tipoSel()));
  protected readonly nombreDestino = computed(() => etiquetaDestino(this.tipoSel()));
  protected readonly primeros = computed(() => this.items().slice(0, 12));

  protected readonly invalidos = computed(() => this.items().filter((e) => !this.permitido(e)));
  protected readonly listo = computed(() => this.items().length > 0 && this.invalidos().length === 0);

  protected readonly etiqueta = (t: TipoMovimiento) => ETIQUETA_TIPO[t];
  protected readonly texto = textoEstado;

  constructor() {
    this.alCambiarTipo();
  }

  protected invalido(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected destinoTexto(): string {
    return this.form.controls.origenDestino.value.trim();
  }

  protected resumenCorto(): string {
    const total = this.items().length;
    const malos = this.invalidos().length;
    if (total === 0) return 'Escanea al menos un equipo';
    if (malos > 0) return `Quita los ${malos} equipos marcados en rojo para continuar`;
    return `${total} equipos listos`;
  }

  /** Un equipo sirve para el movimiento elegido según su estado actual (la API valida lo mismo). */
  protected permitido(e: Equipo): boolean {
    return this.problema(e) === null;
  }

  protected readonly etiquetaCondicion = ETIQUETA_CONDICION;
  protected readonly claseCondicion = clasePorCondicion;

  /** Por qué el equipo no admite el movimiento elegido (por su estado o su condición); null si lo admite. */
  protected problema(e: Equipo): string | null {
    if (!ACCIONES_POR_ESTADO[e.estado].includes(this.tipoSel())) {
      return `está ${this.texto(e.estado).toLowerCase()}`;
    }
    return motivoCondicion(e, this.tipoSel());
  }

  protected alCambiarTipo(): void {
    const tipo = this.form.controls.tipo.value;
    this.tipoSel.set(tipo);
    const destino = this.form.controls.origenDestino;
    destino.setValidators(
      requiereDestino(tipo) ? [Validators.required, Validators.maxLength(150)] : [Validators.maxLength(150)],
    );
    destino.updateValueAndValidity();
  }

  // ---------- escaneo ----------

  protected escanear(): void {
    const codigo = this.valor().trim();
    if (!codigo) return;
    this.valor.set(''); // listo para el siguiente escaneo, sin esperar la respuesta
    this.errorEnvio.set(null);

    if (this.items().some((i) => i.codigoTk.toLowerCase() === codigo.toLowerCase())) {
      this.mensaje.set({ ok: false, texto: `${codigo.toUpperCase()} ya está en la lista` });
      return;
    }

    this.equipos.porCodigo(codigo).subscribe({
      next: (e) => {
        if (this.items().some((i) => i.id === e.id)) {
          this.mensaje.set({ ok: false, texto: `${e.codigoTk} ya está en la lista` });
          return;
        }
        this.items.update((lista) => [e, ...lista]);
        this.mensaje.set(
          this.permitido(e)
            ? { ok: true, texto: `${e.codigoTk} agregado` }
            : {
                ok: false,
                texto: `${e.codigoTk} ${this.problema(e)} y no admite «${this.etiqueta(this.tipoSel())}»`,
              },
        );
      },
      error: (e: HttpErrorResponse) =>
        this.mensaje.set({
          ok: false,
          texto: e.status === 404 ? `No existe el código ${codigo.toUpperCase()}` : mensajeError(e),
        }),
    });
  }

  protected quitar(id: number): void {
    this.items.update((lista) => lista.filter((e) => e.id !== id));
    this.mensaje.set(null);
    this.entrada()?.nativeElement.focus();
  }

  // ---------- confirmar y registrar ----------

  protected revisar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.listo()) return;
    this.errorEnvio.set(null);
    this.confirmando.set(true);
  }

  /** Cierra el cuadro de confirmación (también con Escape). */
  cancelar(): void {
    if (this.enviando()) return;
    this.confirmando.set(false);
  }

  protected enviar(): void {
    const v = this.form.getRawValue();
    const tipo = v.tipo;
    const t = (s: string) => s.trim() || null;

    const body: MovimientoLoteRequest = {
      tipo,
      origenDestino: requiereDestino(tipo) ? t(v.origenDestino) : null,
      fecha: v.fecha || null,
      oc: esSalida(tipo) ? t(v.oc) : null,
      rq: esSalida(tipo) ? t(v.rq) : null,
      guia: t(v.guia),
      factura: esSalida(tipo) ? t(v.factura) : null,
      observaciones: t(v.observaciones),
      equipoIds: this.items().map((e) => e.id),
    };

    this.enviando.set(true);
    this.movimientos.registrarLote(body).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.items.set([]);
        this.mensaje.set(null);
        this.resultado.set(res);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.errorEnvio.set(mensajeError(e));
      },
    });
  }

  protected nuevoLote(): void {
    this.resultado.set(null);
    this.items.set([]);
    this.mensaje.set(null);
    this.errorEnvio.set(null);
    this.form.reset({
      tipo: this.form.controls.tipo.value,
      origenDestino: '',
      fecha: '',
      oc: '',
      rq: '',
      guia: '',
      factura: '',
      observaciones: '',
    });
    this.alCambiarTipo();
  }
}
