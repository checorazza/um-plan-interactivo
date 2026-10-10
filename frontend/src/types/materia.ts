export interface Materia {
  id_materia: number;
  /** Código del plan de estudios (ej. "0003", "2022II"). */
  codigo: string;
  nombre: string;
  creditos: number;
  id_anio: number;
  /** Ids de las materias que hay que aprobar antes de poder aprobar esta. */
  correlativas: number[];
}
