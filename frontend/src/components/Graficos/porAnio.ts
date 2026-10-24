/**
 * Cuántas materias aprobaste en cada año calendario.
 *
 * Sale de las fechas de aprobación, no del plan: el "año" acá es 2024, no
 * "2º año de la carrera".
 */

import type { Estados, FechasDeMateria } from "../../types/estado";

export interface AnioAprobadas {
  anio: number;
  cantidad: number;
}

export interface PorAnio {
  anios: AnioAprobadas[];
  /** Aprobadas sin fecha cargada: no se pueden ubicar en ningún año. */
  sinFecha: number;
  /** El año con más aprobadas. `null` si no hay ninguna con fecha. */
  mejor: number | null;
}

/**
 * Agrupa por año, rellenando los años sin aprobadas.
 *
 * Un año en cero tiene que aparecer igual: si se salteara, 2024 y 2026
 * quedarían pegados y el gráfico diría que fueron seguidos. Los años se
 * cuentan desde el primero hasta el último con actividad; antes y después no
 * hay nada que mostrar.
 *
 * Empata el año más temprano: si dos tienen la misma cantidad, el primero es
 * el que se destaca, y así el resaltado no cambia al recargar.
 */
export function aprobadasPorAnio(
  estados: Estados,
  aprobaciones: FechasDeMateria,
): PorAnio {
  const cuenta = new Map<number, number>();
  let sinFecha = 0;

  for (const [clave, estado] of Object.entries(estados)) {
    if (estado !== "aprobada") continue;

    const fecha = aprobaciones[Number(clave)];
    if (!fecha) {
      sinFecha += 1;
      continue;
    }

    const anio = Number(fecha.slice(0, 4));
    cuenta.set(anio, (cuenta.get(anio) ?? 0) + 1);
  }

  if (cuenta.size === 0) return { anios: [], sinFecha, mejor: null };

  const ordenados = [...cuenta.keys()].sort((a, b) => a - b);
  const desde = ordenados[0]!;
  const hasta = ordenados[ordenados.length - 1]!;

  const anios: AnioAprobadas[] = [];
  for (let anio = desde; anio <= hasta; anio += 1) {
    anios.push({ anio, cantidad: cuenta.get(anio) ?? 0 });
  }

  let mejor = anios[0]!;
  for (const actual of anios) {
    if (actual.cantidad > mejor.cantidad) mejor = actual;
  }

  return { anios, sinFecha, mejor: mejor.anio };
}
