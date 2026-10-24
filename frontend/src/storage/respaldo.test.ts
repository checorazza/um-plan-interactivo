/**
 * El archivo exportado lo puede editar cualquiera y puede venir de otra
 * máquina, así que lo que más importa acá es qué se rechaza y que las
 * **claves naturales** viajen: sin ellas el archivo sólo serviría contra la
 * misma base de datos.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  guardarDeCarrera,
  leerContenido,
  leerDeCarrera,
  registrarBasica,
} from "./local";
import { planDePrueba } from "../domain/fixtures";
import {
  VERSION_RESPALDO,
  armarRespaldo,
  aplicarRespaldo,
  leerRespaldo,
  nombreDeArchivo,
} from "./respaldo";

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

beforeEach(() => {
  vi.stubGlobal("localStorage", new AlmacenFalso());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Guarda algo de progreso y devuelve el texto del archivo exportado. */
function exportarDePrueba(): string {
  guardarDeCarrera(
    planDePrueba(),
    { 1: "aprobada", 2: "regular" },
    {
      desbloqueadas: new Set([2]),
      vencimientos: { 2: "2028-03-01" },
      aprobaciones: { 1: "2026-07-15" },
    },
  );
  return JSON.stringify(armarRespaldo(leerContenido()));
}

describe("armarRespaldo", () => {
  it("lleva todo el progreso, con las claves naturales", () => {
    const respaldo = JSON.parse(exportarDePrueba());
    const progreso = respaldo.progreso;

    expect(progreso.estados).toEqual({ 1: "aprobada", 2: "regular" });
    expect(progreso.desbloqueadas).toEqual([2]);
    expect(progreso.vencimientos).toEqual({ 2: "2028-03-01" });
    expect(progreso.aprobaciones).toEqual({ 1: "2026-07-15" });
    // Sin esto el archivo no sirve en otra base: los ids cambian.
    expect(progreso.claves["1"]).toBe("Ingeniería en Informática|CP00");
  });

  it("el set de desbloqueadas sale como lista, que es lo que entiende JSON", () => {
    const respaldo = JSON.parse(exportarDePrueba());
    expect(Array.isArray(respaldo.progreso.desbloqueadas)).toBe(true);
  });
});

describe("leerRespaldo", () => {
  it("va y vuelve sin perder nada", () => {
    const texto = exportarDePrueba();
    const lectura = leerRespaldo(texto);

    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;

    expect(lectura.contenido.estados).toEqual({ 1: "aprobada", 2: "regular" });
    expect([...lectura.contenido.desbloqueadas]).toEqual([2]);
    expect(lectura.contenido.vencimientos).toEqual({ 2: "2028-03-01" });
    expect(lectura.resumen).toMatchObject({
      aprobadas: 1,
      regulares: 1,
      desbloqueadas: 1,
      fechas: 2,
    });
  });

  it("rechaza lo que no es JSON", () => {
    const lectura = leerRespaldo("esto no es json");
    expect(lectura.ok).toBe(false);
  });

  it("rechaza un JSON de otra cosa", () => {
    // Un archivo cualquiera no puede pisar el progreso por tener forma de
    // objeto.
    const lectura = leerRespaldo(JSON.stringify({ hola: "mundo" }));
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.motivo).toMatch(/no es un respaldo/i);
  });

  it("rechaza un archivo de otra versión", () => {
    const lectura = leerRespaldo(
      JSON.stringify({
        aplicacion: "um-plan-interactivo",
        version: VERSION_RESPALDO + 1,
        progreso: {},
      }),
    );
    expect(lectura.ok).toBe(false);
  });

  it("rechaza un archivo sin nada marcado", () => {
    // Importarlo pisaría el progreso con la nada, que es lo más caro de
    // deshacer de todo esto.
    const lectura = leerRespaldo(
      JSON.stringify({
        aplicacion: "um-plan-interactivo",
        version: VERSION_RESPALDO,
        exportadoEn: new Date().toISOString(),
        progreso: { version: 7, estados: {}, claves: {}, basicas: {} },
      }),
    );
    expect(lectura.ok).toBe(false);
    if (lectura.ok) return;
    expect(lectura.motivo).toMatch(/ninguna materia/i);
  });

  it("limpia lo que esté mal dentro del progreso", () => {
    const lectura = leerRespaldo(
      JSON.stringify({
        aplicacion: "um-plan-interactivo",
        version: VERSION_RESPALDO,
        progreso: {
          version: 7,
          estados: { 1: "aprobada", 2: "inventado", "-3": "regular" },
          claves: {},
          basicas: {},
          desbloqueadas: [1, "dos", -4],
          vencimientos: { 1: "no es fecha" },
          aprobaciones: {},
        },
      }),
    );

    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    expect(lectura.contenido.estados).toEqual({ 1: "aprobada" });
    expect([...lectura.contenido.desbloqueadas]).toEqual([1]);
    expect(lectura.contenido.vencimientos).toEqual({});
  });
});

