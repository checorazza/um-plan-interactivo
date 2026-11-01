/**
 * Cómo venís en cada año **del plan**: 1º, 2º, 3º…
 *
 * Ojo con el nombre: acá "año" es el año de la carrera, no el año
 * calendario. El del calendario es `porAnio.ts`, que mira las fechas de
 * aprobación.
 */

import type { Estados } from "../../types/estado";
import type { Plan } from "../../types/plan";

export interface AnioDelPlan {
  numero: number;
  total: number;
  aprobadas: number;
  regulares: number;
  cursando: number;
  /** Las que no tienen ningún estado. */
  faltan: number;
}

/**
 * Cuenta las materias de cada año por estado, en orden.
 *
 * Un año sin materias no aparece: una barra vacía sin nada que contar
 * ocuparía una fila para decir nada.
 */
export function progresoPorAnio(plan: Plan, estados: Estados): AnioDelPlan[] {
  const anios: AnioDelPlan[] = [];

  for (const anio of [...plan.anios.values()].sort(
    (a, b) => a.numero - b.numero,
  )) {
    const ids = plan.materiasPorAnio.get(anio.id_anio) ?? [];
    if (ids.length === 0) continue;

    let aprobadas = 0;
    let regulares = 0;
    let cursando = 0;
    for (const idMateria of ids) {
      const estado = estados[idMateria];
      if (estado === "aprobada") aprobadas += 1;
      else if (estado === "regular") regulares += 1;
      else if (estado === "cursando") cursando += 1;
    }

    anios.push({
      numero: anio.numero,
      total: ids.length,
      aprobadas,
      regulares,
      cursando,
      faltan: ids.length - aprobadas - regulares - cursando,
    });
  }

  return anios;
}
