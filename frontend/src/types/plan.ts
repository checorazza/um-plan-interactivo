import type { Anio } from "./anio";
import type { Carrera } from "./carrera";
import type { Materia, Semestre } from "./materia";

export type { Semestre };

/** Respuesta de `GET /carreras/<id>/plan`, tal como llega de la API. */
export interface RespuestaPlan {
  carrera: Carrera;
  anios: Anio[];
  materias: Materia[];
}

/**
 * El plan indexado, que es lo que consumen las reglas y la malla.
 * Se arma con `armarPlan()` a partir de la respuesta de la API.
 */
export interface Plan {
  carrera: Carrera;
  /** Años por id. */
  anios: Map<number, Anio>;
  /** Materias por id. */
  materias: Map<number, Materia>;
  /** Ids de materias agrupadas por año, en el orden en que llegaron. */
  materiasPorAnio: Map<number, number[]>;
  /** Para cada materia, las materias que destraba al aprobarse. */
  habilita: Map<number, number[]>;
}
