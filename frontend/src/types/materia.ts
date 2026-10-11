/** Semestre en que se cursa una materia. `anual` atraviesa los dos. */
export type Semestre = "1" | "2" | "anual";

export interface Materia {
  id_materia: number;
  /** Código del plan de estudios (ej. "0003", "2022II"). */
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: Semestre;
  id_anio: number;
  /**
   * Grupo de materias básicas al que pertenece, o `null` si es propia de la
   * carrera. Dos materias con la misma básica son la misma materia en dos
   * planes distintos: el progreso se comparte.
   */
  id_basica: number | null;
  /** Ids de las materias que hay que aprobar antes de poder aprobar esta. */
  correlativas: number[];
}
