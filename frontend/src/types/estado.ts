/** Estado de cursado de una materia. La ausencia de estado se representa con `undefined`. */
export type Estado = "regular" | "aprobada";

/** Estado de todas las materias de un usuario, indexado por id de materia. */
export type Estados = Record<number, Estado>;

/** Lo que devuelve la API en `GET /me/estados`. */
export interface EstadoMateria {
  id_materia: number;
  estado: Estado;
  actualizado_en: string;
}
