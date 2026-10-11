/**
 * Plan de prueba compartido por los tests del dominio.
 *
 * Es el mismo que usa `backend/tests/test_reglas.py`, para poder comparar los
 * dos motores caso por caso.
 *
 * 1º año (0 créditos requeridos):
 *   1 Precálculo        6 cr
 *   2 Química General   4 cr
 *   3 Informática       7 cr
 * 2º año (12 créditos requeridos):
 *   4 Cálculo I         3 cr   correlativa: 1
 *   5 Física            5 cr   correlativa: 1
 *   7 Química Orgánica  4 cr   correlativa: 2
 * 3º año (38 créditos requeridos):
 *   6 Cálculo II        6 cr   correlativa: 4
 */

import type { Materia } from "../types/materia";
import type { RespuestaPlan } from "../types/plan";
import { armarPlan } from "./plan";

function materia(
  id: number,
  codigo: string,
  nombre: string,
  creditos: number,
  idAnio: number,
  correlativas: number[] = [],
  idBasica: number | null = null,
): Materia {
  return {
    id_materia: id,
    codigo,
    nombre,
    creditos,
    semestre: "1",
    id_anio: idAnio,
    id_basica: idBasica,
    correlativas,
  };
}

export function respuestaDePrueba(): RespuestaPlan {
  return {
    carrera: { id_carrera: 1, nombre: "Ingeniería en Informática" },
    anios: [
      { id_anio: 1, numero: 1, id_carrera: 1, creditos_requeridos: 0 },
      { id_anio: 2, numero: 2, id_carrera: 1, creditos_requeridos: 12 },
      { id_anio: 3, numero: 3, id_carrera: 1, creditos_requeridos: 38 },
    ],
    materias: [
      materia(1, "CP00", "Precálculo", 6, 1),
      materia(2, "0002", "Química General", 4, 1),
      materia(3, "0009", "Informática", 7, 1),
      materia(4, "0003", "Cálculo I", 3, 2, [1]),
      materia(5, "2020", "Física", 5, 2, [1]),
      materia(7, "0012", "Química Orgánica", 4, 2, [2]),
      materia(6, "0004", "Cálculo II", 6, 3, [4]),
    ],
  };
}

export function planDePrueba() {
  return armarPlan(respuestaDePrueba());
}
