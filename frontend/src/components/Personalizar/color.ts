/**
 * Conversiones de color para el selector.
 *
 * Todo lo que sale de acá y se guarda es `#rrggbb`: es lo único que la app
 * escribe en el CSS y lo único que `sanearColor` deja entrar. HSV vive sólo
 * mientras el selector está abierto, porque es lo que necesita la rueda —el
 * cuadrado de saturación y la barra de tono— y porque en hexa se pierde: el
 * negro no tiene tono, y al arrastrar el puntero al borde inferior el color
 * elegido saltaría a otro lado al volver a subir.
 */

/** Tono en grados (0–360), saturación y valor en 0–1. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Cómo se muestra y se escribe el color en el campo de texto. */
export type Formato = "hex" | "rgb" | "hsl";

export const FORMATOS: Formato[] = ["hex", "rgb", "hsl"];

const HEXA = /^#?([0-9a-f]{6})$/i;
const HEXA_CORTO = /^#?([0-9a-f]{3})$/i;

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

function aDosDigitos(valor: number): string {
  return Math.round(limitar(valor, 0, 255)).toString(16).padStart(2, "0");
}

export function rgbAHex({ r, g, b }: Rgb): string {
  return `#${aDosDigitos(r)}${aDosDigitos(g)}${aDosDigitos(b)}`;
}

export function hexARgb(hex: string): Rgb {
  const coincide = HEXA.exec(hex.trim());
  if (!coincide?.[1]) return { r: 0, g: 0, b: 0 };
  const entero = parseInt(coincide[1], 16);
  return {
    r: (entero >> 16) & 255,
    g: (entero >> 8) & 255,
    b: entero & 255,
  };
}

export function rgbAHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maximo = Math.max(rn, gn, bn);
  const minimo = Math.min(rn, gn, bn);
  const delta = maximo - minimo;

  let h = 0;
  if (delta !== 0) {
    if (maximo === rn) h = ((gn - bn) / delta) % 6;
    else if (maximo === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: maximo === 0 ? 0 : delta / maximo, v: maximo };
}

export function hsvARgb({ h, s, v }: Hsv): Rgb {
  const tono = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((tono / 60) % 2) - 1));
  const m = v - c;

  const sectores: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = sectores[Math.floor(tono / 60) % 6] ?? [0, 0, 0];

  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexAHsv(hex: string): Hsv {
  return rgbAHsv(hexARgb(hex));
}

export function hsvAHex(hsv: Hsv): string {
  return rgbAHex(hsvARgb(hsv));
}

/** HSL, sólo para mostrar: es lo que entiende quien lee CSS. */
function rgbAHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const { h, s: sv, v } = rgbAHsv({ r, g, b });
  const l = v * (1 - sv / 2);
  const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s, l };
}

/** El texto que se muestra en el campo, sin el `#` (va aparte en la UI). */
export function formatear(hex: string, formato: Formato): string {
  if (formato === "hex") return hex.replace("#", "").toUpperCase();

  const rgb = hexARgb(hex);
  if (formato === "rgb") {
    const { r, g, b } = rgb;
    return `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
  }

  const { h, s, l } = rgbAHsl(rgb);
  return `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

function hslAHex(h: number, s: number, l: number): string {
  const v = l + s * Math.min(l, 1 - l);
  const sv = v === 0 ? 0 : 2 * (1 - l / v);
  return hsvAHex({ h, s: sv, v });
}

/**
 * Lee lo que el usuario escribió y devuelve `#rrggbb`, o null si todavía no
 * es un color. Se acepta cualquiera de los tres formatos sin importar cuál
 * esté elegido: pegar un hexa con el selector en RGB tiene que andar.
 */
export function parsear(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const corto = HEXA_CORTO.exec(limpio)?.[1];
  if (corto) {
    const [r, g, b] = [...corto];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  const largo = HEXA.exec(limpio)?.[1];
  if (largo) return `#${largo.toLowerCase()}`;

  // `255, 0, 0` o `rgb(255, 0, 0)`, y lo mismo para hsl con o sin `%`.
  const numeros = limpio
    .replace(/^(rgb|hsl)a?\(/i, "")
    .replace(/\)$/, "")
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (numeros.length < 3) return null;

  const esHsl = /^hsl/i.test(limpio) || numeros.slice(1).some((n) => n.endsWith("%"));
  const [a, b, c] = numeros.map((n) => Number.parseFloat(n));
  if (a === undefined || b === undefined || c === undefined) return null;
  if ([a, b, c].some((n) => Number.isNaN(n))) return null;

  if (esHsl) {
    return hslAHex(a, limitar(b, 0, 100) / 100, limitar(c, 0, 100) / 100);
  }

  return rgbAHex({
    r: limitar(a, 0, 255),
    g: limitar(b, 0, 255),
    b: limitar(c, 0, 255),
  });
}
