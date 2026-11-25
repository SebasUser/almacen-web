const MARCAS = ['AOC', 'BENQ', 'SAMSUNG', 'LG', 'DELL', 'LENOVO', 'TEROS', 'HP', 'ACER', 'ASUS', 'PHILIPS', 'VIEWSONIC'];

/** Detecta la marca en una descripción como «MONITOR LED 21.5" AOC MOD. I2269VWM» (vacío si no la reconoce). */
export function marcaDe(descripcion: string): string {
  const texto = descripcion.toUpperCase();
  return MARCAS.find((m) => new RegExp(`\\b${m}\\b`).test(texto)) ?? '';
}

/** Detecta las pulgadas en una descripción (21.5", 23', 24 pulg.…). Vacío si no las encuentra. */
export function pulgadasDe(descripcion: string): string {
  const m = descripcion.match(/(\d{2}(?:[.,]\d)?)\s*(?:"|'|”|“)/) ?? descripcion.match(/\b(\d{2}\.\d)\b/);
  return m ? m[1].replace(',', '.') : '';
}
