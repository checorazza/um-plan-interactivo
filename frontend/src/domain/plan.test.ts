import { describe, expect, it } from "vitest";

import { ORDEN_SEMESTRE, armarPlan } from "./plan";
import { planDePrueba, respuestaDePrueba } from "./fixtures";

describe("armarPlan", () => {
  it("indexa años y materias por id", () => {
    const plan = planDePrueba();

    expect(plan.anios.size).toBe(3);
    expect(plan.materias.size).toBe(7);
    expect(plan.materias.get(1)?.nombre).toBe("Precálculo");
    expect(plan.anios.get(2)?.creditos_requeridos).toBe(12);
  });

  it("agrupa las materias por año preservando el orden de la API", () => {
    const plan = planDePrueba();

    expect(plan.materiasPorAnio.get(1)).toEqual([1, 2, 3]);
    expect(plan.materiasPorAnio.get(2)).toEqual([4, 5, 7]);
    expect(plan.materiasPorAnio.get(3)).toEqual([6]);
  });

  it("arma el índice inverso de correlativas", () => {
    const plan = planDePrueba();

    // Precálculo destraba Cálculo I y Física
    expect(plan.habilita.get(1)).toEqual([4, 5]);
    // Cálculo I destraba Cálculo II
    expect(plan.habilita.get(4)).toEqual([6]);
    // Informática no es correlativa de nada
    expect(plan.habilita.get(3)).toBeUndefined();
  });

  it("deja el año sin materias como lista vacía, no ausente", () => {
    const respuesta = respuestaDePrueba();
    respuesta.materias = [];
    const plan = armarPlan(respuesta);

    expect(plan.materiasPorAnio.get(1)).toEqual([]);
  });

  it("conserva la carrera", () => {
    expect(planDePrueba().carrera.nombre).toBe("Ingeniería en Informática");
  });
});

describe("ORDEN_SEMESTRE", () => {
  it("pone las anuales primero", () => {
    // Atraviesan los dos semestres, así que encabezan el año en la malla.
    // Tiene que coincidir con ORDEN_SEMESTRE del backend.
    expect(ORDEN_SEMESTRE.anual).toBeLessThan(ORDEN_SEMESTRE["1"]);
    expect(ORDEN_SEMESTRE["1"]).toBeLessThan(ORDEN_SEMESTRE["2"]);
  });
});
