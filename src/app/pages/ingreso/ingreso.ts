import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaService } from '../../core/categoria.service';
import { marcaDe, pulgadasDe } from '../../core/derivar';
import { EquipoService } from '../../core/equipo.service';
import { mensajeError } from '../../core/errores';
import { textoEstado } from '../../core/etiquetas';
import { IngresoService } from '../../core/ingreso.service';
import { CONDICIONES, ETIQUETA_CONDICION } from '../../core/etiquetas';
import { Categoria, CondicionEquipo, Equipo, IngresoItem, IngresoLoteRequest, IngresoResultado } from '../../core/models';

type EstadoFila = 'consultando' | 'nuevo' | 'existente' | 'error';

interface Fila {
  id: number;
  codigo: string;
  serie: string;
  descripcion: string;
  marca: string;
  atributos: Record<string, string>;
  estado: EstadoFila;
  equipo: Equipo | null;
  error: string | null;
}

interface Accion {
  clase: 'ok' | 'info' | 'error' | 'espera';
  texto: string;
}

@Component({
  selector: 'app-ingreso',
  imports: [RouterLink],
  host: { '(document:keydown.escape)': 'cancelar()' },
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Ingreso al almacén</h1>
          <p class="subtitle">
            Recibe varios equipos de una vez (por ejemplo, un traspaso desde el almacén M): escanea los códigos o pega
            la lista desde Excel
          </p>
        </div>
      </div>

      @if (resultado(); as r) {
        <section class="card exito">
          <h2>{{ r.length }} equipos ingresados</h2>
          <p class="muted">
            {{ contar(r, 'NUEVO') }} nuevos · {{ contar(r, 'DEVOLUCION') }} devoluciones de cliente ·
            {{ contar(r, 'RETORNO') }} retornos de personal
          </p>
          <div class="docs">
            @for (x of r; track x.equipoId) {
              <a class="chip" [routerLink]="['/inventario', x.equipoId]">{{ x.codigoTk }}</a>
            }
          </div>
          <div class="row">
            <button class="btn" (click)="nuevoIngreso()">Registrar otro ingreso</button>
            <a class="btn btn-secondary" routerLink="/movimientos">Ver movimientos</a>
          </div>
        </section>
      } @else {
        <section class="card bloque">
          <h3>1. Datos del ingreso</h3>
          <div class="form-grid">
            <div class="field">
              <label for="categoria">Categoría *</label>
              <select
                id="categoria"
                class="input"
                [disabled]="filas().length > 0"
                (change)="cambiarCategoria(valorDe($event))"
              >
                @for (c of categorias(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === categoriaId()">{{ c.nombre }}</option>
                }
              </select>
              @if (filas().length > 0) {
                <span class="hint">Vacía la lista para cambiarla</span>
              }
            </div>
            <div class="field">
              <label for="origen">Viene de</label>
              <input id="origen" class="input" autocomplete="off" [value]="origen()" (input)="origen.set(valorDe($event))" />
            </div>
            <div class="field">
              <label for="guia">Guía del traspaso</label>
              <input id="guia" class="input" autocomplete="off" [value]="guia()" (input)="guia.set(valorDe($event))" />
            </div>
            <div class="field">
              <label for="obs">Observaciones</label>
              <input
                id="obs"
                class="input"
                autocomplete="off"
                [value]="observaciones()"
                (input)="observaciones.set(valorDe($event))"
              />
            </div>
          </div>

          <details class="valores">
            <summary>Valores para los equipos nuevos (opcional): se usan si no vienen en la lista</summary>
            <div class="form-grid">
              <div class="field">
                <label for="d-desc">Descripción</label>
                <input
                  id="d-desc"
                  class="input"
                  autocomplete="off"
                  placeholder="ej. MONITOR LED 24&quot; LG"
                  [value]="defDescripcion()"
                  (input)="defDescripcion.set(valorDe($event))"
                />
              </div>
              <div class="field">
                <label for="d-marca">Marca</label>
                <input
                  id="d-marca"
                  class="input"
                  autocomplete="off"
                  [value]="defMarca()"
                  (input)="defMarca.set(valorDe($event))"
                />
              </div>
              <div class="field">
                <label for="d-cond">Condición</label>
                <select
                  id="d-cond"
                  class="input"
                  (change)="defCondicion.set(condicionDe($event))"
                >
                  @for (c of condiciones; track c) {
                    <option [value]="c" [selected]="c === defCondicion()">{{ etiquetaCondicion[c] }}</option>
                  }
                </select>
              </div>
              @for (a of atributosCat(); track a) {
                <div class="field">
                  <label [attr.for]="'d-' + a">{{ a }}</label>
                  <input
                    [id]="'d-' + a"
                    class="input"
                    autocomplete="off"
                    [value]="defAtributos()[a] ?? ''"
                    (input)="editarDefAtributo(a, valorDe($event))"
                  />
                </div>
              }
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="aplicarValores()">
              Aplicar a las filas nuevas sin datos
            </button>
          </details>
        </section>

        <section class="card bloque">
          <h3>2. Escanea o pega los equipos ({{ filas().length }})</h3>
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

          <details class="pegar">
            <summary>Pegar una lista desde Excel</summary>
            <p class="hint">
              Copia en Excel las columnas <strong>Código, Serie y Descripción</strong> (en ese orden, la serie y la
              descripción son opcionales) y pégalas aquí. La marca y las pulgadas se sacan de la descripción.
            </p>
            <textarea
              class="input"
              rows="5"
              placeholder="1805TK020120&#9;AQCHC1A000017&#9;MONITOR AOC LED 21.5&quot;"
              [value]="pegado()"
              (input)="pegado.set(valorDe($event))"
            ></textarea>
            <button type="button" class="btn btn-secondary btn-sm" (click)="pegar()" [disabled]="pegado().trim() === ''">
              Agregar a la lista
            </button>
          </details>

          @if (mensaje(); as m) {
            <div [class]="'alert ' + (m.ok ? 'alert-ok' : 'alert-error')" role="status">{{ m.texto }}</div>
          }

          @if (filas().length > 0) {
            <div class="table-wrap lista">
              <table class="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Serie</th>
                    <th>Descripción</th>
                    <th>Marca</th>
                    @for (a of atributosCat(); track a) {
                      <th>{{ a }}</th>
                    }
                    <th>Qué pasará</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of filas(); track f.id) {
                    <tr [class.malo]="accionDe(f).clase === 'error'">
                      <td class="code">{{ f.codigo }}</td>
                      @if (f.estado === 'nuevo') {
                        <td>
                          <input
                            class="input mini"
                            aria-label="Serie"
                            [value]="f.serie"
                            (input)="editar(f.id, 'serie', valorDe($event))"
                          />
                        </td>
                        <td>
                          <input
                            class="input mini ancho"
                            aria-label="Descripción"
                            [class.invalid]="f.descripcion.trim() === ''"
                            [value]="f.descripcion"
                            (input)="editar(f.id, 'descripcion', valorDe($event))"
                          />
                        </td>
                        <td>
                          <input
                            class="input mini"
                            aria-label="Marca"
                            [value]="f.marca"
                            (input)="editar(f.id, 'marca', valorDe($event))"
                          />
                        </td>
                        @for (a of atributosCat(); track a) {
                          <td>
                            <input
                              class="input mini corto"
                              [attr.aria-label]="a"
                              [value]="f.atributos[a] ?? ''"
                              (input)="editarAtributo(f.id, a, valorDe($event))"
                            />
                          </td>
                        }
                      } @else {
                        <td>{{ f.equipo?.numeroSerie ?? '—' }}</td>
                        <td class="desc">{{ f.equipo?.descripcion ?? '—' }}</td>
                        <td>{{ f.equipo?.marca ?? '—' }}</td>
                        @for (a of atributosCat(); track a) {
                          <td>{{ f.equipo?.atributos?.[a] ?? '—' }}</td>
                        }
                      }
                      <td [class]="'accion a-' + accionDe(f).clase">{{ accionDe(f).texto }}</td>
                      <td>
                        <button class="btn btn-ghost btn-sm" (click)="quitar(f.id)">Quitar</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted vacio">Aún no hay equipos en la lista. Escanea el primero o pega la lista de Excel.</p>
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
          <h2>¿Registrar el ingreso de {{ filas().length }} equipos?</h2>
          <p>
            Vienen de <strong>{{ origen().trim() || 'Almacén M' }}</strong
            >@if (guia().trim()) {
              · guía <strong>{{ guia().trim() }}</strong>
            }
          </p>
          <ul class="resumen">
            <li><strong>{{ nuevos() }}</strong> equipos nuevos se registrarán</li>
            <li><strong>{{ devoluciones() }}</strong> volverán de un cliente (devolución)</li>
            <li><strong>{{ retornos() }}</strong> volverán de una persona (retorno)</li>
          </ul>
          <p class="muted">
            Se registran todos a la vez; si uno no se puede, no se guarda ninguno. Si te equivocas, el administrador
            puede anular cada movimiento.
          </p>
          <div class="row acciones">
            <button class="btn btn-secondary" (click)="cancelar()" [disabled]="enviando()">Cancelar</button>
            <button class="btn" (click)="enviar()" [disabled]="enviando()">
              {{ enviando() ? 'Registrando…' : 'Registrar ingreso' }}
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
    details { margin-top: 14px; }
    summary { cursor: pointer; color: var(--primary); font-weight: 500; }
    details > * { margin-top: 10px; }
    textarea.input { font-family: inherit; }
    .alert { margin: 14px 0 0; }
    .lista { margin-top: 16px; }
    .table th, .table td { padding: 8px 10px; }
    .table { font-size: 13px; }
    tr.malo td { background: var(--danger-soft); }
    .input.mini { height: 32px; min-width: 110px; }
    .input.mini.ancho { min-width: 240px; }
    .input.mini.corto { min-width: 70px; max-width: 90px; }
    .desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .accion { font-size: 12px; font-weight: 500; min-width: 190px; }
    .a-ok { color: var(--primary); }
    .a-info { color: #1d6fd1; }
    .a-error { color: var(--danger); }
    .a-espera { color: var(--text-muted); }
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
    .resumen { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
  `,
})
export class Ingreso {
  private readonly categoriasSvc = inject(CategoriaService);
  private readonly equipos = inject(EquipoService);
  private readonly ingresos = inject(IngresoService);

  private readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly categoriaId = signal(0);

  protected readonly origen = signal('Almacén M');
  protected readonly guia = signal('');
  protected readonly observaciones = signal('');

  protected readonly defDescripcion = signal('');
  protected readonly defMarca = signal('');
  protected readonly defCondicion = signal<CondicionEquipo>('POR_REVISAR');
  protected readonly condiciones = CONDICIONES;
  protected readonly etiquetaCondicion = ETIQUETA_CONDICION;
  protected readonly defAtributos = signal<Record<string, string>>({});

  protected readonly filas = signal<Fila[]>([]);
  protected readonly valor = signal('');
  protected readonly pegado = signal('');
  protected readonly mensaje = signal<{ ok: boolean; texto: string } | null>(null);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly resultado = signal<IngresoResultado[] | null>(null);

  private contador = 0;

  protected readonly categoriaSel = computed(() => this.categorias().find((c) => c.id === this.categoriaId()) ?? null);
  protected readonly atributosCat = computed(() => this.categoriaSel()?.atributos ?? []);

  protected readonly nuevos = computed(() => this.filas().filter((f) => f.estado === 'nuevo').length);
  protected readonly devoluciones = computed(
    () => this.filas().filter((f) => f.estado === 'existente' && f.equipo?.estado === 'ALQUILADO').length,
  );
  protected readonly retornos = computed(
    () => this.filas().filter((f) => f.estado === 'existente' && f.equipo?.estado === 'ASIGNADO').length,
  );
  protected readonly pendientes = computed(() => this.filas().filter((f) => this.accionDe(f).clase === 'espera').length);
  protected readonly problemas = computed(() => this.filas().filter((f) => this.accionDe(f).clase === 'error').length);
  protected readonly listo = computed(
    () => this.filas().length > 0 && this.pendientes() === 0 && this.problemas() === 0 && this.categoriaId() > 0,
  );

  constructor() {
    this.categoriasSvc.listar().subscribe({
      next: (cats) => {
        this.categorias.set(cats);
        const preferida = cats.find((c) => c.nombre.toLowerCase() === 'monitor') ?? cats[0];
        if (preferida) this.categoriaId.set(preferida.id);
      },
      error: (e: HttpErrorResponse) => this.errorEnvio.set(mensajeError(e)),
    });
  }

  protected readonly texto = textoEstado;

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected contar(lista: IngresoResultado[], accion: IngresoResultado['accion']): number {
    return lista.filter((x) => x.accion === accion).length;
  }

  protected resumenCorto(): string {
    if (this.filas().length === 0) return 'Escanea o pega al menos un equipo';
    if (this.pendientes() > 0) return 'Verificando códigos…';
    if (this.problemas() > 0) return `Corrige o quita los ${this.problemas()} equipos marcados en rojo`;
    return `${this.nuevos()} nuevos · ${this.devoluciones()} devoluciones · ${this.retornos()} retornos`;
  }

  /** Qué ocurrirá con cada fila al confirmar (la API valida lo mismo). */
  protected accionDe(f: Fila): Accion {
    switch (f.estado) {
      case 'consultando':
        return { clase: 'espera', texto: 'Verificando…' };
      case 'error':
        return { clase: 'error', texto: f.error ?? 'No se pudo verificar el código' };
      case 'nuevo':
        return f.descripcion.trim()
          ? { clase: 'ok', texto: 'Equipo nuevo: se registrará y entrará al almacén X' }
          : { clase: 'error', texto: 'Equipo nuevo: falta la descripción' };
      case 'existente': {
        const e = f.equipo;
        if (!e) return { clase: 'error', texto: 'No se pudo verificar el código' };
        switch (e.estado) {
          case 'ALQUILADO':
            return { clase: 'info', texto: 'Vuelve de un cliente: devolución' };
          case 'ASIGNADO':
            return { clase: 'info', texto: 'Vuelve de una persona: retorno' };
          case 'DISPONIBLE':
            return { clase: 'error', texto: 'Ya está en el almacén X' };
          case 'VENDIDO':
            return { clase: 'error', texto: 'Está vendido: no vuelve al almacén' };
          case 'BAJA':
            return { clase: 'error', texto: 'Está dado de baja' };
        }
      }
    }
  }

  // ---------- categoría y valores por defecto ----------

  protected cambiarCategoria(valor: string): void {
    if (this.filas().length > 0) return;
    this.categoriaId.set(Number(valor));
    this.defAtributos.set({});
  }

  protected editarDefAtributo(nombre: string, valor: string): void {
    this.defAtributos.update((d) => ({ ...d, [nombre]: valor }));
  }

  /** Rellena, en las filas nuevas, solo lo que esté vacío con los valores por defecto. */
  protected aplicarValores(): void {
    this.filas.update((lista) =>
      lista.map((f) => {
        if (f.estado !== 'nuevo') return f;
        const atributos = { ...f.atributos };
        for (const a of this.atributosCat()) {
          if (!atributos[a]?.trim()) atributos[a] = this.defAtributos()[a] ?? '';
        }
        return {
          ...f,
          descripcion: f.descripcion.trim() ? f.descripcion : this.defDescripcion(),
          marca: f.marca.trim() ? f.marca : this.defMarca(),
          atributos,
        };
      }),
    );
  }

  // ---------- agregar equipos ----------

  protected escanear(): void {
    const codigo = this.valor().trim();
    if (!codigo) return;
    this.valor.set(''); // listo para el siguiente escaneo
    this.errorEnvio.set(null);
    if (this.agregarFila(codigo, '', '', 'inicio')) {
      this.mensaje.set({ ok: true, texto: `${codigo.toUpperCase()} agregado` });
    } else {
      this.mensaje.set({ ok: false, texto: `${codigo.toUpperCase()} ya está en la lista` });
    }
  }

  protected pegar(): void {
    const lineas = this.pegado()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let agregados = 0;
    let repetidos = 0;
    lineas.forEach((linea, i) => {
      const celdas = linea.split(/\t|;/).map((c) => c.trim());
      if (i === 0 && /^(c[oó]digo|c[oó]d\.?)$/i.test(celdas[0])) return; // fila de encabezado
      const [codigo, serie = '', descripcion = ''] = celdas;
      if (!codigo) return;
      if (this.agregarFila(codigo, serie, descripcion, 'final')) agregados++;
      else repetidos++;
    });

    this.pegado.set('');
    this.errorEnvio.set(null);
    this.mensaje.set({
      ok: agregados > 0,
      texto:
        agregados > 0
          ? `${agregados} equipos agregados${repetidos > 0 ? ` (${repetidos} repetidos se omitieron)` : ''}`
          : 'No se agregó ningún equipo: revisa que la primera columna sea el código',
    });
  }

  private agregarFila(codigoCrudo: string, serie: string, descripcion: string, posicion: 'inicio' | 'final'): boolean {
    const codigo = codigoCrudo.trim().toUpperCase();
    if (!codigo || this.filas().some((f) => f.codigo === codigo)) return false;

    const desc = descripcion.trim() || this.defDescripcion().trim();
    const atributos: Record<string, string> = {};
    for (const a of this.atributosCat()) {
      const derivado = a.toLowerCase() === 'pulgadas' ? pulgadasDe(desc) : '';
      atributos[a] = derivado || (this.defAtributos()[a] ?? '');
    }

    const fila: Fila = {
      id: ++this.contador,
      codigo,
      serie: serie.trim(),
      descripcion: desc,
      marca: marcaDe(desc) || this.defMarca().trim(),
      atributos,
      estado: 'consultando',
      equipo: null,
      error: null,
    };
    this.filas.update((lista) => (posicion === 'inicio' ? [fila, ...lista] : [...lista, fila]));
    this.consultar(fila.id, codigo);
    return true;
  }

  /** Averigua si el código ya existe en el sistema (nuevo, devolución, retorno o problema). */
  private consultar(id: number, codigo: string): void {
    this.equipos.porCodigo(codigo).subscribe({
      next: (e) => {
        if (e.codigoTk.toUpperCase() !== codigo) {
          // Coincidió con la serie de otro equipo: el ingreso se hace por código TK
          this.actualizar(id, {
            estado: 'error',
            error: `Coincide con la serie del equipo ${e.codigoTk}; usa el código TK`,
          });
        } else {
          this.actualizar(id, { estado: 'existente', equipo: e });
        }
      },
      error: (err: HttpErrorResponse) =>
        this.actualizar(
          id,
          err.status === 404 ? { estado: 'nuevo' } : { estado: 'error', error: mensajeError(err) },
        ),
    });
  }

  // ---------- edición de filas ----------

  private actualizar(id: number, cambios: Partial<Fila>): void {
    this.filas.update((lista) => lista.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  protected condicionDe(evento: Event): CondicionEquipo {
    return (evento.target as HTMLSelectElement).value as CondicionEquipo;
  }

  protected editar(id: number, campo: 'serie' | 'descripcion' | 'marca', valor: string): void {
    const fila = this.filas().find((f) => f.id === id);
    if (!fila) return;
    const cambios: Partial<Fila> = { [campo]: valor };
    if (campo === 'descripcion') {
      // Si faltaba la marca o las pulgadas, se completan con lo que diga la descripción
      if (!fila.marca.trim()) cambios.marca = marcaDe(valor);
      const atributos = { ...fila.atributos };
      for (const a of this.atributosCat()) {
        if (a.toLowerCase() === 'pulgadas' && !atributos[a]?.trim()) atributos[a] = pulgadasDe(valor);
      }
      cambios.atributos = atributos;
    }
    this.actualizar(id, cambios);
  }

  protected editarAtributo(id: number, nombre: string, valor: string): void {
    const fila = this.filas().find((f) => f.id === id);
    if (!fila) return;
    this.actualizar(id, { atributos: { ...fila.atributos, [nombre]: valor } });
  }

  protected quitar(id: number): void {
    this.filas.update((lista) => lista.filter((f) => f.id !== id));
    this.mensaje.set(null);
    this.entrada()?.nativeElement.focus();
  }

  // ---------- confirmar y registrar ----------

  protected revisar(): void {
    if (!this.listo()) return;
    this.errorEnvio.set(null);
    this.confirmando.set(true);
  }

  /** Cierra el cuadro de confirmación (también con Escape). */
  cancelar(): void {
    if (this.enviando()) return;
    this.confirmando.set(false);
  }

  protected enviar(): void {
    const t = (s: string) => s.trim() || null;

    const items = this.filas().map((f): IngresoItem => {
      const nuevo = f.estado === 'nuevo';
      return {
        codigoTk: f.codigo,
        numeroSerie: nuevo ? t(f.serie) : null,
        marca: nuevo ? t(f.marca) : null,
        descripcion: nuevo ? t(f.descripcion) : null,
        condicion: nuevo ? this.defCondicion() : null,
        atributos: nuevo
          ? Object.fromEntries(
              Object.entries(f.atributos)
                .filter(([, v]) => v.trim() !== '')
                .map(([k, v]) => [k, v.trim()]),
            )
          : {},
      };
    });

    const body: IngresoLoteRequest = {
      categoriaId: this.categoriaId(),
      origen: t(this.origen()),
      guia: t(this.guia()),
      observaciones: t(this.observaciones()),
      items,
    };

    this.enviando.set(true);
    this.ingresos.registrarLote(body).subscribe({
      next: (res) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.filas.set([]);
        this.mensaje.set(null);
        this.resultado.set(res.resultados);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.confirmando.set(false);
        this.errorEnvio.set(mensajeError(e));
      },
    });
  }

  protected nuevoIngreso(): void {
    this.resultado.set(null);
    this.filas.set([]);
    this.mensaje.set(null);
    this.errorEnvio.set(null);
    this.guia.set('');
    this.observaciones.set('');
  }
}
