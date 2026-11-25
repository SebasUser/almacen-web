import { CondicionEquipo, Equipo, EstadoEquipo, TipoMovimiento } from './models';

export const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  ENTRADA: 'Entrada al almacén',
  SALIDA_ALQUILER: 'Salida por alquiler',
  SALIDA_VENTA: 'Salida por venta',
  ASIGNACION_PERSONAL: 'Asignación a personal',
  DEVOLUCION_CLIENTE: 'Devolución de cliente',
  RETORNO_PERSONAL: 'Retorno de personal',
};

/** Color de la línea de tiempo (reutiliza los colores de estado). */
export const CLASE_TIPO: Record<TipoMovimiento, string> = {
  ENTRADA: 'disponible',
  SALIDA_ALQUILER: 'alquilado',
  SALIDA_VENTA: 'vendido',
  ASIGNACION_PERSONAL: 'asignado',
  DEVOLUCION_CLIENTE: 'disponible',
  RETORNO_PERSONAL: 'disponible',
};

/** Movimientos que se pueden registrar según el estado (la API valida lo mismo). */
export const ACCIONES_POR_ESTADO: Record<EstadoEquipo, TipoMovimiento[]> = {
  DISPONIBLE: ['SALIDA_ALQUILER', 'SALIDA_VENTA', 'ASIGNACION_PERSONAL'],
  ALQUILADO: ['DEVOLUCION_CLIENTE', 'SALIDA_VENTA'],
  ASIGNADO: ['RETORNO_PERSONAL'],
  VENDIDO: [],
  BAJA: [],
};

export function requiereDestino(tipo: TipoMovimiento): boolean {
  return tipo === 'SALIDA_ALQUILER' || tipo === 'SALIDA_VENTA' || tipo === 'ASIGNACION_PERSONAL';
}

export function esSalida(tipo: TipoMovimiento): boolean {
  return tipo === 'SALIDA_ALQUILER' || tipo === 'SALIDA_VENTA';
}

export function etiquetaDestino(tipo: TipoMovimiento): string {
  return tipo === 'ASIGNACION_PERSONAL' ? 'Persona' : 'Cliente';
}

/** Situación del equipo (su estado según los movimientos). «Disponible» se muestra como «En almacén» para no confundirlo con la condición. */
export const ETIQUETA_ESTADO: Record<EstadoEquipo, string> = {
  DISPONIBLE: 'En almacén',
  ALQUILADO: 'Alquilado',
  ASIGNADO: 'Asignado',
  VENDIDO: 'Vendido',
  BAJA: 'De baja',
};

export function textoEstado(valor: string): string {
  return ETIQUETA_ESTADO[valor as EstadoEquipo] ?? valor.charAt(0) + valor.slice(1).toLowerCase();
}

export const CONDICIONES: CondicionEquipo[] = ['OPERATIVO', 'SOLO_VENTA', 'NO_OPERATIVO', 'POR_REVISAR'];

export const ETIQUETA_CONDICION: Record<CondicionEquipo, string> = {
  OPERATIVO: 'Operativo',
  SOLO_VENTA: 'Solo venta',
  NO_OPERATIVO: 'No operativo',
  POR_REVISAR: 'Por revisar',
};

export const AYUDA_CONDICION: Record<CondicionEquipo, string> = {
  OPERATIVO: 'En buen estado: sirve para alquiler, venta o asignación.',
  SOLO_VENTA: 'Funciona, pero no es apto para alquiler (sin cargador, pantalla opaca, etc.). Solo se puede vender.',
  NO_OPERATIVO: 'Tiene una falla grave: no se alquila, asigna ni vende hasta repararlo o reclasificarlo.',
  POR_REVISAR: 'Aún no se evaluó. No se alquila ni asigna hasta que se revise.',
};

export function clasePorCondicion(c: CondicionEquipo): string {
  return 'badge-cond-' + c.toLowerCase();
}

/** Motivo por el que la condición del equipo impide el movimiento (la API valida lo mismo); null si no lo impide. */
export function motivoCondicion(e: Equipo, tipo: TipoMovimiento | ''): string | null {
  if (tipo === 'SALIDA_ALQUILER' || tipo === 'ASIGNACION_PERSONAL') {
    if (e.condicion !== 'OPERATIVO') return `está ${ETIQUETA_CONDICION[e.condicion].toLowerCase()}`;
  }
  if (tipo === 'SALIDA_VENTA' && e.condicion === 'NO_OPERATIVO') {
    return 'está no operativo';
  }
  return null;
}

/** Movimientos que se pueden registrar según el estado Y la condición del equipo. */
export function accionesDe(e: Equipo): TipoMovimiento[] {
  return ACCIONES_POR_ESTADO[e.estado].filter((t) => motivoCondicion(e, t) === null);
}

/** Cómo se llama el dato origenDestino según el movimiento (cliente, persona u origen). */
export function rotuloOrigenDestino(tipo: TipoMovimiento): string {
  switch (tipo) {
    case 'SALIDA_ALQUILER':
    case 'SALIDA_VENTA':
      return 'Cliente';
    case 'ASIGNACION_PERSONAL':
      return 'Persona';
    case 'ENTRADA':
      return 'Ingresó desde';
    default:
      return 'Origen';
  }
}
