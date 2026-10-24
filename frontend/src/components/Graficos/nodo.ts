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
  "aprobadas-por-anio": "Aprobadas por año",
  "requisitos-anio": "Requisitos por año",
};

/**
 * El tamaño de cada tarjeta. React Flow lo necesita antes de pintar el nodo,
 * así que no puede salir del contenido: va acá y el CSS lo repite.
 *
 * Cada gráfico pide lo suyo. Un anillo con leyenda es angosto y alto; unas
 * barras en el tiempo son anchas y bajas.
 */
export const MEDIDAS: Record<TipoGrafico, { ancho: number; alto: number }> = {
  "torta-progreso": { ancho: 230, alto: 226 },
  "aprobadas-por-anio": { ancho: 272, alto: 196 },
  "requisitos-anio": { ancho: 248, alto: 232 },
};

/** El tipo que viaja en el arrastre desde el panel hasta el tablero. */
export const TIPO_ARRASTRE = "application/x-grafico";
