/**
 * Las medidas y los títulos de los gráficos.
 *
 * Aparte del componente porque los necesita también `Malla`, que arma los
 * nodos, y porque un archivo de componentes no puede exportar otra cosa sin
 * romper el recargado en caliente.
 */

import type { TipoGrafico } from "../../storage/graficos";

export const TITULOS: Record<TipoGrafico, string> = {
  "torta-progreso": "Progreso",
};

/** React Flow necesita el tamaño del nodo antes de pintarlo. */
export const ANCHO_GRAFICO = 230;
export const ALTO_GRAFICO = 268;

/** El tipo que viaja en el arrastre desde el panel hasta el tablero. */
export const TIPO_ARRASTRE = "application/x-grafico";
