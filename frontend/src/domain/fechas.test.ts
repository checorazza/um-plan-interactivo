import { describe, expect, it } from "vitest";

import { planDePrueba } from "./fixtures";
import {
  estaVencida,
  hoy,
  mostrarFecha,
  proximosVencimientos,
  sanearFecha,
  sugerida,
} from "./fechas";

describe("sanearFecha", () => {
  it("acepta AAAA-MM-DD", () => {
    expect(sanearFecha("2027-03-12")).toBe("2027-03-12");
    expect(sanearFecha("  2027-03-12  ")).toBe("2027-03-12");
  });

  it("rechaza días que no existen", () => {
    // El formato solo no alcanza: esto lo pasa y no es una fecha.
    expect(sanearFecha("2027-02-31")).toBeNull();
    expect(sanearFecha("2027-13-01")).toBeNull();
  });

  it("el 29 de febrero sólo en año bisiesto", () => {
    expect(sanearFecha("2028-02-29")).toBe("2028-02-29");
    expect(sanearFecha("2027-02-29")).toBeNull();
  });

  it("rechaza cualquier otra cosa", () => {
    for (const valor of ["12/03/2027", "2027-3-12", "", "mañana", null, 20270312]) {
      expect(sanearFecha(valor)).toBeNull();
    }
  });
});

describe("estaVencida", () => {
  it("el día del vencimiento todavía vale", () => {
    // La regularidad vale hasta esa fecha inclusive.
    expect(estaVencida("2027-03-12", "2027-03-12")).toBe(false);
  });

  it("al día siguiente ya no", () => {
    expect(estaVencida("2027-03-12", "2027-03-13")).toBe(true);
  });

  it("una fecha futura no está vencida", () => {
    expect(estaVencida("2030-01-01", "2027-03-12")).toBe(false);
  });

  it("compara por calendario y no por números sueltos", () => {
    // Si se comparara mes a mes o día a día por separado, diciembre del año
    // pasado daría "no vencida" contra enero de éste.
    expect(estaVencida("2026-12-31", "2027-01-01")).toBe(true);
    expect(estaVencida("2027-01-01", "2026-12-31")).toBe(false);
  });
});

describe("hoy", () => {
  it("tiene el formato que el resto espera", () => {
    expect(sanearFecha(hoy())).toBe(hoy());
  });
});

describe("mostrarFecha", () => {
  it("se escribe como se escribe acá", () => {
    expect(mostrarFecha("2027-03-12")).toBe("12/03/2027");
  });
});

describe("sugerida", () => {
  it("dos años más adelante", () => {
    expect(sugerida("2026-10-11")).toBe("2028-10-11");
  });

  it("sigue siendo una fecha válida", () => {
    expect(sanearFecha(sugerida("2026-10-11"))).toBe("2028-10-11");
    expect(sanearFecha(sugerida())).not.toBeNull();
  });
});

describe("proximosVencimientos", () => {
  const PLAN = planDePrueba();
  const HOY = "2027-01-01";

  it("ordena del que vence antes al que vence después", () => {
    const lista = proximosVencimientos(
      PLAN,
      { 1: "regular", 2: "regular", 3: "regular" },
      { 1: "2028-05-01", 2: "2027-03-01", 3: "2029-01-01" },
      HOY,
    );
    expect(lista.map((v) => v.idMateria)).toEqual([2, 1, 3]);
  });

  it("las vencidas van primero: son las más urgentes", () => {
    const lista = proximosVencimientos(
      PLAN,
      { 1: "regular", 2: "regular" },
      { 1: "2028-05-01", 2: "2026-06-01" },
      HOY,
    );
    expect(lista.map((v) => v.idMateria)).toEqual([2, 1]);
    expect(lista[0]?.vencida).toBe(true);
    expect(lista[1]?.vencida).toBe(false);
  });

  it("a igual fecha, por nombre, para que el orden no baile", () => {
    const lista = proximosVencimientos(
      PLAN,
      { 1: "regular", 2: "regular" },
      { 1: "2027-03-01", 2: "2027-03-01" },
      HOY,
    );
    const nombres = lista.map((v) => v.nombre);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b)));
  });

  it("deja afuera lo que no es una regularidad con fecha", () => {
    const lista = proximosVencimientos(
      PLAN,
      // Aprobada: la fecha puede seguir en memoria, pero ya no vence nada.
      { 1: "aprobada", 2: "regular" },
      { 1: "2027-02-01", 2: "2027-03-01", 999: "2027-01-05" },
      HOY,
    );
    expect(lista.map((v) => v.idMateria)).toEqual([2]);
  });

  it("sin fechas no devuelve nada", () => {
    expect(proximosVencimientos(PLAN, { 1: "regular" }, {}, HOY)).toEqual([]);
  });
});
