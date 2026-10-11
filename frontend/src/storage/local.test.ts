import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { planDePrueba } from "../domain/fixtures";
import {
  VERSION,
  adoptarBasicas,
  borrarProgreso,
  borrarSesion,
  borrarTodo,
  guardarCarrera,
  guardarDeCarrera,
  guardarSesion,
  guardarTodo,
  leerActualizadoEn,
  leerCarrera,
  leerDeCarrera,
  leerBasicas,
  leerSesion,
  leerTodo,
  registrarBasica,
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

const PLAN = planDePrueba();

/** El mismo plan, pero con Precálculo (código CP00) marcada como básica. */
function armarPlanConBasica() {
  const plan = planDePrueba();
  const precalculo = plan.materias.get(1);
  if (precalculo) plan.materias.set(1, { ...precalculo, id_basica: 100 });
  return plan;
}

/**
 * El mismo plan pero con otros ids, como queda después de recargarlo en la
 * base. Los códigos y el nombre de la carrera no cambian.
 */
function planConIdsNuevos() {
  const original = planDePrueba();
  const plan = planDePrueba();
  plan.materias = new Map(
    [...original.materias].map(([id, m]) => [id + 1000, { ...m, id_materia: id + 1000 }]),
  );
  plan.materiasPorAnio = new Map(
    [...original.materiasPorAnio].map(([anio, ids]) => [anio, ids.map((i) => i + 1000)]),
  );
  return plan;
}

let almacen: AlmacenFalso;

beforeEach(() => {
  almacen = new AlmacenFalso();
  vi.stubGlobal("localStorage", almacen);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("progreso", () => {
  it("devuelve vacío cuando no hay nada guardado", () => {
    expect(leerTodo()).toEqual({});
  });

  it("guarda y vuelve a leer", () => {
    expect(guardarTodo({ 3: "aprobada", 7: "regular" })).toBe(true);
    expect(leerTodo()).toEqual({ 3: "aprobada", 7: "regular" });
  });

  it("registra cuándo se guardó", () => {
    guardarTodo({ 3: "aprobada" });
    const cuando = leerActualizadoEn();
    expect(cuando).toBeTruthy();
    expect(new Date(cuando ?? "").getTime()).not.toBeNaN();
  });
});

describe("vista por carrera", () => {
  it("lee sólo las materias del plan", () => {
    guardarTodo({ 1: "aprobada", 999: "regular" });
    expect(leerDeCarrera(PLAN).estados).toEqual({ 1: "aprobada" });
  });

  it("guardar una carrera no toca el progreso de otra", () => {
    // 999 no está en el plan de prueba: hace de "otra carrera"
    guardarTodo({ 1: "aprobada", 999: "aprobada" });

    guardarDeCarrera(PLAN, { 2: "regular" });

    expect(leerTodo()).toEqual({ 2: "regular", 999: "aprobada" });
  });

  it("guardar reemplaza, no mezcla, dentro de la carrera", () => {
    guardarTodo({ 1: "aprobada", 2: "aprobada" });
    guardarDeCarrera(PLAN, { 1: "regular" });
    expect(leerDeCarrera(PLAN).estados).toEqual({ 1: "regular" });
  });
});

describe("materias básicas", () => {
  // En el plan de prueba, Precálculo (1) pertenece a la básica 100.
  const PLAN_CON_BASICA = armarPlanConBasica();

  it("guarda y lee el estado de una básica", () => {
    registrarBasica("CP00", "aprobada");
    expect(leerBasicas()).toEqual({ CP00: "aprobada" });
  });

  it("lo borra con null", () => {
    registrarBasica("CP00", "aprobada");
    registrarBasica("CP00", null);
    expect(leerBasicas()).toEqual({});
  });

  it("una básica aprobada en otra carrera aparece acá", () => {
    registrarBasica("CP00", "aprobada");
    const { estados, propagados } = leerDeCarrera(PLAN_CON_BASICA);

    expect(estados[1]).toBe("aprobada");
    expect(propagados).toEqual([1]);
  });

  it("el estado de una básica vive sólo en el grupo", () => {
    // Guardar la carrera no deja una copia por materia: si quedaran las dos,
    // desmarcarla en una carrera dejaría viva la copia de la otra.
    registrarBasica("CP00", "aprobada");
    guardarDeCarrera(PLAN_CON_BASICA, { 1: "aprobada", 2: "regular" });

    const { estados: todo } = { estados: leerTodo() };
    expect(todo[1]).toBeUndefined();
    expect(todo[2]).toBe("regular");
    expect(leerBasicas()).toEqual({ CP00: "aprobada" });
  });

  it("desmarcarla en una carrera la desmarca en todas", () => {
    registrarBasica("CP00", "aprobada");
    expect(leerDeCarrera(PLAN_CON_BASICA).estados[1]).toBe("aprobada");

    registrarBasica("CP00", null);
    expect(leerDeCarrera(PLAN_CON_BASICA).estados[1]).toBeUndefined();
  });

  it("adopta en el grupo lo que vino por materia desde el servidor", () => {
    // El servidor guarda por materia, sin saber de grupos
    guardarTodo({ 1: "aprobada" });

    adoptarBasicas(PLAN_CON_BASICA);

    expect(leerBasicas()).toEqual({ CP00: "aprobada" });
    expect(leerTodo()[1]).toBeUndefined();
    expect(leerDeCarrera(PLAN_CON_BASICA).estados[1]).toBe("aprobada");
  });

  it("al adoptar, lo que ya estaba en el grupo manda", () => {
    registrarBasica("CP00", "aprobada");
    guardarTodo({ 1: "regular" }, { CP00: "aprobada" });

    adoptarBasicas(PLAN_CON_BASICA);

    expect(leerBasicas()).toEqual({ CP00: "aprobada" });
  });

  it("no toca las materias propias de la carrera", () => {
    registrarBasica("CP00", "aprobada");
    const { estados } = leerDeCarrera(PLAN_CON_BASICA);
    // Química General (2) no tiene básica
    expect(estados[2]).toBeUndefined();
  });

  it("guardar el progreso de una carrera no pisa el mapa de básicas", () => {
    registrarBasica("CP00", "aprobada");
    guardarDeCarrera(PLAN_CON_BASICA, {});
    expect(leerBasicas()).toEqual({ CP00: "aprobada" });
  });
});

describe("cuando cambian los ids de la base", () => {
  // Recargar un plan reasigna los ids. El progreso se guarda contra la
  // carrera y el código, que no cambian, así que tiene que sobrevivir.

  it("recupera el progreso por carrera y código", () => {
    const viejo = planDePrueba();
    guardarDeCarrera(viejo, { 2: "aprobada", 3: "regular" });

    const nuevo = planConIdsNuevos();
    const { estados } = leerDeCarrera(nuevo);

    expect(estados[1002]).toBe("aprobada");
    expect(estados[1003]).toBe("regular");
  });

  it("deja guardado el progreso con los ids nuevos", () => {
    guardarDeCarrera(planDePrueba(), { 2: "aprobada" });

    const nuevo = planConIdsNuevos();
    leerDeCarrera(nuevo);

    // La recuperación se persiste: el id viejo ya no queda dando vueltas
    const todo = leerTodo();
    expect(todo[1002]).toBe("aprobada");
    expect(todo[2]).toBeUndefined();
  });

  it("no mezcla materias de distintas carreras con el mismo código", () => {
    // Hay códigos que son materias distintas según la carrera (`3050` es uno
    // de ellos), así que la clave lleva la carrera además del código.
    // Los ids de materia son únicos entre carreras, por eso la otra carrera
    // tiene ids propios.
    guardarDeCarrera(planDePrueba(), { 2: "aprobada" });

    const otra = planConIdsNuevos();
    otra.carrera = { id_carrera: 9, nombre: "Otra Carrera" };

    expect(leerDeCarrera(otra).estados[1002]).toBeUndefined();
  });

  it("las básicas también sobreviven, porque van por código", () => {
    registrarBasica("CP00", "aprobada");

    const nuevo = planConIdsNuevos();
    const precalculo = nuevo.materias.get(1001);
    if (precalculo) nuevo.materias.set(1001, { ...precalculo, id_basica: 777 });

    expect(leerDeCarrera(nuevo).estados[1001]).toBe("aprobada");
  });

  it("desmarcar con los ids nuevos no deja el estado viejo colgado", () => {
    guardarDeCarrera(planDePrueba(), { 2: "aprobada" });

    const nuevo = planConIdsNuevos();
    leerDeCarrera(nuevo);
    guardarDeCarrera(nuevo, {});

    expect(leerTodo()).toEqual({});
  });
});

describe("migración del formato 3", () => {
  it("conserva el progreso guardado por id", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({
        version: 3,
        estados: { 2: "aprobada" },
        basicas: { 100: "aprobada" },
        actualizadoEn: "2026-01-01T00:00:00Z",
      }),
    );

    // Los estados por materia se mantienen; las básicas iban por id de
    // grupo, que no sirve de clave, y se vuelven a sembrar al abrir el plan.
    expect(leerTodo()).toEqual({ 2: "aprobada" });
    expect(leerBasicas()).toEqual({});
  });
});

describe("migración del formato 1", () => {
  function guardarComoV1(idCarrera: number, estados: Record<number, string>) {
    almacen.setItem(
      `um-plan:estados:${idCarrera}`,
      JSON.stringify({ version: 1, estados, actualizadoEn: "2026-01-01T00:00:00Z" }),
    );
  }

  it("junta las claves por carrera en una sola", () => {
    guardarComoV1(1, { 3: "aprobada" });
    guardarComoV1(2, { 9: "regular" });

    expect(leerTodo()).toEqual({ 3: "aprobada", 9: "regular" });
  });

  it("deja el dato ya convertido y borra las claves viejas", () => {
    guardarComoV1(1, { 3: "aprobada" });

    leerTodo();

    expect(almacen.getItem("um-plan:estados:1")).toBe(null);
    const guardado = JSON.parse(almacen.getItem("um-plan:estados") ?? "null");
    expect(guardado.version).toBe(VERSION);
    expect(guardado.estados).toEqual({ 3: "aprobada" });
  });

  it("sanea lo que venía mal en el formato viejo", () => {
    guardarComoV1(1, { 3: "aprobada", 4: "promocionada" });
    expect(leerTodo()).toEqual({ 3: "aprobada" });
  });

  it("no migra si ya hay dato en el formato nuevo", () => {
    guardarTodo({ 5: "regular" });
    guardarComoV1(1, { 3: "aprobada" });

    expect(leerTodo()).toEqual({ 5: "regular" });
  });
});

describe("migración del formato 2", () => {
  it("adopta el progreso y arranca sin básicas", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({
        version: 2,
        estados: { 3: "aprobada" },
        actualizadoEn: "2026-01-01T00:00:00Z",
      }),
    );

    expect(leerTodo()).toEqual({ 3: "aprobada" });
    expect(leerBasicas()).toEqual({});
  });
});

