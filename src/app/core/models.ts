export type Rol = 'ADMIN' | 'USUARIO';
export type EstadoEquipo = 'DISPONIBLE' | 'ALQUILADO' | 'VENDIDO' | 'ASIGNADO' | 'BAJA';
export type CondicionEquipo = 'OPERATIVO' | 'SOLO_VENTA' | 'NO_OPERATIVO' | 'POR_REVISAR';
export type UbicacionTipo = 'ALMACEN_X' | 'CLIENTE' | 'PERSONAL';

export interface LoginResponse {
  token: string;
  username: string;
  nombre: string;
  rol: Rol;
  foto?: string | null;
}

export type Sesion = LoginResponse;

export interface Pagina<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Equipo {
  id: number;
  categoriaId: number;
  categoria: string;
  codigoTk: string;
  numeroSerie: string | null;
  marca: string | null;
  descripcion: string | null;
  estado: EstadoEquipo;
  condicion: CondicionEquipo;
  ubicacionTipo: UbicacionTipo;
  ubicacionDetalle: string | null;
  fechaCompra: string | null;
  proveedor: string | null;
  factura: string | null;
  guia: string | null;
  costoUsd: number | null;
  costoPen: number | null;
  tipoCambio: number | null;
  garantia: string | null;
  observaciones: string | null;
  atributos: Record<string, string>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Categoria {
  id: number;
  nombre: string;
  atributos: string[];
}

export interface EquipoRequest {
  categoriaId: number;
  codigoTk: string;
  numeroSerie: string | null;
  marca: string | null;
  descripcion: string | null;
  fechaCompra: string | null;
  proveedor: string | null;
  factura: string | null;
  guia: string | null;
  costoUsd: number | null;
  costoPen: number | null;
  tipoCambio: number | null;
  garantia: string | null;
  observaciones: string | null;
  condicion: CondicionEquipo;
  /** Solo al crear: de dónde llega el equipo (queda en su movimiento de entrada). */
  origenIngreso?: string | null;
  atributos: Record<string, string>;
}
export type TipoMovimiento =
  | 'ENTRADA'
  | 'SALIDA_ALQUILER'
  | 'SALIDA_VENTA'
  | 'ASIGNACION_PERSONAL'
  | 'DEVOLUCION_CLIENTE'
  | 'RETORNO_PERSONAL';

export interface Movimiento {
  id: number;
  equipoId: number;
  codigoTk: string;
  tipo: TipoMovimiento;
  fecha: string;
  origenDestino: string | null;
  oc: string | null;
  rq: string | null;
  guia: string | null;
  factura: string | null;
  observaciones: string | null;
  usuario: string | null;
  anulado: boolean;
  anuladoPor: string | null;
  fechaAnulacion: string | null;
  motivoAnulacion: string | null;
}

export interface MovimientoRequest {
  tipo: TipoMovimiento;
  origenDestino: string | null;
  fecha: string | null;
  oc: string | null;
  rq: string | null;
  guia: string | null;
  factura: string | null;
  observaciones: string | null;
}

export interface EquipoEliminado {
  id: number;
  equipoId: number;
  codigoTk: string;
  categoria: string;
  marca: string | null;
  numeroSerie: string | null;
  descripcion: string | null;
  estado: EstadoEquipo;
  ubicacion: string | null;
  totalMovimientos: number;
  detalle: string;
  motivo: string;
  eliminadoPor: string;
  fechaEliminacion: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  username: string;
  rol: Rol;
  activo: boolean;
  foto?: string | null;
}

export interface UsuarioCrearRequest {
  nombre: string;
  username: string;
  password: string;
  rol: Rol;
}

export interface UsuarioActualizarRequest {
  nombre: string;
  rol: Rol;
  activo: boolean;
  username: string;
}

export type AccionTransferencia = 'DEJAR_COMO_USUARIO' | 'DESACTIVAR';

export interface MovimientoLoteRequest extends MovimientoRequest {
  equipoIds: number[];
}

export interface IngresoItem {
  codigoTk: string;
  numeroSerie: string | null;
  marca: string | null;
  descripcion: string | null;
  condicion?: CondicionEquipo | null;
  atributos: Record<string, string>;
}

export interface IngresoLoteRequest {
  categoriaId: number;
  origen: string | null;
  guia: string | null;
  observaciones: string | null;
  items: IngresoItem[];
}

export interface IngresoResultado {
  codigoTk: string;
  equipoId: number;
  accion: 'NUEVO' | 'DEVOLUCION' | 'RETORNO';
}

export interface IngresoLoteResponse {
  resultados: IngresoResultado[];
}

export interface UsuarioResumen {
  id: number;
  nombre: string;
}
