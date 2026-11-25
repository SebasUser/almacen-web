import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormRecord,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoriaService } from '../../core/categoria.service';
import { mensajeError } from '../../core/errores';
import { EquipoService } from '../../core/equipo.service';
import { AYUDA_CONDICION, CONDICIONES, ETIQUETA_CONDICION, textoEstado } from '../../core/etiquetas';
import { Categoria, CondicionEquipo, Equipo, EquipoRequest } from '../../core/models';

@Component({
  selector: 'app-equipo-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page form-page">
      <div class="page-header">
        <div>
          <h1>{{ editando ? 'Editar equipo' : 'Nuevo equipo' }}</h1>
          <p class="subtitle">
            @if (editando) {
              Modifica los datos del equipo. El estado y la ubicación cambian con los movimientos.
            } @else {
              Registra un equipo nuevo en el inventario.
            }
          </p>
        </div>
        @if (equipoActual(); as eq) {
          <span [class]="'badge badge-' + eq.estado.toLowerCase()">{{ texto(eq.estado) }}</span>
        }
      </div>

      @if (cargando()) {
        <p class="muted">Cargando…</p>
      } @else if (errorCarga()) {
        <div class="alert alert-error">{{ errorCarga() }}</div>
        <p style="margin-top: 16px"><a class="btn btn-secondary" routerLink="/inventario">Volver al inventario</a></p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" novalidate class="stack">
          <section class="card">
            <h3 class="seccion">Datos del equipo</h3>
            <div class="form-grid">
              <div class="field">
                <label for="categoria">Categoría *</label>
                <select
                  id="categoria"
                  class="input"
                  formControlName="categoriaId"
                  (change)="alCambiarCategoria()"
                  [class.invalid]="invalido(form.controls.categoriaId)"
                >
                  <option [ngValue]="0" disabled>Selecciona una categoría</option>
                  @for (c of categorias(); track c.id) {
                    <option [ngValue]="c.id">{{ c.nombre }}</option>
                  }
                </select>
                @if (invalido(form.controls.categoriaId)) {
                  <span class="error">Selecciona una categoría</span>
                }
                @if (editando) {
                  <span class="hint">La categoría no se puede cambiar después de registrar el equipo.</span>
                }
              </div>

              <div class="field">
                <label for="codigo">Código TK *</label>
                <input
                  id="codigo"
                  class="input"
                  formControlName="codigoTk"
                  placeholder="ej. 2311TK0202563"
                  [class.invalid]="invalido(form.controls.codigoTk)"
                />
                @if (invalido(form.controls.codigoTk)) {
                  <span class="error">El código es obligatorio (máximo 50 caracteres)</span>
                } @else {
                  <span class="hint">Se guarda en mayúsculas</span>
                }
              </div>

              <div class="field">
                <label for="serie">Número de serie</label>
                <input id="serie" class="input" formControlName="numeroSerie" [class.invalid]="invalido(form.controls.numeroSerie)" />
              </div>

              <div class="field">
                <label for="marca">Marca</label>
                <input id="marca" class="input" formControlName="marca" placeholder="ej. LG" [class.invalid]="invalido(form.controls.marca)" />
                <span class="hint">Se guarda en mayúsculas</span>
              </div>

              @for (nombre of nombresAtributos(); track nombre) {
                <div class="field">
                  <label [attr.for]="'attr-' + nombre">{{ nombre }}</label>
                  <input
                    [id]="'attr-' + nombre"
                    class="input"
                    [formControl]="form.controls.atributos.controls[nombre]"
                    inputmode="decimal"
                  />
                </div>
              }
            </div>

            @if (!editando) {
              <div class="field" style="margin-top: 16px">
                <label for="origen">Ingresa desde</label>
                <input
                  id="origen"
                  class="input"
                  formControlName="origenIngreso"
                  list="origenes"
                  autocomplete="off"
                  placeholder="ej. Almacén M"
                />
                <datalist id="origenes">
                  <option value="Almacén M"></option>
                  <option value="Compra directa"></option>
                  <option value="Registro en el sistema"></option>
                </datalist>
                <span class="hint">Queda en el historial como origen de la entrada. Elige una opción o escribe otra.</span>
              </div>
            }

            <div class="field" style="margin-top: 16px">
              <label for="condicion">Condición *</label>
              <select id="condicion" class="input" formControlName="condicion">
                @for (c of condiciones; track c) {
                  <option [value]="c">{{ etiquetaCondicion[c] }}</option>
                }
              </select>
              <span class="hint">{{ ayudaCondicion[form.controls.condicion.value] }}</span>
            </div>

            <div class="field" style="margin-top: 16px">
              <label for="descripcion">Descripción</label>
              <input
                id="descripcion"
                class="input"
                formControlName="descripcion"
                placeholder="ej. MONITOR LED 21.5&quot; AOC MOD. I2269VWM"
                [class.invalid]="invalido(form.controls.descripcion)"
              />
            </div>
          </section>

          <section class="card">
            <h3 class="seccion">Compra y garantía</h3>
            <div class="form-grid">
              <div class="field">
                <label for="fecha">Fecha de compra</label>
                <input id="fecha" type="date" class="input" formControlName="fechaCompra" />
              </div>
              <div class="field">
                <label for="proveedor">Proveedor</label>
                <input id="proveedor" class="input" formControlName="proveedor" />
              </div>
              <div class="field">
                <label for="factura">Factura</label>
                <input id="factura" class="input" formControlName="factura" />
              </div>
              <div class="field">
                <label for="guia">Guía</label>
                <input id="guia" class="input" formControlName="guia" />
              </div>
              <div class="field">
                <label for="usd">Costo sin IGV (US$)</label>
                <input id="usd" type="number" min="0" step="0.01" class="input" formControlName="costoUsd" [class.invalid]="invalido(form.controls.costoUsd)" />
              </div>
              <div class="field">
                <label for="tc">Tipo de cambio</label>
                <input id="tc" type="number" min="0" step="0.0001" class="input" formControlName="tipoCambio" [class.invalid]="invalido(form.controls.tipoCambio)" />
              </div>
              <div class="field">
                <label for="pen">Costo sin IGV (S/)</label>
                <input id="pen" type="number" min="0" step="0.01" class="input" formControlName="costoPen" [class.invalid]="invalido(form.controls.costoPen)" />
              </div>
              <div class="field">
                <label for="garantia">Garantía</label>
                <input id="garantia" class="input" formControlName="garantia" placeholder="ej. 12 meses" />
              </div>
            </div>
          </section>

          <section class="card">
            <h3 class="seccion">Observaciones</h3>
            <div class="field">
              <textarea id="obs" class="input" formControlName="observaciones" placeholder="Notas sobre el estado físico, accesorios, etc."></textarea>
              <span class="hint">Se muestran destacadas en la ficha del equipo (rayones, falta de cargador, fallas, etc.).</span>
            </div>
          </section>

          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }

          <div class="row acciones">
            <a class="btn btn-secondary" routerLink="/inventario">Cancelar</a>
            <button class="btn" type="submit" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear equipo' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .form-page { max-width: 920px; margin: 0 auto; }
    .stack { display: grid; gap: 20px; }
    .seccion { margin-bottom: 16px; }
    .acciones { justify-content: flex-end; }
    a.btn { text-decoration: none; }
    a.btn:hover { text-decoration: none; }
  `,
})
export class EquipoForm {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly equipos = inject(EquipoService);
  private readonly categoriasSvc = inject(CategoriaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly editando = this.id !== null;
  /** Código que llega desde la pantalla Escanear cuando el equipo aún no existe. */
  private readonly codigoInicial = this.route.snapshot.queryParamMap.get('codigo');

  protected readonly condiciones = CONDICIONES;
  protected readonly etiquetaCondicion = ETIQUETA_CONDICION;
  protected readonly ayudaCondicion = AYUDA_CONDICION;

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly nombresAtributos = signal<string[]>([]);
  protected readonly equipoActual = signal<Equipo | null>(null);

  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Campos dinámicos según la categoría (ej. Pulgadas). Se guarda aparte para conservar su tipo FormRecord. */
  private readonly atributos = new FormRecord<FormControl<string>>({});

  protected readonly form = this.fb.group({
    categoriaId: [0, [Validators.min(1)]],
    codigoTk: ['', [Validators.required, Validators.maxLength(50)]],
    numeroSerie: ['', [Validators.maxLength(100)]],
    marca: ['', [Validators.maxLength(80)]],
    condicion: ['POR_REVISAR' as CondicionEquipo],
    origenIngreso: ['Almacén M', [Validators.maxLength(150)]],
    descripcion: ['', [Validators.maxLength(255)]],
    fechaCompra: [''],
    proveedor: ['', [Validators.maxLength(150)]],
    factura: ['', [Validators.maxLength(50)]],
    guia: ['', [Validators.maxLength(50)]],
    costoUsd: [null as number | null, [Validators.min(0)]],
    costoPen: [null as number | null, [Validators.min(0)]],
    tipoCambio: [null as number | null, [Validators.min(0)]],
    garantia: ['', [Validators.maxLength(100)]],
    observaciones: ['', [Validators.maxLength(255)]],
    atributos: this.atributos,
  });

  constructor() {
    if (this.editando) {
      this.form.controls.categoriaId.disable();
    }

    this.categoriasSvc.listar().subscribe({
      next: (cats) => {
        this.categorias.set(cats);
        if (this.editando) {
          this.cargarEquipo();
        } else {
          if (cats.length === 1) {
            this.form.controls.categoriaId.setValue(cats[0].id);
            this.armarAtributos(cats[0].id);
          }
          if (this.codigoInicial) {
            this.form.controls.codigoTk.setValue(this.codigoInicial.trim().toUpperCase());
          }
          this.cargando.set(false);
        }
      },
      error: (e: HttpErrorResponse) => {
        this.errorCarga.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected invalido(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  protected readonly texto = textoEstado;

  protected alCambiarCategoria(): void {
    this.armarAtributos(Number(this.form.controls.categoriaId.value));
  }

  private cargarEquipo(): void {
    this.equipos.obtener(Number(this.id)).subscribe({
      next: (e) => {
        this.equipoActual.set(e);
        this.form.patchValue({
          categoriaId: e.categoriaId,
          codigoTk: e.codigoTk,
          numeroSerie: e.numeroSerie ?? '',
          marca: e.marca ?? '',
          descripcion: e.descripcion ?? '',
          condicion: e.condicion,
          fechaCompra: e.fechaCompra ?? '',
          proveedor: e.proveedor ?? '',
          factura: e.factura ?? '',
          guia: e.guia ?? '',
          costoUsd: e.costoUsd,
          costoPen: e.costoPen,
          tipoCambio: e.tipoCambio,
          garantia: e.garantia ?? '',
          observaciones: e.observaciones ?? '',
        });
        this.armarAtributos(e.categoriaId, e.atributos ?? {});
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorCarga.set(e.status === 404 ? 'No existe el equipo solicitado' : mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  /** Crea un campo por cada atributo de la categoría (ej. Pulgadas para Monitor). */
  private armarAtributos(categoriaId: number, valores: Record<string, string> = {}): void {
    const registro = this.atributos;
    Object.keys(registro.controls).forEach((k) => registro.removeControl(k));

    const nombres = this.categorias().find((c) => c.id === categoriaId)?.atributos ?? [];
    nombres.forEach((n) =>
      registro.addControl(
        n,
        new FormControl(valores[n] ?? '', { nonNullable: true, validators: [Validators.maxLength(100)] }),
      ),
    );
    this.nombresAtributos.set(nombres);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    const texto = (s: string) => s.trim() || null;

    const body: EquipoRequest = {
      categoriaId: v.categoriaId,
      codigoTk: v.codigoTk.trim(),
      numeroSerie: texto(v.numeroSerie),
      marca: texto(v.marca),
      descripcion: texto(v.descripcion),
      condicion: v.condicion,
      origenIngreso: this.editando ? null : texto(v.origenIngreso),
      fechaCompra: v.fechaCompra || null,
      proveedor: texto(v.proveedor),
      factura: texto(v.factura),
      guia: texto(v.guia),
      costoUsd: v.costoUsd,
      costoPen: v.costoPen,
      tipoCambio: v.tipoCambio,
      garantia: texto(v.garantia),
      observaciones: texto(v.observaciones),
      atributos: Object.fromEntries(Object.entries(v.atributos).map(([k, val]) => [k, val.trim()])),
    };

    const peticion = this.editando
      ? this.equipos.actualizar(Number(this.id), body)
      : this.equipos.crear(body);

    peticion.subscribe({
      next: (e) => {
        this.router.navigate(['/inventario'], {
          state: { aviso: `Equipo ${e.codigoTk} ${this.editando ? 'actualizado' : 'creado'}` },
        });
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }
}