import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/errores';
import { AccionTransferencia, Rol, Usuario } from '../../core/models';
import { UsuarioService } from '../../core/usuario.service';

type Modal = 'crear' | 'editar' | 'clave' | 'transferir' | null;
type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule],
  host: { '(document:keydown.escape)': 'cerrar()' },
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Usuarios</h1>
          <p class="subtitle">{{ usuarios().length }} usuarios registrados</p>
        </div>
        <div class="row">
          <button class="btn btn-secondary" (click)="abrirTransferir()">Transferir administración</button>
          <button class="btn" (click)="abrirCrear()">+ Nuevo usuario</button>
        </div>
      </div>

      @if (aviso()) {
        <div class="alert alert-ok" role="status">{{ aviso() }}</div>
      }
      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      @if (cargando()) {
        <p class="muted">Cargando…</p>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (u of usuarios(); track u.id) {
                <tr [class.inactivo]="!u.activo">
                  <td>
                    <strong>{{ u.nombre }}</strong>
                    @if (esYo(u)) {
                      <span class="tu">(tú)</span>
                    }
                  </td>
                  <td>{{ u.username }}</td>
                  <td>
                    <span [class]="'rol rol-' + u.rol.toLowerCase()">{{ u.rol === 'ADMIN' ? 'Administrador' : 'Usuario' }}</span>
                  </td>
                  <td>
                    <span [class]="'badge ' + (u.activo ? 'badge-disponible' : 'badge-baja')">
                      {{ u.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td>
                    <div class="celda-acciones">
                      <button class="btn btn-secondary btn-sm" (click)="abrirEditar(u)">Editar</button>
                      <button class="btn btn-secondary btn-sm" (click)="abrirClave(u)">Contraseña</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="vacio">No hay usuarios registrados.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="muted nota">
          Los usuarios no se eliminan: se desactivan, para conservar quién registró cada movimiento.
        </p>
      }
    </div>

    @if (modal() !== null) {
      <div class="overlay" (click)="cerrar()">
        <div class="modal card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          @if (modal() === 'crear') {
            <form class="form" [formGroup]="formCrear" (ngSubmit)="crear()" novalidate>
              <h2>Nuevo usuario</h2>

              <div class="field">
                <label for="c-nombre">Nombre completo *</label>
                <input
                  id="c-nombre"
                  class="input"
                  formControlName="nombre"
                  placeholder="ej. Juan Pérez"
                  [class.invalid]="invalido(formCrear.controls.nombre)"
                />
                @if (invalido(formCrear.controls.nombre)) {
                  <span class="error">Ingresa el nombre (máximo 100 caracteres)</span>
                }
              </div>

              <div class="field">
                <label for="c-username">Usuario *</label>
                <input
                  id="c-username"
                  class="input"
                  formControlName="username"
                  autocomplete="off"
                  placeholder="ej. juan.perez"
                  [class.invalid]="invalido(formCrear.controls.username)"
                />
                @if (invalido(formCrear.controls.username)) {
                  <span class="error">Usa de 3 a 50 caracteres: letras, números, punto, guion o guion bajo</span>
                } @else {
                  <span class="hint">Con este nombre iniciará sesión. Se guarda en minúsculas.</span>
                }
              </div>

              <div class="field">
                <label for="c-password">Contraseña inicial *</label>
                <div class="pw">
                  <input
                    id="c-password"
                    class="input"
                    formControlName="password"
                    autocomplete="new-password"
                    [type]="verClave() ? 'text' : 'password'"
                    [class.invalid]="invalido(formCrear.controls.password)"
                  />
                  <button type="button" class="btn btn-ghost btn-sm" (click)="verClave.set(!verClave())">
                    {{ verClave() ? 'Ocultar' : 'Mostrar' }}
                  </button>
                </div>
                @if (invalido(formCrear.controls.password)) {
                  <span class="error">La contraseña debe tener entre 8 y 72 caracteres</span>
                } @else {
                  <span class="hint">Mínimo 8 caracteres. La persona podrá cambiarla en "Mi cuenta".</span>
                }
              </div>

              <div class="field">
                <label for="c-rol">Rol *</label>
                <select id="c-rol" class="input" formControlName="rol">
                  <option value="USUARIO">Usuario: ve, registra equipos y movimientos</option>
                  <option value="ADMIN">Administrador: además edita, elimina y gestiona usuarios</option>
                </select>
              </div>

              @if (errorModal()) {
                <div class="alert alert-error" role="alert">{{ errorModal() }}</div>
              }
              <div class="row acciones">
                <button type="button" class="btn btn-secondary" (click)="cerrar()" [disabled]="guardando()">Cancelar</button>
                <button type="submit" class="btn" [disabled]="guardando()">
                  {{ guardando() ? 'Creando…' : 'Crear usuario' }}
                </button>
              </div>
            </form>
          }

          @if (modal() === 'editar') {
            <form class="form" [formGroup]="formEditar" (ngSubmit)="editar()" novalidate>
              <h2>Editar usuario</h2>
              <div class="field">
                <label for="e-username">Usuario (para iniciar sesión) *</label>
                <input
                  id="e-username"
                  class="input"
                  formControlName="username"
                  autocomplete="off"
                  [class.invalid]="invalido(formEditar.controls.username)"
                />
                @if (invalido(formEditar.controls.username)) {
                  <span class="error">Usa de 3 a 50 caracteres: letras, números, punto, guion o guion bajo</span>
                } @else if (usuarioCambiado()) {
                  <span class="hint">
                    Si lo cambias, la persona deberá ingresar de nuevo con el usuario nuevo (si eres tú, se cerrará
                    tu sesión). El historial no se pierde.
                  </span>
                }
              </div>

              <div class="field">
                <label for="e-nombre">Nombre completo *</label>
                <input
                  id="e-nombre"
                  class="input"
                  formControlName="nombre"
                  [class.invalid]="invalido(formEditar.controls.nombre)"
                />
                @if (invalido(formEditar.controls.nombre)) {
                  <span class="error">Ingresa el nombre (máximo 100 caracteres)</span>
                }
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="e-rol">Rol</label>
                  <select id="e-rol" class="input" formControlName="rol">
                    <option value="USUARIO">Usuario</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <div class="field">
                  <label for="e-estado">Estado</label>
                  <select id="e-estado" class="input" formControlName="estado">
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo (no puede ingresar)</option>
                  </select>
                </div>
              </div>

              @if (seleccionado() && esYo(seleccionado()!)) {
                <p class="hint">No puedes cambiar tu propio rol ni desactivar tu propia cuenta.</p>
              }

              @if (errorModal()) {
                <div class="alert alert-error" role="alert">{{ errorModal() }}</div>
              }
              <div class="row acciones">
                <button type="button" class="btn btn-secondary" (click)="cerrar()" [disabled]="guardando()">Cancelar</button>
                <button type="submit" class="btn" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
                </button>
              </div>
            </form>
          }

          @if (modal() === 'clave') {
            <form class="form" [formGroup]="formClave" (ngSubmit)="restablecer()" novalidate>
              <h2>Restablecer contraseña</h2>
              <p class="muted">
                Nueva contraseña para <strong>{{ seleccionado()?.nombre }}</strong> ({{ seleccionado()?.username }}).
                La contraseña anterior dejará de funcionar.
              </p>

              <div class="field">
                <label for="k-password">Nueva contraseña *</label>
                <div class="pw">
                  <input
                    id="k-password"
                    class="input"
                    formControlName="nuevaPassword"
                    autocomplete="new-password"
                    [type]="verClave() ? 'text' : 'password'"
                    [class.invalid]="invalido(formClave.controls.nuevaPassword)"
                  />
                  <button type="button" class="btn btn-ghost btn-sm" (click)="verClave.set(!verClave())">
                    {{ verClave() ? 'Ocultar' : 'Mostrar' }}
                  </button>
                </div>
                @if (invalido(formClave.controls.nuevaPassword)) {
                  <span class="error">La contraseña debe tener entre 8 y 72 caracteres</span>
                } @else {
                  <span class="hint">Mínimo 8 caracteres.</span>
                }
              </div>

              @if (errorModal()) {
                <div class="alert alert-error" role="alert">{{ errorModal() }}</div>
              }
              <div class="row acciones">
                <button type="button" class="btn btn-secondary" (click)="cerrar()" [disabled]="guardando()">Cancelar</button>
                <button type="submit" class="btn" [disabled]="guardando()">
                  {{ guardando() ? 'Guardando…' : 'Restablecer' }}
                </button>
              </div>
            </form>
          }

          @if (modal() === 'transferir') {
            <form class="form" [formGroup]="formTransferir" (ngSubmit)="transferir()" novalidate>
              <h2>Transferir la administración</h2>
              <p class="muted">
                Úsalo cuando cambia la persona que administra el sistema. Los dos cambios se hacen a la vez, así
                nunca te quedas sin administrador.
              </p>

              <div class="field">
                <label for="t-destino">1. ¿Quién será el nuevo administrador? *</label>
                <select
                  id="t-destino"
                  class="input"
                  formControlName="destinoId"
                  [class.invalid]="invalido(formTransferir.controls.destinoId)"
                >
                  <option [ngValue]="0" disabled>Selecciona a la persona</option>
                  @for (c of candidatos(); track c.id) {
                    <option [ngValue]="c.id">
                      {{ c.nombre }} ({{ c.username }}){{ c.rol === 'ADMIN' ? ' · ya es administrador' : '' }}
                    </option>
                  }
                </select>
                @if (invalido(formTransferir.controls.destinoId)) {
                  <span class="error">Selecciona a la persona</span>
                } @else if (candidatos().length === 0) {
                  <span class="hint">No hay otros usuarios activos. Crea primero la cuenta de la persona nueva.</span>
                }
              </div>

              <fieldset class="opciones">
                <legend>2. ¿Qué pasa con tu cuenta? *</legend>
                <label class="opcion">
                  <input type="radio" formControlName="accion" value="DEJAR_COMO_USUARIO" />
                  <span>
                    <strong>Dejarla como Usuario</strong><br />
                    <small class="muted">Sigues pudiendo trabajar con el inventario, sin permisos de administrador.</small>
                  </span>
                </label>
                <label class="opcion">
                  <input type="radio" formControlName="accion" value="DESACTIVAR" />
                  <span>
                    <strong>Desactivarla</strong><br />
                    <small class="muted">Para cuando te retiras: ya no podrás ingresar.</small>
                  </span>
                </label>
              </fieldset>

              <div class="field">
                <label for="t-password">3. Escribe tu contraseña para confirmar *</label>
                <div class="pw">
                  <input
                    id="t-password"
                    class="input"
                    formControlName="password"
                    autocomplete="current-password"
                    [type]="verClave() ? 'text' : 'password'"
                    [class.invalid]="invalido(formTransferir.controls.password)"
                  />
                  <button type="button" class="btn btn-ghost btn-sm" (click)="verClave.set(!verClave())">
                    {{ verClave() ? 'Ocultar' : 'Mostrar' }}
                  </button>
                </div>
                @if (invalido(formTransferir.controls.password)) {
                  <span class="error">Escribe tu contraseña</span>
                }
              </div>

              @if (resumenTransferencia(); as r) {
                <div class="alert resumen">{{ r }}</div>
              }
              @if (errorModal()) {
                <div class="alert alert-error" role="alert">{{ errorModal() }}</div>
              }
              <div class="row acciones">
                <button type="button" class="btn btn-secondary" (click)="cerrar()" [disabled]="guardando()">Cancelar</button>
                <button type="submit" class="btn btn-danger" [disabled]="guardando()">
                  {{ guardando() ? 'Transfiriendo…' : 'Transferir y cerrar mi sesión' }}
                </button>
              </div>
            </form>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .nota { margin-top: 12px; font-size: 12px; }
    .alert { margin-bottom: 16px; }
    .vacio { text-align: center; padding: 40px 16px !important; color: var(--text-muted); }
    tr.inactivo td { color: var(--text-muted); }
    .tu { margin-left: 6px; color: var(--text-muted); font-size: 12px; }
    .celda-acciones { display: inline-flex; gap: 6px; white-space: nowrap; }

    .rol { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .rol-admin { background: var(--primary-soft); color: var(--primary); }
    .rol-usuario { background: #ececec; color: #444; }

    .overlay { position: fixed; inset: 0; background: rgba(25, 25, 25, 0.55); display: grid; place-items: center; padding: 16px; z-index: 50; }
    .modal { width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
    .form { display: grid; gap: 16px; }
    .pw { display: flex; gap: 6px; align-items: center; }
    .acciones { justify-content: flex-end; margin-top: 4px; }
    .opciones { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; display: grid; gap: 10px; margin: 0; }
    .opciones legend { font-weight: 500; font-size: 13px; padding: 0 6px; }
    .opcion { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
    .opcion input { margin-top: 4px; accent-color: var(--primary); }
    .resumen { background: var(--primary-soft); color: var(--primary); border: 1px solid #b9dccb; margin-bottom: 0; }
  `,
})
export class Usuarios {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(UsuarioService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly modal = signal<Modal>(null);
  protected readonly seleccionado = signal<Usuario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorModal = signal<string | null>(null);
  protected readonly verClave = signal(false);

  protected readonly formCrear = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    rol: ['USUARIO' as Rol],
  });

  protected readonly formEditar = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)]],
    rol: ['USUARIO' as Rol],
    estado: ['ACTIVO' as EstadoUsuario],
  });

  protected readonly formClave = this.fb.group({
    nuevaPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });

  protected readonly formTransferir = this.fb.group({
    destinoId: [0, [Validators.min(1)]],
    accion: ['DEJAR_COMO_USUARIO' as AccionTransferencia],
    password: ['', [Validators.required]],
  });

  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizadorAviso));
    this.cargar();
  }

  protected invalido(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  protected esYo(u: Usuario): boolean {
    return u.username === this.auth.sesion()?.username;
  }

  private cargar(): void {
    this.svc.listar().subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  // ---------- abrir y cerrar cuadros ----------

  protected abrirCrear(): void {
    this.formCrear.reset({ nombre: '', username: '', password: '', rol: 'USUARIO' });
    this.abrir('crear', null);
  }

  protected abrirEditar(u: Usuario): void {
    this.formEditar.reset({
      nombre: u.nombre,
      username: u.username,
      rol: u.rol,
      estado: u.activo ? 'ACTIVO' : 'INACTIVO',
    });
    // Uno mismo no puede cambiarse el rol ni desactivarse (la API también lo impide)
    if (this.esYo(u)) {
      this.formEditar.controls.rol.disable();
      this.formEditar.controls.estado.disable();
    } else {
      this.formEditar.controls.rol.enable();
      this.formEditar.controls.estado.enable();
    }
    this.abrir('editar', u);
  }

  protected abrirClave(u: Usuario): void {
    this.formClave.reset({ nuevaPassword: '' });
    this.abrir('clave', u);
  }

  protected abrirTransferir(): void {
    this.formTransferir.reset({ destinoId: 0, accion: 'DEJAR_COMO_USUARIO', password: '' });
    this.abrir('transferir', null);
  }

  /** Personas activas a quienes se puede entregar la administración (todas menos uno mismo). */
  protected candidatos(): Usuario[] {
    return this.usuarios().filter((u) => u.activo && !this.esYo(u));
  }

  protected resumenTransferencia(): string {
    const v = this.formTransferir.getRawValue();
    const destino = this.usuarios().find((u) => u.id === v.destinoId);
    if (!destino) return '';
    const cuenta = v.accion === 'DESACTIVAR' ? 'se desactivará' : 'quedará como Usuario';
    return `${destino.nombre} será administrador/a y tu cuenta ${cuenta}. Se cerrará tu sesión.`;
  }

  protected usuarioCambiado(): boolean {
    const u = this.seleccionado();
    return !!u && this.formEditar.controls.username.value.trim().toLowerCase() !== u.username;
  }

  private abrir(modal: Modal, u: Usuario | null): void {
    this.errorModal.set(null);
    this.verClave.set(false);
    this.seleccionado.set(u);
    this.modal.set(modal);
  }

  /** Cierra el cuadro abierto (también con la tecla Escape). */
  cerrar(): void {
    if (this.guardando()) return;
    this.modal.set(null);
  }

  // ---------- acciones ----------

  protected crear(): void {
    if (this.formCrear.invalid) {
      this.formCrear.markAllAsTouched();
      return;
    }
    const v = this.formCrear.getRawValue();
    this.iniciar();
    this.svc
      .crear({ nombre: v.nombre.trim(), username: v.username.trim(), password: v.password, rol: v.rol })
      .subscribe({
        next: (u) => this.terminar(`Usuario ${u.username} creado`),
        error: (e: HttpErrorResponse) => this.fallar(e),
      });
  }

  protected editar(): void {
    const u = this.seleccionado();
    if (!u) return;
    if (this.formEditar.invalid) {
      this.formEditar.markAllAsTouched();
      return;
    }
    const v = this.formEditar.getRawValue();
    const cambioUsuario = this.usuarioCambiado();
    this.iniciar();
    this.svc
      .actualizar(u.id, {
        nombre: v.nombre.trim(),
        username: v.username.trim(),
        rol: v.rol,
        activo: v.estado === 'ACTIVO',
      })
      .subscribe({
        next: (r) => {
          if (cambioUsuario && this.esYo(u)) {
            // Su usuario cambió: la sesión actual ya no sirve y debe ingresar de nuevo
            this.guardando.set(false);
            this.auth.logout(true, `Tu usuario ahora es ${r.username}. Ingresa de nuevo con el usuario nuevo.`);
            return;
          }
          if (this.esYo(u)) this.auth.refrescarPerfil();
          this.terminar(
            cambioUsuario
              ? `Usuario actualizado: ahora es ${r.username}. La persona deberá ingresar de nuevo con el usuario nuevo`
              : `Usuario ${r.username} actualizado`,
          );
        },
        error: (e: HttpErrorResponse) => this.fallar(e),
      });
  }

  protected restablecer(): void {
    const u = this.seleccionado();
    if (!u) return;
    if (this.formClave.invalid) {
      this.formClave.markAllAsTouched();
      return;
    }
    this.iniciar();
    this.svc.restablecerPassword(u.id, this.formClave.getRawValue().nuevaPassword).subscribe({
      next: () => this.terminar(`Contraseña de ${u.username} restablecida`),
      error: (e: HttpErrorResponse) => this.fallar(e),
    });
  }

  protected transferir(): void {
    if (this.formTransferir.invalid) {
      this.formTransferir.markAllAsTouched();
      return;
    }
    const v = this.formTransferir.getRawValue();
    const destino = this.usuarios().find((u) => u.id === v.destinoId);
    this.iniciar();
    this.svc.transferirAdministracion(v.destinoId, v.accion, v.password).subscribe({
      next: () => {
        this.guardando.set(false);
        const cuenta =
          v.accion === 'DESACTIVAR'
            ? 'Tu cuenta quedó desactivada.'
            : 'Tu cuenta ahora es de tipo Usuario; ingresa de nuevo para ver el cambio.';
        this.auth.logout(true, `Administración transferida a ${destino?.nombre ?? 'la persona elegida'}. ${cuenta}`);
      },
      error: (e: HttpErrorResponse) => this.fallar(e),
    });
  }

  private iniciar(): void {
    this.guardando.set(true);
    this.errorModal.set(null);
  }

  private terminar(mensaje: string): void {
    this.guardando.set(false);
    this.modal.set(null);
    this.aviso.set(mensaje);
    clearTimeout(this.temporizadorAviso);
    this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 5000);
    this.cargar();
  }

  private fallar(e: HttpErrorResponse): void {
    this.guardando.set(false);
    this.errorModal.set(mensajeError(e));
  }
}
