import { describe, expect, it } from "vitest";

import { arcos, porcentaje, type Porcion } from "./torta";

const CIRC = 100;
const HUECO = 2;

function porciones(a: number, r: number, f: number): Porcion[] {
  return [
    { clave: "aprobadas", etiqueta: "Aprobadas", valor: a, color: "a" },
    { clave: "regulares", etiqueta: "Regulares", valor: r, color: "b" },
    { clave: "faltan", etiqueta: "Sin cursar", valor: f, color: "c" },
  ];
}

describe("arcos", () => {
  it("reparte la vuelta entera entre las porciones", () => {
    const dibujados = arcos(porciones(25, 25, 50), CIRC, 0);
    const largos = dibujados.map((arco) => arco.largo);

    expect(largos).toEqual([25, 25, 50]);
    expect(largos.reduce((a, b) => a + b, 0)).toBe(CIRC);
  });

  it("cada una arranca donde terminó la anterior", () => {
    const dibujados = arcos(porciones(25, 25, 50), CIRC, 0);
    // El desfase es negativo porque `stroke-dashoffset` corre al revés.
    expect(dibujados.map((arco) => arco.desfase)).toEqual([0, -25, -50]);
  });

  it("el hueco se le descuenta a cada porción, no se dibuja", () => {
    const dibujados = arcos(porciones(25, 25, 50), CIRC, HUECO);

    expect(dibujados.map((arco) => arco.largo)).toEqual([23, 23, 48]);
    // Los arranques no se mueven: el hueco sale del final de cada tramo.
    expect(dibujados.map((arco) => arco.desfase)).toEqual([0, -25, -50]);
  });

  it("una sola porción con valor va entera, sin hueco", () => {
    // Un hueco suelto en un anillo de un solo color parecería un pedazo
    // faltante y no una separación.
    const dibujados = arcos(porciones(10, 0, 0), CIRC, HUECO);

    expect(dibujados).toHaveLength(1);
    expect(dibujados[0]?.largo).toBe(CIRC);
  });

  it("las porciones en cero no se dibujan", () => {
    const dibujados = arcos(porciones(5, 0, 5), CIRC, HUECO);
    expect(dibujados.map((arco) => arco.clave)).toEqual([
      "aprobadas",
      "faltan",
    ]);
  });

  it("una porción que el hueco deja en nada tampoco", () => {
    // Un hilo de un píxel no se lee y ensucia el anillo.
    const dibujados = arcos(porciones(1, 400, 400), CIRC, HUECO);
    expect(dibujados.map((arco) => arco.clave)).not.toContain("aprobadas");
  });

  it("sin materias no hay nada que dibujar", () => {
    expect(arcos(porciones(0, 0, 0), CIRC, HUECO)).toEqual([]);
  });

  it("los tramos nunca se pisan entre sí", () => {
    const dibujados = arcos(porciones(7, 13, 31), CIRC, HUECO);
    for (let i = 1; i < dibujados.length; i += 1) {
      const anterior = dibujados[i - 1]!;
      const actual = dibujados[i]!;
      const finAnterior = -anterior.desfase + anterior.largo;
      expect(finAnterior).toBeLessThanOrEqual(-actual.desfase);
    }
  });
});

describe("porcentaje", () => {
  it("redondea al entero", () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
  });

  it("sin total es cero y no una división por cero", () => {
    expect(porcentaje(0, 0)).toBe(0);
  });
});
