/**
 * El gate de créditos se compara contra el **total** aprobado, de cualquier
 * año, no contra los créditos de ese año. Es la confusión fácil de esta
 * regla, así que es lo que más se prueba acá.
 */

import { describe, expect, it } from "vitest";

import { planDePrueba } from "../../domain/fixtures";
import { requisitosPorAnio } from "./requisitos";

const PLAN = planDePrueba();

// 1º pide 0, 2º pide 12 y 3º pide 38.
// Precálculo (1) da 6, Química (2) da 4, Informática (3) da 7.

describe("requisitosPorAnio", () => {
  it("deja afuera los años que no piden créditos", () => {
    const { anios } = requisitosPorAnio(PLAN, {});
    expect(anios.map((a) => a.numero)).toEqual([2, 3]);
  });

  it("sin nada aprobado, falta todo", () => {
    const { total, anios } = requisitosPorAnio(PLAN, {});
    expect(total).toBe(0);
    expect(anios[0]).toEqual({
      numero: 2,
      requeridos: 12,
      cubiertos: 0,
      faltan: 12,
      cumplido: false,
    });
  });

  it("los créditos de cualquier año cuentan para todos los gates", () => {
    // 6 + 7 = 13, de materias de primero: alcanza para el gate de segundo.
    const { total, anios } = requisitosPorAnio(PLAN, {
      1: "aprobada",
      3: "aprobada",
    });
    expect(total).toBe(13);
    expect(anios[0]?.cumplido).toBe(true);
    expect(anios[1]?.faltan).toBe(38 - 13);
  });

  it("las regulares no suman", () => {
    const { total } = requisitosPorAnio(PLAN, { 1: "regular", 3: "regular" });
    expect(total).toBe(0);
  });

  it("lo cubierto no pasa de lo requerido", () => {
    // Si no, la barra se pasaría de largo.
    const { anios } = requisitosPorAnio(PLAN, {
      1: "aprobada",
      2: "aprobada",
      3: "aprobada",
    });
    expect(anios[0]?.cubiertos).toBe(12);
    expect(anios[0]?.faltan).toBe(0);
  });

  it("al llegar justo, el año queda destrabado", () => {
    // 12 exactos: la regla es "alcanza", no "supera".
    const { anios } = requisitosPorAnio(PLAN, { 1: "aprobada", 3: "aprobada" });
    const segundo = anios.find((a) => a.numero === 2);
    expect(segundo?.requeridos).toBe(12);
    expect(segundo?.cumplido).toBe(true);
  });

  it("los años salen en orden", () => {
    const { anios } = requisitosPorAnio(PLAN, {});
    const numeros = anios.map((a) => a.numero);
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
  });
});
