/**
 * Estado de cursado de una materia. Sin estado se representa con `undefined`.
 *
 * Van de menos a más: `cursando` es la materia que estás haciendo ahora,
 * `regular` la que cursaste y te falta rendir, `aprobada` la que terminaste.
 */
export type Estado = "cursando" | "regular" | "aprobada";

/** Estado de todas las materias de un usuario, indexado por id de materia. */
export type Estados = Record<number, Estado>;

/**
 * Fechas por materia, en `AAAA-MM-DD`.
 *
 * Hay dos mapas con esta forma y los dos van atados al estado: el
 * vencimiento de la regularidad vive mientras la materia está regular, y la
 * fecha de aprobación mientras está aprobada. Al cambiar de estado, la fecha
 * se va con él.
 */
export type FechasDeMateria = Record<number, string>;

/** Lo que devuelve la API en `GET /me/estados`. */
export interface EstadoMateria {
  id_materia: number;
  estado: Estado;
  actualizado_en: string;
}
