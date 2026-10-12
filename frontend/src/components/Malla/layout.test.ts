import { describe, expect, it } from "vitest";

import { planDePrueba } from "../../domain/fixtures";
import {
  ALTO_NODO_MINIMO,
  ANCHO_TEXTO,
  altoDeMateria,
  calcularUbicaciones,
  lineasDe,
} from "./layout";

/**
 * Anchos reales, medidos en el navegador con la fuente de la tarjeta.
 *
 * En los tests no hay canvas, así que el medidor de verdad no está
 * disponible. Estos son los casos que fallaron en pantalla: nombres que la
 * estimación por cantidad de caracteres daba por buenos y el navegador
 * terminaba partiendo en dos.
 */
const ANCHOS_REALES: Record<string, number> = {
  "Ingeniería de Software Aplicada": 187.6,
  "Arquitectura de Computadoras": 182.7,
  Informática: 67.7,
  "Arquitectura": 78.0,
  "de": 13.0,
  "Computadoras": 85.0,
  "Ingeniería": 65.0,
  "Software": 57.0,
  "Aplicada": 55.0,
  "Ingeniería de": 82.0,
  "Ingeniería de Software": 143.0,
  "Arquitectura de": 95.0,
};

/** Medidor determinista: usa los anchos reales y, si no, estima. */
const medirComoElNavegador = (texto: string) =>
  ANCHOS_REALES[texto] ?? texto.length * 7.2;

const PLAN = planDePrueba();

describe("calcularUbicaciones", () => {
  const { materias, anios } = calcularUbicaciones(PLAN);

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

describe("alto de la tarjeta", () => {
  it("un nombre corto ocupa una línea", () => {
    expect(lineasDe("Física")).toBe(1);
    expect(lineasDe("Cálculo I")).toBe(1);
  });

  it("un nombre largo ocupa varias", () => {
    // El caso que motivó el cambio: antes se recortaba a dos líneas
    expect(lineasDe("Sistemas de Representación y Modelado 3D")).toBeGreaterThan(1);
    expect(lineasDe("Práctica Profesional Supervisada")).toBeGreaterThan(1);
  });

  it("no parte palabras que entran en un renglón", () => {
    // Dos palabras que juntas no entran, separadas sí: dos líneas, no tres
    expect(lineasDe("Termodinámica Instrumentación")).toBe(2);
  });

  it("parte una palabra sola más larga que el renglón", () => {
    expect(lineasDe("a".repeat(100))).toBeGreaterThan(3);
  });

  it("parte los nombres que el navegador parte, aunque entren por poco", () => {
    // 187.6 px contra 185 de ancho útil: por 2.6 px va a dos líneas. La
    // estimación por cantidad de caracteres la daba por buena en una sola, y
    // el texto terminaba desbordando la tarjeta.
    expect(
      lineasDe("Ingeniería de Software Aplicada", medirComoElNavegador),
    ).toBe(2);
  });

  it("un nombre que entra justo ocupa una sola línea", () => {
    // 182.7 px: entra. Antes se partía en dos porque el candado le robaba
    // ancho, y por eso el candado ahora va en la línea de créditos: si no,
    // el alto de la tarjeta cambiaría al aprobar o desaprobar materias.
    expect(
      lineasDe("Arquitectura de Computadoras", medirComoElNavegador),
    ).toBe(1);
    expect(lineasDe("Informática", medirComoElNavegador)).toBe(1);
  });

  it("el ancho útil descuenta bordes y padding", () => {
    // Si esto cambia, hay que cambiar también el max-width de
    // `.materia__nombre` en Malla.css, o los dos dejan de coincidir.
    expect(ANCHO_TEXTO).toBe(185);
  });

  it("tolera vacío", () => {
    expect(lineasDe("")).toBe(1);
    expect(altoDeMateria("")).toBe(ALTO_NODO_MINIMO);
  });

  it("más líneas, más alto", () => {
    const corto = altoDeMateria("Física");
    const largo = altoDeMateria("Sistemas de Representación y Modelado 3D");
    expect(largo).toBeGreaterThan(corto);
  });
});

describe("las tarjetas no se superponen", () => {
  it("dentro de cada año", () => {
    const { materias } = calcularUbicaciones(PLAN);
    for (const ids of PLAN.materiasPorAnio.values()) {
      for (let i = 1; i < ids.length; i += 1) {
        const anterior = PLAN.materias.get(ids[i - 1] as number);
        const arriba = materias.get(ids[i - 1] as number)?.y ?? 0;
        const abajo = materias.get(ids[i] as number)?.y ?? 0;
        expect(abajo).toBeGreaterThanOrEqual(
          arriba + altoDeMateria(anterior?.nombre ?? ""),
        );
      }
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
