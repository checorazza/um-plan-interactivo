import { describe, expect, it } from "vitest";

import {
  formatear,
  hexAHsv,
  hexARgb,
  hsvAHex,
  parsear,
  rgbAHex,
} from "./color";

describe("hexa y rgb", () => {
  it("van y vuelven", () => {
    expect(hexARgb("#f54927")).toEqual({ r: 245, g: 73, b: 39 });
    expect(rgbAHex({ r: 245, g: 73, b: 39 })).toBe("#f54927");
  });

  it("redondean y recortan lo que se va de rango", () => {
    expect(rgbAHex({ r: 300, g: -5, b: 127.6 })).toBe("#ff0080");
  });
});

describe("hexa y hsv", () => {
  it("van y vuelven sin perder el color", () => {
    for (const hex of ["#000000", "#ffffff", "#f54927", "#2a5bd7", "#1f9254"]) {
      expect(hsvAHex(hexAHsv(hex))).toBe(hex);
    }
  });

  it("el rojo puro es tono 0, saturación y valor al máximo", () => {
    expect(hexAHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
  });

  it("los grises no tienen tono ni saturación", () => {
    const { s, v } = hexAHsv("#808080");
    expect(s).toBe(0);
    expect(v).toBeCloseTo(0.502, 2);
  });

  it("el tono da la vuelta en vez de irse de rango", () => {
    expect(hsvAHex({ h: 360, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvAHex({ h: -120, s: 1, v: 1 })).toBe("#0000ff");
  });
});

describe("formatear", () => {
  it("hexa en mayúsculas y sin el numeral, que va aparte en la UI", () => {
    expect(formatear("#f54927", "hex")).toBe("F54927");
  });

  it("rgb y hsl", () => {
    expect(formatear("#f54927", "rgb")).toBe("245, 73, 39");
    expect(formatear("#ff0000", "hsl")).toBe("0, 100%, 50%");
  });
});

describe("parsear", () => {
  it("acepta hexa con y sin numeral, y el corto", () => {
    expect(parsear("#F54927")).toBe("#f54927");
    expect(parsear("f54927")).toBe("#f54927");
    expect(parsear("#f00")).toBe("#ff0000");
  });

  it("acepta rgb escrito de varias formas", () => {
    expect(parsear("245, 73, 39")).toBe("#f54927");
    expect(parsear("rgb(245 73 39)")).toBe("#f54927");
  });

  it("acepta hsl", () => {
    expect(parsear("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(parsear("120, 100%, 50%")).toBe("#00ff00");
  });

  it("devuelve null mientras no sea un color", () => {
    // El campo se escribe a mano: hasta que el texto está completo no hay
    // nada que aplicar, y eso no es un error.
    for (const texto of ["", "#f5", "f5492", "rojo", "1, 2", "a, b, c"]) {
      expect(parsear(texto)).toBeNull();
    }
  });

  it("recorta los valores fuera de rango en vez de dar vuelta el color", () => {
    expect(parsear("300, -5, 128")).toBe("#ff0080");
  });
});
