import { describe, expect, it } from "vitest";

import { planDePrueba } from "../../domain/fixtures";
import { progresoPorAnio } from "./porAnioDelPlan";

const PLAN = planDePrueba();

// 1º tiene 3 materias (1, 2, 3), 2º tiene 3 (4, 5, 7) y 3º tiene 1 (6).

describe("progresoPorAnio", () => {
  it("cuenta las materias de cada año, en orden", () => {
    const anios = progresoPorAnio(PLAN, {});
    expect(anios.map((a) => [a.numero, a.total])).toEqual([
      [1, 3],
      [2, 3],
      [3, 1],
    ]);
  });

  it("sin nada marcado, faltan todas", () => {
    const [primero] = progresoPorAnio(PLAN, {});
    expect(primero).toMatchObject({
      aprobadas: 0,
      regulares: 0,
      cursando: 0,
      faltan: 3,
    });
  });

  it("reparte por estado", () => {
    const [primero] = progresoPorAnio(PLAN, {
      1: "aprobada",
      2: "regular",
      3: "cursando",
    });
    expect(primero).toMatchObject({
      total: 3,
      aprobadas: 1,
      regulares: 1,
      cursando: 1,
      faltan: 0,
    });
  });

  it("las partes siempre suman el total", () => {
    // Es lo que hace que la barra apilada llegue justo al borde.
    const anios = progresoPorAnio(PLAN, {
      1: "aprobada",
      3: "cursando",
      4: "regular",
    });
    for (const anio of anios) {
      expect(anio.aprobadas + anio.regulares + anio.cursando + anio.faltan).toBe(
        anio.total,
      );
    }
  });

  it("cada año cuenta sólo lo suyo", () => {
    const anios = progresoPorAnio(PLAN, { 1: "aprobada", 6: "aprobada" });
    expect(anios[0]?.aprobadas).toBe(1);
    expect(anios[1]?.aprobadas).toBe(0);
    expect(anios[2]?.aprobadas).toBe(1);
  });

  it("un estado de una materia de otro plan no cuenta en ninguno", () => {
    const anios = progresoPorAnio(PLAN, { 999: "aprobada" });
    for (const anio of anios) expect(anio.aprobadas).toBe(0);
  });
});
