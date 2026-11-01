import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIN_MOVER,
  VERSION_TABLERO,
  guardarDesplazamiento,
  leerDesplazamiento,
  leerTodosLosDesplazamientos,
} from "./tablero";

class AlmacenFalso implements Storage {
  private datos = new Map<string, string>();
  get length() {
    return this.datos.size;
  }
  key(i: number) {
    return [...this.datos.keys()][i] ?? null;
  }
  getItem(clave: string) {
    return this.datos.get(clave) ?? null;
  }
  setItem(clave: string, valor: string) {
    this.datos.set(clave, valor);
  }
  removeItem(clave: string) {
    this.datos.delete(clave);
  }
  clear() {
    this.datos.clear();
  }
}

let almacen: AlmacenFalso;

beforeEach(() => {
  almacen = new AlmacenFalso();
  vi.stubGlobal("localStorage", almacen);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLAVE = "um-plan:tablero";

describe("desplazamiento del plan", () => {
  it("sin nada guardado, el plan está en su lugar", () => {
    expect(leerDesplazamiento("Bioingeniería")).toEqual(SIN_MOVER);
  });

  it("guarda y vuelve a leer", () => {
    guardarDesplazamiento("Bioingeniería", { x: 120, y: -40 });
    expect(leerDesplazamiento("Bioingeniería")).toEqual({ x: 120, y: -40 });
  });

  it("cada carrera tiene el suyo", () => {
    guardarDesplazamiento("Bioingeniería", { x: 10, y: 10 });
    guardarDesplazamiento("Ingeniería Industrial", { x: 300, y: 0 });

    expect(leerDesplazamiento("Bioingeniería")).toEqual({ x: 10, y: 10 });
    expect(leerDesplazamiento("Ingeniería Industrial")).toEqual({
      x: 300,
      y: 0,
    });
  });

  it("volver al lugar original no deja una entrada guardada", () => {
    // Si no, se acumularía un `{x: 0, y: 0}` por cada carrera abierta.
    guardarDesplazamiento("Bioingeniería", { x: 120, y: -40 });
    guardarDesplazamiento("Bioingeniería", SIN_MOVER);

    expect(leerTodosLosDesplazamientos()).toEqual({});
    expect(almacen.getItem(CLAVE)).toBeNull();
  });

  it("descarta lo que no sean dos números", () => {
    almacen.setItem(
      CLAVE,
      JSON.stringify({
        version: VERSION_TABLERO,
        porCarrera: {
          Buena: { x: 5, y: 6 },
          SinY: { x: 5 },
          Texto: { x: "cinco", y: 6 },
          Nula: null,
        },
      }),
    );

    expect(leerTodosLosDesplazamientos()).toEqual({ Buena: { x: 5, y: 6 } });
  });

  it("una versión que no entiende se ignora entera", () => {
    almacen.setItem(
      CLAVE,
      JSON.stringify({
        version: VERSION_TABLERO + 1,
        porCarrera: { Bioingeniería: { x: 5, y: 6 } },
      }),
    );

    expect(leerDesplazamiento("Bioingeniería")).toEqual(SIN_MOVER);
  });

  it("aguanta basura", () => {
    almacen.setItem(CLAVE, "no es json");
    expect(leerTodosLosDesplazamientos()).toEqual({});
  });
});
