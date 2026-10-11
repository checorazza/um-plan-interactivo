import { describe, expect, it } from "vitest";

import { planDePrueba } from "../../domain/fixtures";
import { ALTO_NODO, calcularUbicaciones } from "./layout";

const PLAN = planDePrueba();

describe("calcularUbicaciones en columnas", () => {
  const { materias, anios } = calcularUbicaciones(PLAN, "columnas");

  it("ubica una materia por cada materia del plan", () => {
    expect(materias.size).toBe(PLAN.materias.size);
    expect(anios.size).toBe(PLAN.anios.size);
  });

  it("pone cada año en su propia columna, de izquierda a derecha", () => {
    const x = [...PLAN.anios.values()]
      .sort((a, b) => a.numero - b.numero)
      .map((anio) => anios.get(anio.id_anio)?.x);

    expect(x).toEqual([...x].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(new Set(x).size).toBe(x.length);
  });

  it("alinea las materias con la columna de su año", () => {
    for (const materia of PLAN.materias.values()) {
      expect(materias.get(materia.id_materia)?.x).toBe(
        anios.get(materia.id_anio)?.x,
      );
    }
  });

  it("apila las materias de un año sin superponerlas", () => {
    for (const [idAnio, ids] of PLAN.materiasPorAnio) {
      const y = ids.map((id) => materias.get(id)?.y ?? 0);
      expect(y).toEqual([...y].sort((a, b) => a - b));
      expect(new Set(y).size).toBe(y.length);
      // todas por debajo del encabezado del año
      const yAnio = anios.get(idAnio)?.y ?? 0;
      expect(Math.min(...y)).toBeGreaterThan(yAnio);
    }
  });

  it("respeta el orden en que la API devolvió las materias", () => {
    const ids = PLAN.materiasPorAnio.get(2) ?? [];
    const y = ids.map((id) => materias.get(id)?.y ?? 0);
    expect(y).toEqual([...y].sort((a, b) => a - b));
  });
});

describe("calcularUbicaciones apilado (móvil)", () => {
  const { materias, anios } = calcularUbicaciones(PLAN, "apilado");

  it("pone todo en una sola columna", () => {
    const x = new Set([
      ...[...materias.values()].map((p) => p.x),
      ...[...anios.values()].map((p) => p.x),
    ]);
    expect([...x]).toEqual([0]);
  });

  it("intercala cada año con sus materias, en orden", () => {
    const esperado: number[] = [];
    for (const anio of [...PLAN.anios.values()].sort((a, b) => a.numero - b.numero)) {
      esperado.push(anios.get(anio.id_anio)?.y ?? 0);
      for (const id of PLAN.materiasPorAnio.get(anio.id_anio) ?? []) {
        esperado.push(materias.get(id)?.y ?? 0);
      }
    }
    // la secuencia completa baja sin volver atrás ni repetirse
    expect(esperado).toEqual([...esperado].sort((a, b) => a - b));
    expect(new Set(esperado).size).toBe(esperado.length);
  });

  it("separa las materias lo suficiente para el menú de acciones", () => {
    const ids = PLAN.materiasPorAnio.get(1) ?? [];
    const y = ids.map((id) => materias.get(id)?.y ?? 0);
    for (let i = 1; i < y.length; i += 1) {
      expect((y[i] ?? 0) - (y[i - 1] ?? 0)).toBeGreaterThan(ALTO_NODO);
    }
  });
});

describe("estabilidad", () => {
  it("dos llamadas con el mismo plan dan las mismas posiciones", () => {
    const a = calcularUbicaciones(PLAN);
    const b = calcularUbicaciones(PLAN);
    expect([...a.materias]).toEqual([...b.materias]);
  });
});
