/**
 * Posiciones de los nodos de la malla.
 *
 * Las posiciones se **calculan** a partir del plan, nunca se guardan: si
 * cambia el plan, la malla se reacomoda sola. Cada año es una columna (o una
 * fila, en pantallas angostas) y las materias se apilan en el orden en que las
 * devuelve la API, que ya viene por semestre y código.
 */

import type { Plan } from "../../types/plan";

export const ANCHO_NODO = 210;
export const ALTO_NODO = 72;
/** Alto del encabezado de año. Fijo, para que el minimapa pueda dibujarlo. */
export const ALTO_NODO_ANIO = 56;

/** Separación entre columnas de años. */
const SEPARACION_ANIO = 300;
/** Separación vertical entre materias. Deja lugar al menú de acciones. */
const SEPARACION_MATERIA = 120;
/** Espacio bajo el encabezado del año. */
const ALTO_ENCABEZADO = 92;
/** Aire entre el último nodo de un año y el encabezado del siguiente. */
const AIRE_ENTRE_ANIOS = 48;

export type Orientacion = "columnas" | "apilado";

export interface Posicion {
  x: number;
  y: number;
}

export interface Ubicaciones {
  materias: Map<number, Posicion>;
  anios: Map<number, Posicion>;
}

/**
 * En `columnas` (escritorio) cada año avanza hacia la derecha y sus materias
 * bajan.
 *
 * En `apilado` (móvil) todo baja en una sola columna: año, sus materias, el
 * año siguiente. Es la forma que mejor aprovecha una pantalla angosta —poner
 * las materias de un año en fila obliga a alejar tanto el zoom que no se leen—
 * y además se recorre con el gesto natural del teléfono, que es scrollear.
 */
export function calcularUbicaciones(
  plan: Plan,
  orientacion: Orientacion = "columnas",
): Ubicaciones {
  const materias = new Map<number, Posicion>();
  const anios = new Map<number, Posicion>();

  const ordenados = [...plan.anios.values()].sort((a, b) => a.numero - b.numero);

  if (orientacion === "columnas") {
    ordenados.forEach((anio, indice) => {
      const x = indice * SEPARACION_ANIO;
      anios.set(anio.id_anio, { x, y: 0 });

      const delAnio = plan.materiasPorAnio.get(anio.id_anio) ?? [];
      delAnio.forEach((idMateria, fila) => {
        materias.set(idMateria, {
          x,
          y: ALTO_ENCABEZADO + fila * SEPARACION_MATERIA,
        });
      });
    });
    return { materias, anios };
  }

  let y = 0;
  for (const anio of ordenados) {
    anios.set(anio.id_anio, { x: 0, y });
    y += ALTO_ENCABEZADO;

    const delAnio = plan.materiasPorAnio.get(anio.id_anio) ?? [];
    for (const idMateria of delAnio) {
      materias.set(idMateria, { x: 0, y });
      y += SEPARACION_MATERIA;
    }

    y += AIRE_ENTRE_ANIOS;
  }

  return { materias, anios };
}
