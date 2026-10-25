import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POR_DEFECTO,
  VERSION_PREFERENCIAS,
  guardarPreferencias,
  leerPreferencias,
  sanearColor,
} from "./preferencias";

/** Un localStorage de mentira, con la misma API que el del navegador. */
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

const CLAVE = "um-plan:preferencias";

describe("preferencias", () => {
  it("sin nada guardado devuelve los valores por defecto", () => {
    expect(leerPreferencias()).toEqual(POR_DEFECTO);
  });

  it("guarda y vuelve a leer", () => {
    const preferencias = {
      tema: "oscuro" as const,
      mostrarEnlaces: false,
      ocultarEnlacesAprobados: true,
      fondo: "#102030",
      colorEnlaces: "#445566",
      colores: {
        aprobada: "#00ff00",
        regular: null,
        disponible: null,
        cursando: null,
        sinCreditos: "#123456",
      },
      festejar: false,
    };
    expect(guardarPreferencias(preferencias)).toBe(true);
    expect(leerPreferencias()).toEqual(preferencias);
  });

  it("no toca el progreso: va en su propia clave", () => {
    guardarPreferencias({ ...POR_DEFECTO, tema: "claro" });
    expect(almacen.length).toBe(1);
    expect(almacen.key(0)).toBe(CLAVE);
  });

  it("empieza de cero si la versión no es la que entiende", () => {
    almacen.setItem(
      CLAVE,
      JSON.stringify({ version: VERSION_PREFERENCIAS + 1, tema: "oscuro" }),
    );
    expect(leerPreferencias()).toEqual(POR_DEFECTO);
  });

  it("aguanta basura en el storage", () => {
    almacen.setItem(CLAVE, "no es json");
    expect(leerPreferencias()).toEqual(POR_DEFECTO);
  });

  it("las opciones de enlaces tienen su propio valor por defecto", () => {
    // Mostrar los enlaces viene en sí; esconder los de las aprobadas, en no.
    almacen.setItem(
      CLAVE,
      JSON.stringify({ version: VERSION_PREFERENCIAS }),
    );

    const preferencias = leerPreferencias();
    expect(preferencias.mostrarEnlaces).toBe(true);
    expect(preferencias.ocultarEnlacesAprobados).toBe(false);
    // El festejo viene en sí: apagarlo es la excepción, así que sólo un
    // `false` explícito lo apaga.
    expect(preferencias.festejar).toBe(true);
  });

  it("descarta un tema que no existe", () => {
    almacen.setItem(
      CLAVE,
      JSON.stringify({ version: VERSION_PREFERENCIAS, tema: "neón" }),
    );
    expect(leerPreferencias().tema).toBe("auto");
  });

  it("no deja entrar colores que no sean #rrggbb", () => {
    // El valor termina en una propiedad de CSS: cualquier otra cosa sería
    // CSS inyectado desde el storage, que el usuario puede editar a mano.
    almacen.setItem(
      CLAVE,
      JSON.stringify({
        version: VERSION_PREFERENCIAS,
        fondo: "red; background-image: url(http://ajeno/x)",
        colores: { aprobada: "javascript:alert(1)", regular: "#AABBCC" },
      }),
    );

    const preferencias = leerPreferencias();
    expect(preferencias.fondo).toBeNull();
    expect(preferencias.colores.aprobada).toBeNull();
    // El válido entra, normalizado a minúsculas.
    expect(preferencias.colores.regular).toBe("#aabbcc");
  });

  it("sin storage devuelve los valores por defecto y no tira", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(leerPreferencias()).toEqual(POR_DEFECTO);
    expect(guardarPreferencias(POR_DEFECTO)).toBe(false);
  });
});

describe("sanearColor", () => {
  it("acepta #rrggbb", () => {
    expect(sanearColor("#A1B2C3")).toBe("#a1b2c3");
    expect(sanearColor(" #000000 ")).toBe("#000000");
  });

  it("rechaza todo lo demás", () => {
    for (const valor of [
      "#abc",
      "rojo",
      "rgb(0,0,0)",
      "#12345g",
      "#1234567",
      "",
      null,
      42,
      {},
    ]) {
      expect(sanearColor(valor)).toBeNull();
    }
  });
});
