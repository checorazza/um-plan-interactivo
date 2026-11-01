/**
 * Dónde dejó el usuario el plan de estudios sobre el tablero.
 *
 * Es un desplazamiento, no una posición: las materias siguen acomodándose
 * solas desde `layout.ts` y esto corre el conjunto entero. Así, si el plan
 * cambia —otra materia, otro año—, el acomodo se rehace igual y lo único que
 * se conserva es dónde lo puso el usuario.
 *
 * Va por **nombre** de carrera, como los gráficos: el desplazamiento es del
 * tablero de esa carrera, y el id cambia si se recarga el plan.
 */

import { PREFIJO, borrarCrudo, escribirCrudo, leerCrudo } from "./crudo";

export const VERSION_TABLERO = 1;

const CLAVE = `${PREFIJO}:tablero`;

export interface Desplazamiento {
  x: number;
  y: number;
}

/** El plan en su lugar original. */
export const SIN_MOVER: Desplazamiento = { x: 0, y: 0 };

export type DesplazamientosPorCarrera = Record<string, Desplazamiento>;

function sanearDesplazamiento(valor: unknown): Desplazamiento | null {
  if (!valor || typeof valor !== "object") return null;
  const dato = valor as Record<string, unknown>;
  if (!Number.isFinite(dato.x) || !Number.isFinite(dato.y)) return null;
  return { x: Number(dato.x), y: Number(dato.y) };
}

/** Lleva al formato actual cualquier cosa con forma de tablero guardado. */
export function interpretarTablero(valor: unknown): DesplazamientosPorCarrera {
  if (!valor || typeof valor !== "object") return {};

  const dato = valor as Record<string, unknown>;
  if (dato.version !== VERSION_TABLERO) return {};
  if (!dato.porCarrera || typeof dato.porCarrera !== "object") return {};

  const porCarrera: DesplazamientosPorCarrera = {};
  for (const [carrera, posicion] of Object.entries(
    dato.porCarrera as Record<string, unknown>,
  )) {
    const sano = sanearDesplazamiento(posicion);
    if (sano) porCarrera[carrera] = sano;
  }
  return porCarrera;
}

function leerTodo(): DesplazamientosPorCarrera {
  return interpretarTablero(leerCrudo(CLAVE));
}

export function leerTodosLosDesplazamientos(): DesplazamientosPorCarrera {
  return leerTodo();
}

export function leerDesplazamiento(carrera: string): Desplazamiento {
  return leerTodo()[carrera] ?? SIN_MOVER;
}

export function escribirTodosLosDesplazamientos(
  porCarrera: DesplazamientosPorCarrera,
): boolean {
  if (Object.keys(porCarrera).length === 0) {
    borrarCrudo(CLAVE);
    return true;
  }
  return escribirCrudo(CLAVE, { version: VERSION_TABLERO, porCarrera });
}

export function guardarDesplazamiento(
  carrera: string,
  desplazamiento: Desplazamiento,
): boolean {
  const porCarrera = leerTodo();
  // El plan en su lugar es la ausencia de dato: así no se guarda una entrada
  // por cada carrera que se abrió y nunca se movió.
  if (desplazamiento.x === 0 && desplazamiento.y === 0) delete porCarrera[carrera];
  else porCarrera[carrera] = desplazamiento;

  return escribirTodosLosDesplazamientos(porCarrera);
}
