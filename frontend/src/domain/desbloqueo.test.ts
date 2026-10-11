/**
 * La regla 7: una materia desbloqueada a mano queda exenta de los créditos
 * del año y de las correlativas.
 *
 * Lo que más importa acá no es poder marcarla —eso es una línea— sino que lo
 * marcado sobreviva. `sanearEstados` corre cada vez que se abre una carrera y
 * tira todo lo que las reglas no explican: sin pasarle los desbloqueos, el
 * progreso desaparecía al recargar la página.
 */

import { describe, expect, it } from "vitest";

import { planDePrueba } from "./fixtures";
import {
  aplicarCambio,
  estadoDeBloqueo,
  puedeMarcar,
  sanearEstados,
  validarConjunto,
} from "./reglas";

const PLAN = planDePrueba();

/** Cálculo II: 3º año (38 créditos) y correlativa Cálculo I. */
const CALCULO_II = 6;
/** Cálculo I: 2º año (12 créditos) y correlativa Precálculo. */
const CALCULO_I = 4;
const PRECALCULO = 1;

describe("sin desbloquear", () => {
  it("una materia de 3º año no se puede ni regularizar desde cero", () => {
    expect(puedeMarcar(PLAN, {}, CALCULO_II, "regular").ok).toBe(false);
    expect(estadoDeBloqueo(PLAN, {}, CALCULO_II)).toBe(
      "bloqueada_por_creditos",
    );
  });
});

describe("desbloqueada", () => {
  const solaCalculoII = new Set([CALCULO_II]);

  it("se puede regularizar y aprobar aunque falten créditos y correlativas", () => {
    expect(puedeMarcar(PLAN, {}, CALCULO_II, "regular", solaCalculoII).ok).toBe(
      true,
    );
    expect(
      puedeMarcar(PLAN, {}, CALCULO_II, "aprobada", solaCalculoII).ok,
    ).toBe(true);
  });

  it("se ve como disponible", () => {
    expect(estadoDeBloqueo(PLAN, {}, CALCULO_II, solaCalculoII)).toBe(
      "disponible",
    );
  });

  it("la exención es materia por materia, no general", () => {
    // Cálculo I sigue bloqueada: desbloquear una no abre el resto del año.
    expect(puedeMarcar(PLAN, {}, CALCULO_I, "regular", solaCalculoII).ok).toBe(
      false,
    );
  });

  it("no se descarta al validar ni al sanear", () => {
    const estados = { [CALCULO_II]: "aprobada" as const };

    expect(validarConjunto(PLAN, estados)).toHaveLength(1);
    expect(validarConjunto(PLAN, estados, solaCalculoII)).toEqual([]);

    expect(sanearEstados(PLAN, estados).estados).toEqual({});
    expect(sanearEstados(PLAN, estados, solaCalculoII).estados).toEqual(
      estados,
    );
  });

  it("sus créditos cuentan para las demás, como los de cualquier aprobada", () => {
    // Cálculo II da 6 créditos; con Precálculo (6) llegan a los 12 de 2º año.
    const estados = {
      [CALCULO_II]: "aprobada" as const,
      [PRECALCULO]: "aprobada" as const,
    };
    expect(puedeMarcar(PLAN, estados, CALCULO_I, "regular").ok).toBe(true);
  });

  it("la cascada no la revierte", () => {
    // Al desmarcar Precálculo, Cálculo I se cae por falta de correlativa.
    // Cálculo II está desbloqueada, así que no la toca aunque también
    // dependa de Cálculo I.
    const estados = {
      [PRECALCULO]: "aprobada" as const,
      [CALCULO_I]: "aprobada" as const,
      [CALCULO_II]: "aprobada" as const,
    };

    const cambio = aplicarCambio(
      PLAN,
      estados,
      PRECALCULO,
      null,
      solaCalculoII,
    );

    expect(cambio.ok).toBe(true);
    expect(cambio.estados[CALCULO_II]).toBe("aprobada");
    expect(cambio.revertidas.map((r) => r.idMateria)).toEqual([CALCULO_I]);
  });

  it("desmarcarla se puede siempre, desbloqueada o no", () => {
    const estados = { [CALCULO_II]: "aprobada" as const };
    expect(aplicarCambio(PLAN, estados, CALCULO_II, null).ok).toBe(true);
  });
});
