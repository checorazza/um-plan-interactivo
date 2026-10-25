/**
 * El estado `cursando`: la materia que estás haciendo ahora.
 *
 * Pide lo mismo que `regular` —el gate de créditos, sin correlativas— y, como
 * ella, no da créditos. Lo único donde el orden importa es al combinar dos
 * progresos, porque ahí hay que quedarse con el más avanzado.
 */

import { describe, expect, it } from "vitest";

import { planDePrueba } from "./fixtures";
import {
  aplicarCambio,
  combinarEstados,
  creditosAprobados,
  puedeMarcar,
  sanearEstados,
  validarConjunto,
} from "./reglas";

const PLAN = planDePrueba();

/** Precálculo (6 cr) y Química (4 cr) son de 1º; Cálculo I es de 2º. */
const PRECALCULO = 1;
const QUIMICA = 2;
const CALCULO_I = 4;

describe("cursando", () => {
  it("pide lo mismo que regular", () => {
    // 1º año no pide créditos: las dos entran.
    expect(puedeMarcar(PLAN, {}, PRECALCULO, "cursando").ok).toBe(true);
    expect(puedeMarcar(PLAN, {}, PRECALCULO, "regular").ok).toBe(true);

    // 2º pide 12 créditos: ninguna de las dos entra.
    expect(puedeMarcar(PLAN, {}, CALCULO_I, "cursando").ok).toBe(false);
    expect(puedeMarcar(PLAN, {}, CALCULO_I, "regular").ok).toBe(false);
  });

  it("no exige correlativas, igual que regularizar", () => {
    // Cálculo I pide Precálculo aprobada, pero sólo para aprobarla.
    const conCreditos = { [PRECALCULO]: "aprobada" as const, 3: "aprobada" as const };
    expect(puedeMarcar(PLAN, conCreditos, CALCULO_I, "cursando").ok).toBe(true);
    expect(puedeMarcar(PLAN, conCreditos, CALCULO_I, "aprobada").ok).toBe(true);
  });

  it("no da créditos", () => {
    expect(creditosAprobados(PLAN, { [PRECALCULO]: "cursando" })).toBe(0);
    expect(creditosAprobados(PLAN, { [PRECALCULO]: "aprobada" })).toBe(6);
  });

  it("es un conjunto válido y sobrevive al saneo", () => {
    const estados = { [PRECALCULO]: "cursando" as const };
    expect(validarConjunto(PLAN, estados)).toEqual([]);
    expect(sanearEstados(PLAN, estados).estados).toEqual(estados);
  });

  it("se descarta si el año está cerrado, como cualquier otro estado", () => {
    const estados = { [CALCULO_I]: "cursando" as const };
    expect(sanearEstados(PLAN, estados).estados).toEqual({});
  });

  it("se puede pasar a regular y a aprobada", () => {
    let estados: Record<number, "cursando" | "regular" | "aprobada"> = {
      [PRECALCULO]: "cursando",
    };

    const aRegular = aplicarCambio(PLAN, estados, PRECALCULO, "regular");
    expect(aRegular.ok).toBe(true);
    estados = aRegular.estados;
    expect(estados[PRECALCULO]).toBe("regular");

    const aAprobada = aplicarCambio(PLAN, estados, PRECALCULO, "aprobada");
    expect(aAprobada.ok).toBe(true);
    expect(aAprobada.estados[PRECALCULO]).toBe("aprobada");
  });

  it("y volver atrás a cursando desde aprobada", () => {
    const cambio = aplicarCambio(
      PLAN,
      { [PRECALCULO]: "aprobada" },
      PRECALCULO,
      "cursando",
    );
    expect(cambio.ok).toBe(true);
    expect(cambio.estados[PRECALCULO]).toBe("cursando");
  });

  it("la cascada nunca deja una materia en cursando", () => {
    // Bajar a cursando no destrabaría nada que regular no destrabe: las dos
    // piden lo mismo. La cascada sigue yendo de aprobada a regular, y a
    // nada cuando ni eso alcanza.
    const estados = {
      [PRECALCULO]: "aprobada" as const,
      [QUIMICA]: "aprobada" as const,
      3: "aprobada" as const,
      [CALCULO_I]: "aprobada" as const,
    };
    const cambio = aplicarCambio(PLAN, estados, PRECALCULO, null);

    expect(cambio.revertidas.length).toBeGreaterThan(0);
    for (const revertida of cambio.revertidas) {
      expect(revertida.a).not.toBe("cursando");
    }
  });
});

describe("combinarEstados con cursando", () => {
  it("regular le gana a cursando", () => {
    expect(
      combinarEstados({ 1: "cursando" }, { 1: "regular" }),
    ).toEqual({ 1: "regular" });
    expect(
      combinarEstados({ 1: "regular" }, { 1: "cursando" }),
    ).toEqual({ 1: "regular" });
  });

  it("aprobada le gana a cursando", () => {
    expect(
      combinarEstados({ 1: "aprobada" }, { 1: "cursando" }),
    ).toEqual({ 1: "aprobada" });
    expect(
      combinarEstados({ 1: "cursando" }, { 1: "aprobada" }),
    ).toEqual({ 1: "aprobada" });
  });

  it("cursando le gana a no tener nada", () => {
    expect(combinarEstados({}, { 1: "cursando" })).toEqual({ 1: "cursando" });
    expect(combinarEstados({ 1: "cursando" }, {})).toEqual({ 1: "cursando" });
  });
});
