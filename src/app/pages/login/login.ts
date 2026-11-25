import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="wrap">
      <section class="brand-panel">
        <img class="logo-img" src="logo-tektronic.png" alt="Tektronic" />
        <h1>Almacén X</h1>
        <p class="lead">Inventario, entradas y salidas de equipos en un solo lugar.</p>
        <ul>
          <li>Historial completo de cada equipo</li>
          <li>Estado y ubicación siempre actualizados</li>
          <li>Acceso por roles para todo el equipo</li>
        </ul>
      </section>

      <section class="form-panel">
        <form class="card login-card" [formGroup]="form" (ngSubmit)="entrar()" novalidate>
          <div class="titulo">
            <h2>Iniciar sesión</h2>
            <p class="muted">Ingresa con tu usuario y contraseña</p>
          </div>

          @if (aviso()) {
            <div class="alert alert-ok" role="status">{{ aviso() }}</div>
          }

          @if (error()) {
            <div class="alert alert-error" role="alert">{{ error() }}</div>
          }

          <div class="field">
            <label for="username">Usuario</label>
            <input
              id="username"
              class="input"
              formControlName="username"
              autocomplete="username"
              placeholder="ej. juan.perez"
              [class.invalid]="form.controls.username.touched && form.controls.username.invalid"
            />
            @if (form.controls.username.touched && form.controls.username.invalid) {
              <span class="error">Ingresa tu usuario</span>
            }
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <div class="pw">
              <input
                id="password"
                class="input"
                formControlName="password"
                autocomplete="current-password"
                [type]="verClave() ? 'text' : 'password'"
                [class.invalid]="form.controls.password.touched && form.controls.password.invalid"
              />
              <button type="button" class="btn btn-ghost btn-sm" (click)="verClave.set(!verClave())">
                {{ verClave() ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <span class="error">Ingresa tu contraseña</span>
            }
          </div>

          <button class="btn full" type="submit" [disabled]="cargando()">
            {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; grid-template-columns: 1.1fr 1fr; }

    .brand-panel {
      background: linear-gradient(155deg, var(--sidebar) 0%, #0a3b27 58%, var(--primary) 100%);
      color: #fff;
      padding: 64px 56px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      gap: 18px;
    }
    .logo-img { width: 260px; height: auto; margin: -30px auto 10px; display: block; }
    .brand-panel h1 { font-size: 34px; letter-spacing: -0.02em; }
    .lead { font-size: 16px; color: #e3ebe6; max-width: 420px; }
    .brand-panel ul { text-align: left; list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 12px; color: var(--cream); }
    .brand-panel li { padding-left: 26px; position: relative; }
    .brand-panel li::before {
      content: ''; position: absolute; left: 0; top: 6px;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--cream);
      box-shadow: 0 0 0 4px rgba(242, 232, 218, 0.25);
    }

    .form-panel { display: grid; place-items: center; padding: 32px; }
    .login-card { width: 100%; max-width: 400px; padding: 32px; display: grid; gap: 20px; box-shadow: var(--shadow-lg); }
    .titulo { display: grid; gap: 4px; }
    .pw { display: flex; gap: 6px; align-items: center; }
    .full { width: 100%; height: 42px; }

    @media (max-width: 900px) {
      .wrap { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
    }
  `,
})
export class Login {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Mensaje que deja otra pantalla al cerrar la sesión (por ejemplo, tras transferir la administración). */
  protected readonly aviso = signal<string | null>((history.state as { aviso?: string } | null)?.aviso ?? null);
  protected readonly verClave = signal(false);

  protected entrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim().toLowerCase(), password).subscribe({
      next: () => {
        const volver = this.route.snapshot.queryParamMap.get('volver');
        const destino = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/inventario';
        this.router.navigateByUrl(destino);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        if (e.status === 401) {
          this.error.set('Usuario o contraseña incorrectos');
        } else if (e.status === 0) {
          this.error.set('No se pudo conectar con el servidor');
        } else {
          this.error.set('Ocurrió un error. Intenta de nuevo');
        }
      },
    });
  }
}