import type { Plan, RespuestaPlan, Semestre } from "../types/plan";

/**
 * Orden de los semestres dentro de un año. Las anuales van primero porque
 * atraviesan los dos. Tiene que coincidir con `ORDEN_SEMESTRE` del backend
 * (`backend/src/models/materia.py`).
 */
export const ORDEN_SEMESTRE: Record<Semestre, number> = {
  anual: 0,
  "1": 1,
  "2": 2,
};

/**
 * Indexa la respuesta de la API para que las reglas y la malla no tengan que
 * recorrer arrays. La API ya devuelve las materias ordenadas por año, semestre
 * y código, y ese orden se preserva.
 */
export function armarPlan(respuesta: RespuestaPlan): Plan {
  const anios = new Map(respuesta.anios.map((anio) => [anio.id_anio, anio]));
  const materias = new Map(
    respuesta.materias.map((materia) => [materia.id_materia, materia]),
  );

  const materiasPorAnio = new Map<number, number[]>();
  for (const anio of respuesta.anios) {
    materiasPorAnio.set(anio.id_anio, []);
  }

  const habilita = new Map<number, number[]>();

  for (const materia of respuesta.materias) {
    const delAnio = materiasPorAnio.get(materia.id_anio);
    if (delAnio) {
      delAnio.push(materia.id_materia);
    } else {
      materiasPorAnio.set(materia.id_anio, [materia.id_materia]);
    }

    for (const idRequisito of materia.correlativas) {
      const destraba = habilita.get(idRequisito);
      if (destraba) {
        destraba.push(materia.id_materia);
      } else {
        habilita.set(idRequisito, [materia.id_materia]);
      }
    }
  }

  return {
    carrera: respuesta.carrera,
    anios,
    materias,
    materiasPorAnio,
    habilita,
  };
}
