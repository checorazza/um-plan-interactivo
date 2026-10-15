/**
 * La geometría de la torta, aparte del dibujo.
 *
 * Los arcos se dibujan como un círculo con `stroke-dasharray`: cada porción
 * es un tramo de línea del largo que le toca. Es más simple que armar paths
 * con arcos de Bézier y, sobre todo, deja el separador entre porciones como
 * un hueco de verdad —se ve el fondo— y no como un borde pintado encima.
 */

export interface Porcion {
  clave: string;
  etiqueta: string;
  valor: number;
  /** La variable de CSS que le da el color. */
  color: string;
}

export interface Arco {
  clave: string;
  /** Largo del trazo, en unidades del dibujo. */
  largo: number;
  /** Dónde arranca, para `stroke-dashoffset`. */
  desfase: number;
}

/**
 * De valores a tramos de círculo.
 *
 * `hueco` es la separación entre porciones: se le descuenta a cada tramo, no
 * se dibuja nada en el medio. Una porción que después del descuento no da
 * para dibujarse no se dibuja: un hilo de dos píxeles no dice nada y ensucia.
 */
export function arcos(
  porciones: Porcion[],
  circunferencia: number,
  hueco: number,
): Arco[] {
  const total = porciones.reduce((suma, porcion) => suma + porcion.valor, 0);
  if (total <= 0) return [];

  // Con una sola porción con valor, el anillo va entero: no hay vecina de la
  // que separarse, y un hueco suelto parecería que falta un pedazo.
  const conValor = porciones.filter((porcion) => porcion.valor > 0).length;
  const separacion = conValor > 1 ? hueco : 0;

  const resultado: Arco[] = [];
  let acumulado = 0;

  for (const porcion of porciones) {
    const largo = (porcion.valor / total) * circunferencia;
    const visible = largo - separacion;
    if (visible > 0.5) {
      resultado.push({
        clave: porcion.clave,
        largo: visible,
        // `stroke-dashoffset` corre el patrón hacia atrás, de ahí el signo.
        // El `|| 0` evita que el primero quede en `-0`, que termina escrito
        // así en el atributo del SVG.
        desfase: -acumulado || 0,
      });
    }
    acumulado += largo;
  }

  return resultado;
}

/** Porcentaje entero, para mostrar al lado de cada valor. */
export function porcentaje(valor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((valor / total) * 100);
}