describe("datos corruptos o manipulados", () => {
  it("ignora un JSON inválido", () => {
    almacen.setItem("um-plan:estados", "{no es json");
    expect(leerTodo()).toEqual({});
  });

  it("ignora una versión desconocida", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({ version: 99, estados: { 3: "aprobada" } }),
    );
    expect(leerTodo()).toEqual({});
  });

  it("descarta estados que no son válidos", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({
        version: VERSION,
        estados: { 3: "aprobada", 4: "promocionada", 5: "regular" },
      }),
    );
    expect(leerTodo()).toEqual({ 3: "aprobada", 5: "regular" });
  });

  it("descarta claves que no son ids de materia", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({
        version: VERSION,
        estados: { 3: "aprobada", hola: "regular", "-1": "regular", "1.5": "x" },
      }),
    );
    expect(leerTodo()).toEqual({ 3: "aprobada" });
  });

  it("tolera que `estados` no sea un objeto", () => {
    almacen.setItem(
      "um-plan:estados",
      JSON.stringify({ version: VERSION, estados: [1, 2, 3] }),
    );
    expect(leerTodo()).toEqual({});
  });
});

describe("cuando el navegador no deja guardar", () => {
  it("avisa que la escritura falló en vez de romper", () => {
    almacen.fallaAlEscribir = true;
    expect(guardarTodo({ 3: "aprobada" })).toBe(false);
  });

  it("leer sigue funcionando sin localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(leerTodo()).toEqual({});
    expect(leerCarrera()).toBe(null);
    expect(leerSesion()).toBe(null);
  });

  it("guardar sin localStorage devuelve false y no tira", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(guardarTodo({ 3: "aprobada" })).toBe(false);
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

describe("sesión", () => {
  const sesion = {
    token: "jwt-de-prueba",
    usuario: {
      id_usuario: 1,
      email: "ceci@example.com",
      nombre: "Ceci",
      foto_url: null,
      es_admin: false,
    },
  };

  it("guarda y lee la sesión", () => {
    guardarSesion(sesion);
    expect(leerSesion()).toEqual(sesion);
  });

  it("la borra", () => {
    guardarSesion(sesion);
    borrarSesion();
    expect(leerSesion()).toBe(null);
  });

  it("rechaza una sesión sin token", () => {
    almacen.setItem(
      "um-plan:sesion",
      JSON.stringify({ usuario: sesion.usuario }),
    );
    expect(leerSesion()).toBe(null);
  });

  it("rechaza una sesión sin usuario válido", () => {
    almacen.setItem(
      "um-plan:sesion",
      JSON.stringify({ token: "x", usuario: { email: "a@b.com" } }),
    );
    expect(leerSesion()).toBe(null);
  });
});

describe("borrados", () => {
  it("borrarProgreso deja la sesión y la carrera", () => {
    guardarTodo({ 3: "aprobada" });
    guardarCarrera(2);
    guardarSesion({
      token: "x",
      usuario: {
        id_usuario: 1,
        email: "a@b.com",
        nombre: null,
        foto_url: null,
        es_admin: false,
      },
    });

    borrarProgreso();

    expect(leerTodo()).toEqual({});
    expect(leerCarrera()).toBe(2);
    expect(leerSesion()).not.toBe(null);
  });

  it("borrarTodo borra sólo las claves de la app", () => {
    guardarTodo({ 3: "aprobada" });
    guardarCarrera(2);
    almacen.setItem("otra-app:cosa", "no me toques");

    borrarTodo();

    expect(leerTodo()).toEqual({});
    expect(leerCarrera()).toBe(null);
    expect(almacen.getItem("otra-app:cosa")).toBe("no me toques");
  });
});
