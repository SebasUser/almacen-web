/** Convierte una fecha ISO ("2026-11-23T22:40:12") en "23/11/2026 22:40". */
export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const [fecha, hora = ''] = valor.split('T');
  const dmy = fecha.split('-').reverse().join('/');
  return hora ? `${dmy} ${hora.slice(0, 5)}` : dmy;
}

/** "2026-11-23T22:40:12" → "23/11/2026" */
export function fechaDe(valor: string | null | undefined): string {
  return fechaHora(valor).split(' ')[0];
}

/** "2026-11-23T22:40:12" → "22:40" (vacío si no hay hora) */
export function horaDe(valor: string | null | undefined): string {
  return fechaHora(valor).split(' ')[1] ?? '';
}