describe("progreso que vive en las básicas", () => {
  // Las materias comunes a varias ingenierías guardan su estado por código,
  // en `basicas`, y **no** en `estados`. Hay planes donde casi todo lo de
  // primer año es básica: ese progreso no puede quedar afuera del resumen,
  // porque entonces el propio archivo exportado se rechazaría al importarlo.
  function conBasicas() {
    const plan = planDePrueba();
    const precalculo = plan.materias.get(1);
    if (precalculo) plan.materias.set(1, { ...precalculo, id_basica: 100 });
    return plan;
  }

  it("el resumen las cuenta", () => {
    registrarBasica("CP00", "aprobada");
    guardarDeCarrera(conBasicas(), {});

    const lectura = leerRespaldo(
      JSON.stringify(armarRespaldo(leerContenido())),
    );
    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    expect(lectura.resumen.aprobadas).toBe(1);
  });

  it("y el archivo se puede volver a importar", () => {
    registrarBasica("CP00", "aprobada");
    const texto = JSON.stringify(armarRespaldo(leerContenido()));

    localStorage.clear();
    const lectura = leerRespaldo(texto);
    if (!lectura.ok) throw new Error(lectura.motivo);
    aplicarRespaldo(lectura.contenido);

    expect(leerDeCarrera(conBasicas()).estados[1]).toBe("aprobada");
  });
});

describe("aplicarRespaldo", () => {
  it("pisa el progreso que había", () => {
    const texto = exportarDePrueba();

    // Otro progreso distinto en el dispositivo.
    guardarDeCarrera(planDePrueba(), { 3: "aprobada" });
    expect(leerContenido().estados).toEqual({ 3: "aprobada" });

    const lectura = leerRespaldo(texto);
    if (!lectura.ok) throw new Error(lectura.motivo);
    aplicarRespaldo(lectura.contenido);

    expect(leerContenido().estados).toEqual({ 1: "aprobada", 2: "regular" });
    expect([...leerContenido().desbloqueadas]).toEqual([2]);
  });

  it("el progreso importado se recupera aunque cambien los ids", () => {
    // El caso de llevarse el archivo a otra máquina, donde la base le dio
    // otros ids a las mismas materias.
    const texto = exportarDePrueba();
    const lectura = leerRespaldo(texto);
    if (!lectura.ok) throw new Error(lectura.motivo);
    aplicarRespaldo(lectura.contenido);

    const original = planDePrueba();
    const nuevo = planDePrueba();
    nuevo.materias = new Map(
      [...original.materias].map(([id, m]) => [
        id + 1000,
        { ...m, id_materia: id + 1000 },
      ]),
    );

    const leido = leerDeCarrera(nuevo);
    expect(leido.estados[1001]).toBe("aprobada");
    expect([...leido.desbloqueadas]).toEqual([1002]);
    expect(leido.vencimientos[1002]).toBe("2028-03-01");
  });
});

describe("nombreDeArchivo", () => {
  it("lleva la fecha, para que varios respaldos no se pisen", () => {
    expect(nombreDeArchivo(new Date(2026, 9, 24))).toBe(
      "plan-interactivo-2026-10-24.json",
    );
  });
});
