import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/errores';
import { EquipoService } from '../../core/equipo.service';

@Component({
  selector: 'app-escanear',
  imports: [RouterLink],
  template: `
    <div class="page estrecha">
      <div class="page-header">
        <div>
          <h1>Escanear equipo</h1>
          <p class="subtitle">Escanea la etiqueta (o escribe el código) para abrir la ficha del equipo</p>
        </div>
      </div>

      <div class="card">
        <div class="field">
          <label for="codigo">Código del equipo</label>
          <div class="fila">
            <input
              #entrada
              id="codigo"
              class="input grande"
              autocomplete="off"
              placeholder="Escanea aquí…"
              [value]="valor()"
              (input)="valor.set(valorDe($event))"
              (keydown.enter)="buscar()"
            />
            <button class="btn" (click)="buscar()" [disabled]="buscando()">
              {{ buscando() ? 'Buscando…' : 'Buscar' }}
            </button>
          </div>
          <span class="hint">El lector de código de barras escribe el código y pulsa Enter solo.</span>
        </div>

        @if (noExiste(); as c) {
          <div class="alert aviso-no" role="alert">
            <span>No existe ningún equipo con el código <strong>{{ c }}</strong>.</span>
            <a class="btn btn-secondary btn-sm" [routerLink]="['/inventario/nuevo']" [queryParams]="{ codigo: c }">
              Registrarlo con este código
            </a>
          </div>
        }
        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }
      </div>
    </div>
  `,
  styles: `
    .estrecha { max-width: 720px; margin: 0 auto; }
    .fila { display: flex; gap: 10px; align-items: center; }
    .input.grande { height: 52px; font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }
    .alert { margin-top: 16px; }
    .aviso-no { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; background: #fef3dc; color: #7a3b05; border: 1px solid #f1d49b; }
    a.btn { text-decoration: none; }
    a.btn:hover { text-decoration: none; }
  `,
})
export class Escanear {
  private readonly equipos = inject(EquipoService);
  private readonly router = inject(Router);

  private readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');

  protected readonly valor = signal('');
  protected readonly buscando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly noExiste = signal<string | null>(null);

  constructor() {
    afterNextRender(() => this.entrada()?.nativeElement.focus());
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected buscar(): void {
    const codigo = this.valor().trim();
    if (!codigo || this.buscando()) return;

    this.buscando.set(true);
    this.error.set(null);
    this.noExiste.set(null);

    this.equipos.porCodigo(codigo).subscribe({
      next: (e) => this.router.navigate(['/inventario', e.id]),
      error: (e: HttpErrorResponse) => {
        this.buscando.set(false);
        if (e.status === 404) {
          this.noExiste.set(codigo.toUpperCase());
        } else {
          this.error.set(mensajeError(e));
        }
        // Deja el campo listo para el siguiente escaneo
        const campo = this.entrada()?.nativeElement;
        campo?.focus();
        campo?.select();
      },
    });
  }
}
