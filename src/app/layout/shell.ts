import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

type Icono = 'inventario' | 'movimientos' | 'ingreso' | 'escanear' | 'lote' | 'usuarios' | 'eliminados';

interface ItemMenu {
  ruta: string;
  texto: string;
  icono: Icono;
}

interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <img class="logo-img" src="logo-tektronic.png" alt="Tektronic" />
          <div class="marca">
            <strong>Almacén X</strong>
            <small>Sistema de inventario</small>
          </div>
        </div>

        <nav aria-label="Menú principal">
          @for (g of grupos(); track g.titulo) {
            <div class="grupo">
              <div class="grupo-titulo">{{ g.titulo }}</div>
              @for (i of g.items; track i.ruta) {
                <a [routerLink]="i.ruta" routerLinkActive="active" [title]="i.texto">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    @switch (i.icono) {
                      @case ('inventario') {
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M3 10h18M9 4v16" />
                      }
                      @case ('movimientos') {
                        <path d="M7 4v14M7 18l-3-3M7 18l3-3" />
                        <path d="M17 20V6M17 6l-3 3M17 6l3 3" />
                      }
                      @case ('ingreso') {
                        <path d="M12 3v12M7 10l5 5 5-5" />
                        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                      }
                      @case ('escanear') {
                        <path d="M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12" />
                      }
                      @case ('lote') {
                        <path d="M12 3l9 5-9 5-9-5 9-5z" />
                        <path d="M3 13l9 5 9-5" />
                      }
                      @case ('usuarios') {
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                      }
                      @case ('eliminados') {
                        <path d="M4 7h16M10 11v6M14 11v6" />
                        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                      }
                    }
                  </svg>
                  <span>{{ i.texto }}</span>
                </a>
              }
            </div>
          }
        </nav>

        <div class="pie">
          <a class="cuenta" routerLink="/cuenta" routerLinkActive="active" title="Mi cuenta">
            <div class="avatar">
              @if (auth.sesion()?.foto; as f) {
                <img [src]="f" alt="" />
              } @else {
                {{ iniciales() }}
              }
            </div>
            <div class="datos">
              <strong>{{ auth.sesion()?.nombre }}</strong>
              <small>{{ auth.esAdmin() ? 'Administrador' : 'Usuario' }} · Mi cuenta</small>
            </div>
          </a>
          @if (auth.esAdmin()) {
            <a class="enlace" routerLink="/usuarios" routerLinkActive="active" title="Usuarios">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Usuarios</span>
            </a>
          }
          <button class="salir" (click)="salir()" title="Cerrar sesión">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main class="contenido">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }

    .sidebar {
      background: var(--sidebar);
      color: var(--sidebar-text);
      padding: 36px 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 34px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }

    .brand { display: grid; gap: 12px; padding: 0 8px; justify-items: center; text-align: center; }
    .logo-img { width: 170px; height: auto; margin: 0 0 -6px; display: block; }
    .marca { display: grid; line-height: 1.25; min-width: 0; justify-items: center; }
    .marca strong { color: #fff; font-size: 16px; font-weight: 700; }
    .marca small { color: #8a8a8a; font-size: 11.5px; }

    nav { display: grid; gap: 18px; flex: 1; align-content: start; }
    .grupo { display: grid; gap: 2px; }
    .grupo-titulo { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: #6f6f6f; padding: 0 12px 6px; }
    nav a {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 12px;
      border-radius: var(--radius-sm);
      color: var(--sidebar-text);
      font-weight: 500;
      transition: background 0.12s, color 0.12s;
    }
    nav a:hover { background: rgba(255, 255, 255, 0.07); text-decoration: none; color: #fff; }
    nav a.active { background: var(--primary); color: var(--sidebar-active); }

    .pie { display: grid; gap: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; }
    .enlace { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: var(--radius-sm); color: var(--sidebar-text); font-weight: 500; }
    .enlace:hover { background: rgba(255, 255, 255, 0.07); text-decoration: none; color: #fff; }
    .enlace.active { background: var(--primary); color: var(--sidebar-active); }
    .cuenta { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius-sm); color: var(--sidebar-text); }
    .cuenta:hover { background: rgba(255, 255, 255, 0.07); text-decoration: none; }
    .cuenta.active { background: rgba(255, 255, 255, 0.1); }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--cream); color: var(--primary); display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .datos { display: grid; line-height: 1.25; min-width: 0; }
    .datos strong { color: #fff; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .datos small { color: #8a8a8a; font-size: 11.5px; }
    .salir {
      display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 9px 12px; border: 0; border-radius: var(--radius-sm);
      background: transparent; color: var(--sidebar-text); font: inherit; font-weight: 500; cursor: pointer;
    }
    .salir:hover { background: rgba(192, 54, 44, 0.18); color: #ffb4ad; }

    .contenido { min-width: 0; }

    @media (max-width: 800px) {
      .layout { grid-template-columns: 64px minmax(0, 1fr); }
      .marca, .grupo-titulo, nav a span, .enlace span, .datos, .salir span { display: none; }
      .brand, nav a, .enlace, .cuenta, .salir { justify-content: center; }
      .brand { justify-items: center; padding: 0; }
      .logo-img { width: 60px; margin: 0; }
      .grupo { padding-top: 0; }
      .grupo + .grupo { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 10px; }
      nav { gap: 10px; }
    }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);

  constructor() {
    // El nombre puede haberse cambiado desde Usuarios (en otra sesión o pestaña)
    this.auth.refrescarPerfil();
  }

  /** Menú agrupado por tarea; «Equipos eliminados» solo lo ve el ADMIN (Usuarios va aparte, junto a la cuenta). */
  protected readonly grupos = computed<GrupoMenu[]>(() => {
    const gestion: ItemMenu[] = [
      { ruta: '/inventario', texto: 'Inventario', icono: 'inventario' },
      { ruta: '/movimientos', texto: 'Movimientos', icono: 'movimientos' },
    ];
    if (this.auth.esAdmin()) {
      gestion.push({ ruta: '/eliminados', texto: 'Equipos eliminados', icono: 'eliminados' });
    }
    const grupos: GrupoMenu[] = [
      { titulo: 'Gestión', items: gestion },
      {
        titulo: 'Registro rápido',
        items: [
          { ruta: '/ingreso', texto: 'Ingreso', icono: 'ingreso' },
          { ruta: '/escanear', texto: 'Escanear', icono: 'escanear' },
          { ruta: '/lote', texto: 'Por lote', icono: 'lote' },
        ],
      },
    ];
    return grupos;
  });

  protected readonly iniciales = computed(() => {
    const nombre = this.auth.sesion()?.nombre ?? '';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  });

  protected salir(): void {
    this.auth.logout();
  }
}
