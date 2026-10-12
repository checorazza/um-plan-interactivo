/** Estado de cursado de una materia. La ausencia de estado se representa con `undefined`. */
export type Estado = "regular" | "aprobada";

/** Estado de todas las materias de un usuario, indexado por id de materia. */
export type Estados = Record<number, Estado>;

/**
 * Fecha de vencimiento de la regularidad de cada materia, en `AAAA-MM-DD`.
 *
 * Sólo tiene sentido mientras la materia está regular: al aprobarla o
 * desmarcarla, la fecha se va con el estado.
 */
export type Vencimientos = Record<number, string>;

/** Lo que devuelve la API en `GET /me/estados`. */
export interface EstadoMateria {
  id_materia: number;
  estado: Estado;
  actualizado_en: string;
}
