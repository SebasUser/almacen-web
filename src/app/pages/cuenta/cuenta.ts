import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { mensajeError } from '../../core/errores';
import { Usuario } from '../../core/models';
import { UsuarioService } from '../../core/usuario.service';

/** La confirmación debe ser igual a la contraseña nueva. */
function coincidenClaves(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nueva')?.value as string | undefined;
  const confirmar = grupo.get('confirmar')?.value as string | undefined;
  return nueva && confirmar && nueva !== confirmar ? { noCoinciden: true } : null;
}

@Component({
  selector: 'app-cuenta',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page estrecha">
      <div class="page-header">
        <div>
          <h1>Mi cuenta</h1>
          <p class="subtitle">Tus datos y tu contraseña</p>
        </div>
      </div>

      @if (perfil(); as p) {
        <section class="card bloque foto-bloque">
          <div class="foto">
            @if (p.foto) {
              <img [src]="p.foto" alt="Tu foto de perfil" />
            } @else {
              <span>{{ iniciales(p.nombre) }}</span>
            }
          </div>
          <div class="foto-info">
            <h3>Foto de perfil</h3>
            <p class="muted">Sube una foto corporativa; puedes subir en formato JPG, PNG o WEBP.</p>
            @if (errorFoto()) {
              <div class="alert alert-error" role="alert">{{ errorFoto() }}</div>
            }
            <div class="row">
              <input #archivo type="file" accept="image/*" hidden (change)="elegirFoto($event)" />
              <button type="button" class="btn btn-secondary" (click)="archivo.click()" [disabled]="subiendoFoto()">
                {{ subiendoFoto() ? 'Subiendo…' : p.foto ? 'Cambiar foto' : 'Subir foto' }}
              </button>
              @if (p.foto) {
                <button type="button" class="btn btn-ghost quitar" (click)="quitarFoto()" [disabled]="subiendoFoto()">
                  Quitar
                </button>
              }
            </div>
          </div>
        </section>

        <section class="card bloque">
          <h3>Mis datos</h3>
          <dl class="grid">
            <div>
              <dt>Nombre</dt>
              <dd>{{ p.nombre }}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{{ p.username }}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>{{ p.rol === 'ADMIN' ? 'Administrador' : 'Usuario' }}</dd>
            </div>
          </dl>
        </section>
      }

      <form class="card bloque form" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <h3>Cambiar contraseña</h3>

        @if (aviso()) {
          <div class="alert alert-ok" role="status">{{ aviso() }}</div>
        }

        <div class="field">
          <label for="actual">Contraseña actual *</label>
          <input
            id="actual"
            class="input"
            formControlName="actual"
            autocomplete="current-password"
            [type]="ver() ? 'text' : 'password'"
            [class.invalid]="invalido(form.controls.actual)"
          />
          @if (invalido(form.controls.actual)) {
            <span class="error">Ingresa tu contraseña actual</span>
          }
        </div>

        <div class="field">
          <label for="nueva">Contraseña nueva *</label>
          <input
            id="nueva"
            class="input"
            formControlName="nueva"
            autocomplete="new-password"
            [type]="ver() ? 'text' : 'password'"
            [class.invalid]="invalido(form.controls.nueva)"
          />
          @if (invalido(form.controls.nueva)) {
            <span class="error">La contraseña debe tener entre 8 y 72 caracteres</span>
          } @else {
            <span class="hint">Mínimo 8 caracteres.</span>
          }
        </div>

        <div class="field">
          <label for="confirmar">Repite la contraseña nueva *</label>
          <input
            id="confirmar"
            class="input"
            formControlName="confirmar"
            autocomplete="new-password"
            [type]="ver() ? 'text' : 'password'"
            [class.invalid]="invalido(form.controls.confirmar) || (form.controls.confirmar.touched && form.hasError('noCoinciden'))"
          />
          @if (form.controls.confirmar.touched && form.hasError('noCoinciden')) {
            <span class="error">Las contraseñas no coinciden</span>
          } @else if (invalido(form.controls.confirmar)) {
            <span class="error">Repite la contraseña nueva</span>
          }
        </div>

        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }

        <div class="row acciones">
          <button type="button" class="btn btn-ghost" (click)="ver.set(!ver())">
            {{ ver() ? 'Ocultar contraseñas' : 'Mostrar contraseñas' }}
          </button>
          <button type="submit" class="btn" [disabled]="guardando()">
            {{ guardando() ? 'Guardando…' : 'Cambiar contraseña' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .estrecha { max-width: 720px; margin: 0 auto; }
    .foto-bloque { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .foto { width: 96px; height: 96px; border-radius: 50%; overflow: hidden; background: var(--cream); color: var(--primary); display: grid; place-items: center; font-size: 30px; font-weight: 700; flex: none; border: 3px solid var(--primary-soft); }
    .foto img { width: 100%; height: 100%; object-fit: cover; }
    .foto-info { display: grid; gap: 8px; flex: 1; min-width: 240px; }
    .foto-info h3 { margin: 0; }
    .quitar { color: var(--danger); }
    .bloque { margin-bottom: 20px; }
    .bloque h3 { margin-bottom: 14px; }
    dl.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin: 0; }
    dt { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
    dd { margin: 0; font-weight: 500; }
    .form { display: grid; gap: 16px; }
    .acciones { justify-content: space-between; }
  `,
})
export class Cuenta {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(UsuarioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  protected readonly subiendoFoto = signal(false);
  protected readonly errorFoto = signal<string | null>(null);

  protected readonly perfil = signal<Usuario | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly ver = signal(false);

  protected readonly form = this.fb.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: [coincidenClaves] },
  );

  private temporizadorAviso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizadorAviso));
    this.svc.perfil().subscribe({
      next: (p) => this.perfil.set(p),
      error: () => this.perfil.set(null),
    });
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }

  /** Recorta la imagen en cuadrado, la reduce a 160 px y la comprime hasta que pese poco. */
  private async prepararFoto(archivo: File): Promise<string> {
    const bitmap = await createImageBitmap(archivo);
    const lado = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - lado) / 2;
    const sy = (bitmap.height - lado) / 2;

    for (const medida of [160, 128, 96]) {
      const lienzo = document.createElement('canvas');
      lienzo.width = medida;
      lienzo.height = medida;
      const ctx = lienzo.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, medida, medida);
      ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, medida, medida);
      for (const calidad of [0.85, 0.7, 0.55, 0.4]) {
        const url = lienzo.toDataURL('image/jpeg', calidad);
        if (url.length <= 12000) {
          bitmap.close();
          return url;
        }
      }
    }
    bitmap.close();
    throw new Error('No se pudo reducir la imagen');
  }

  protected async elegirFoto(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!archivo) return;

    this.errorFoto.set(null);
    if (!archivo.type.startsWith('image/')) {
      this.errorFoto.set('El archivo debe ser una imagen (JPG, PNG o WEBP)');
      return;
    }
    if (archivo.size > 15 * 1024 * 1024) {
      this.errorFoto.set('La imagen es demasiado pesada (máximo 15 MB)');
      return;
    }

    this.subiendoFoto.set(true);
    try {
      const foto = await this.prepararFoto(archivo);
      this.svc.subirFoto(foto).subscribe({
        next: (p) => {
          this.perfil.set(p);
          this.auth.refrescarPerfil();
          this.subiendoFoto.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.errorFoto.set(mensajeError(e));
          this.subiendoFoto.set(false);
        },
      });
    } catch {
      this.errorFoto.set('No se pudo leer la imagen. Prueba con otra');
      this.subiendoFoto.set(false);
    }
  }

  protected quitarFoto(): void {
    this.subiendoFoto.set(true);
    this.errorFoto.set(null);
    this.svc.quitarFoto().subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.auth.refrescarPerfil();
        this.subiendoFoto.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorFoto.set(mensajeError(e));
        this.subiendoFoto.set(false);
      },
    });
  }

  protected invalido(control: AbstractControl): boolean {
    return control.touched && control.invalid;
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { actual, nueva } = this.form.getRawValue();
    if (actual === nueva) {
      this.error.set('La nueva contraseña debe ser distinta de la actual');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    this.svc.cambiarPassword(actual, nueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.form.reset({ actual: '', nueva: '', confirmar: '' });
        this.ver.set(false);
        this.aviso.set('Tu contraseña se actualizó correctamente');
        clearTimeout(this.temporizadorAviso);
        this.temporizadorAviso = setTimeout(() => this.aviso.set(null), 6000);
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }
}
