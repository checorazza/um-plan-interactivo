import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VERSION,
  borrarEstados,
  borrarTodo,
  guardarCarrera,
  guardarEstados,
  leerActualizadoEn,
  leerCarrera,
  leerEstados,
} from "./local";

/** Un localStorage de mentira, con la misma API que el del navegador. */
class AlmacenFalso implements Storage {
  private datos = new Map<string, string>();
  /** Para simular cuota llena o storage de sólo lectura. */
  fallaAlEscribir = false;

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
    if (this.fallaAlEscribir) throw new DOMException("QuotaExceededError");
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

describe("estados", () => {
  it("devuelve vacío cuando no hay nada guardado", () => {
    expect(leerEstados(1)).toEqual({});
  });

  it("guarda y vuelve a leer", () => {
    expect(guardarEstados(1, { 3: "aprobada", 7: "regular" })).toBe(true);
    expect(leerEstados(1)).toEqual({ 3: "aprobada", 7: "regular" });
  });

  it("separa el progreso de cada carrera", () => {
    guardarEstados(1, { 3: "aprobada" });
    guardarEstados(2, { 9: "regular" });

    expect(leerEstados(1)).toEqual({ 3: "aprobada" });
    expect(leerEstados(2)).toEqual({ 9: "regular" });
  });

  it("borra el progreso de una carrera sin tocar el de otra", () => {
    guardarEstados(1, { 3: "aprobada" });
    guardarEstados(2, { 9: "regular" });

    borrarEstados(1);

    expect(leerEstados(1)).toEqual({});
    expect(leerEstados(2)).toEqual({ 9: "regular" });
  });

  it("registra cuándo se guardó", () => {
    guardarEstados(1, { 3: "aprobada" });
    const cuando = leerActualizadoEn(1);
    expect(cuando).toBeTruthy();
    expect(new Date(cuando ?? "").getTime()).not.toBeNaN();
  });
});

describe("datos corruptos o manipulados", () => {
  it("ignora un JSON inválido", () => {
    almacen.setItem("um-plan:estados:1", "{no es json");
    expect(leerEstados(1)).toEqual({});
  });

  it("ignora una versión desconocida", () => {
    almacen.setItem(
      "um-plan:estados:1",
      JSON.stringify({ version: 99, estados: { 3: "aprobada" } }),
    );
    expect(leerEstados(1)).toEqual({});
  });

  it("descarta estados que no son válidos", () => {
    almacen.setItem(
      "um-plan:estados:1",
      JSON.stringify({
        version: VERSION,
        estados: { 3: "aprobada", 4: "promocionada", 5: "regular" },
      }),
    );
    expect(leerEstados(1)).toEqual({ 3: "aprobada", 5: "regular" });
  });

  it("descarta claves que no son ids de materia", () => {
    almacen.setItem(
      "um-plan:estados:1",
      JSON.stringify({
        version: VERSION,
        estados: { 3: "aprobada", hola: "regular", "-1": "regular", "1.5": "regular" },
      }),
    );
    expect(leerEstados(1)).toEqual({ 3: "aprobada" });
  });

  it("tolera que `estados` no sea un objeto", () => {
    almacen.setItem(
      "um-plan:estados:1",
      JSON.stringify({ version: VERSION, estados: [1, 2, 3] }),
    );
    expect(leerEstados(1)).toEqual({});
  });
});

describe("cuando el navegador no deja guardar", () => {
  it("avisa que la escritura falló en vez de romper", () => {
    almacen.fallaAlEscribir = true;
    expect(guardarEstados(1, { 3: "aprobada" })).toBe(false);
  });

  it("leer sigue funcionando sin localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(leerEstados(1)).toEqual({});
    expect(leerCarrera()).toBe(null);
  });

  it("guardar sin localStorage devuelve false y no tira", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(guardarEstados(1, { 3: "aprobada" })).toBe(false);
    expect(() => borrarTodo()).not.toThrow();
  });
});

describe("carrera elegida", () => {
  it("recuerda la última carrera abierta", () => {
    guardarCarrera(7);
    expect(leerCarrera()).toBe(7);
  });

  it("ignora un valor que no es un id", () => {
    almacen.setItem("um-plan:carrera", JSON.stringify("primera"));
    expect(leerCarrera()).toBe(null);
  });
});

describe("borrarTodo", () => {
  it("borra sólo las claves de la app", () => {
    guardarEstados(1, { 3: "aprobada" });
    guardarEstados(2, { 9: "regular" });
    guardarCarrera(2);
    almacen.setItem("otra-app:cosa", "no me toques");

    borrarTodo();

    expect(leerEstados(1)).toEqual({});
    expect(leerEstados(2)).toEqual({});
    expect(leerCarrera()).toBe(null);
    expect(almacen.getItem("otra-app:cosa")).toBe("no me toques");
  });
});
