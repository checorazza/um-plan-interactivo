/**
 * Cuánto te falta de créditos para destrabar cada año.
 *
 * Ojo con la regla, que es fácil leerla mal: el gate de un año se compara
 * contra el **total** de créditos aprobados, de cualquier año, no contra los
 * de ese año. O sea que no son cinco barras independientes: es un solo
 * número tuyo contra varios umbrales.
 */

import { creditosAprobados } from "../../domain/reglas";
import type { Estados } from "../../types/estado";
import type { Plan } from "../../types/plan";

export interface Requisito {
  numero: number;
  requeridos: number;
  /** Cuántos de los requeridos tenés. Nunca más que `requeridos`. */
  cubiertos: number;
  faltan: number;
  cumplido: boolean;
}

export interface Requisitos {
  /** El total de créditos aprobados: el mismo para todos los años. */
  total: number;
  anios: Requisito[];
}

/**
 * Los años que piden créditos, en orden.
 *
 * Los que piden cero quedan afuera: están destrabados siempre y una fila que
 * dice "0 de 0" no informa nada. Primer año es el caso típico.
 */
export function requisitosPorAnio(plan: Plan, estados: Estados): Requisitos {
  const total = creditosAprobados(plan, estados);

  const anios = [...plan.anios.values()]
    .filter((anio) => anio.creditos_requeridos > 0)
    .sort((a, b) => a.numero - b.numero)
    .map((anio) => {
      const requeridos = anio.creditos_requeridos;
      return {
        numero: anio.numero,
        requeridos,
        cubiertos: Math.min(total, requeridos),
        faltan: Math.max(0, requeridos - total),
        cumplido: total >= requeridos,
      };
    });

  return { total, anios };
}
