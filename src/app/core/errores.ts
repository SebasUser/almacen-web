import { HttpErrorResponse } from '@angular/common/http';

/** Convierte un error de la API en un texto claro para mostrar al usuario. */
export function mensajeError(e: HttpErrorResponse): string {
  if (e.status === 0) return 'No se pudo conectar con el servidor';
  if (e.status === 403) return 'No tienes permiso para realizar esta acción';

  const cuerpo = e.error as { mensaje?: string; errores?: Record<string, string> } | null;
  const detalle = cuerpo?.errores ? Object.values(cuerpo.errores).join('. ') : '';
  return [cuerpo?.mensaje, detalle].filter(Boolean).join(': ') || 'Ocurrió un error. Intenta de nuevo';
}