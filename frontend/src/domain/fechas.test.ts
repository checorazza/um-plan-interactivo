import { describe, expect, it } from "vitest";

import {
  estaVencida,
  hoy,
  mostrarFecha,
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
