import { describe, expect, it } from "vitest";

import type { Estados } from "../types/estado";
import { planDePrueba } from "./fixtures";
import {
  aplicarCambio,
  combinarEstados,
  correlativasFaltantes,
  creditosAprobados,
  creditosPorAnio,
  creditosRequeridos,
  estadoDeBloqueo,
  puedeAprobar,
  puedeMarcar,
  puedeRegularizar,
  sanearEstados,
  validarConjunto,
} from "./reglas";

const PLAN = planDePrueba();

// Ids del plan de prueba, por nombre, para que los tests se lean.
const PRECALCULO = 1;
const QUIMICA = 2;
const INFORMATICA = 3;
const CALCULO_1 = 4;
const FISICA = 5;
const CALCULO_2 = 6;
const QUIMICA_ORGANICA = 7;

/** Las tres materias de 1º año aprobadas: 17 créditos. */
const PRIMER_ANIO_APROBADO: Estados = {
  [PRECALCULO]: "aprobada",
  [QUIMICA]: "aprobada",
  [INFORMATICA]: "aprobada",
};

describe("créditos", () => {
  it("sin estados no hay créditos", () => {
    expect(creditosAprobados(PLAN, {})).toBe(0);
  });

  it("sólo las aprobadas dan créditos", () => {
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [QUIMICA]: "regular",
      [INFORMATICA]: "regular",
    };
    expect(creditosAprobados(PLAN, estados)).toBe(6);
  });

  it("puede excluir una materia de la cuenta", () => {
    const estados: Estados = { [PRECALCULO]: "aprobada", [QUIMICA]: "aprobada" };
    expect(creditosAprobados(PLAN, estados)).toBe(10);
    expect(creditosAprobados(PLAN, estados, PRECALCULO)).toBe(4);
  });

  it("ignora materias de otro plan", () => {
    expect(creditosAprobados(PLAN, { 999: "aprobada" })).toBe(0);
  });

  it("agrupa por año", () => {
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [QUIMICA]: "aprobada",
      [CALCULO_1]: "aprobada",
      [FISICA]: "regular",
    };
    expect([...creditosPorAnio(PLAN, estados)]).toEqual([
      [1, 10],
      [2, 3],
      [3, 0],
    ]);
  });

  it("sabe cuántos créditos pide el año de una materia", () => {
    expect(creditosRequeridos(PLAN, PRECALCULO)).toBe(0);
    expect(creditosRequeridos(PLAN, CALCULO_1)).toBe(12);
    expect(creditosRequeridos(PLAN, CALCULO_2)).toBe(38);
    expect(creditosRequeridos(PLAN, 999)).toBe(0);
  });
});

describe("gate de créditos", () => {
  it("primer año no pide créditos", () => {
    expect(puedeMarcar(PLAN, {}, PRECALCULO, "aprobada").ok).toBe(true);
  });

  it("bloquea segundo año sin créditos", () => {
    const resultado = puedeMarcar(PLAN, {}, CALCULO_1, "regular");
    expect(resultado.ok).toBe(false);
    expect(resultado.causa).toBe("creditos");
    expect(resultado.motivo).toContain("Te faltan 12 créditos para 2º año");
  });

  it("habilita segundo año recién cuando alcanzan los créditos", () => {
    // 6 + 4 = 10: no alcanza
    const diez: Estados = { [PRECALCULO]: "aprobada", [QUIMICA]: "aprobada" };
    expect(puedeMarcar(PLAN, diez, CALCULO_1, "regular").ok).toBe(false);
    // 6 + 4 + 7 = 17: alcanza
    expect(puedeMarcar(PLAN, PRIMER_ANIO_APROBADO, CALCULO_1, "aprobada").ok).toBe(
      true,
    );
  });

  it("cuenta créditos de cualquier año, no sólo de los anteriores", () => {
    const estados: Estados = { [PRECALCULO]: "aprobada", [INFORMATICA]: "aprobada" };
    expect(puedeMarcar(PLAN, estados, CALCULO_1, "regular").ok).toBe(true);
  });

  it("una materia no cuenta para su propio gate", () => {
    const estados: Estados = {
      ...PRIMER_ANIO_APROBADO,
      [CALCULO_1]: "aprobada",
      [CALCULO_2]: "aprobada",
    };
    const resultado = puedeMarcar(PLAN, estados, CALCULO_2, "aprobada");
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("tenés 20 de 38");
  });
});

describe("gate de correlativas", () => {
  it("aprobar exige la correlativa aprobada", () => {
    // 4 + 7 + 5 = 16 créditos; Precálculo quedó regular
    const estados: Estados = {
      [PRECALCULO]: "regular",
      [QUIMICA]: "aprobada",
      [INFORMATICA]: "aprobada",
      [FISICA]: "aprobada",
    };
    const resultado = puedeAprobar(PLAN, estados, CALCULO_1);
    expect(resultado.ok).toBe(false);
    expect(resultado.causa).toBe("correlativa");
    expect(resultado.motivo).toContain("Precálculo");
  });

  it("regularizar no exige la correlativa", () => {
    const estados: Estados = {
      [PRECALCULO]: "regular",
      [QUIMICA]: "aprobada",
      [INFORMATICA]: "aprobada",
      [FISICA]: "aprobada",
    };
    expect(puedeRegularizar(PLAN, estados, CALCULO_1).ok).toBe(true);
    expect(puedeAprobar(PLAN, estados, CALCULO_1).ok).toBe(false);
  });

  it("lista las correlativas faltantes", () => {
    expect(correlativasFaltantes(PLAN, {}, CALCULO_1)).toEqual([PRECALCULO]);
    expect(
      correlativasFaltantes(PLAN, { [PRECALCULO]: "aprobada" }, CALCULO_1),
    ).toEqual([]);
    expect(
      correlativasFaltantes(PLAN, { [PRECALCULO]: "regular" }, CALCULO_1),
    ).toEqual([PRECALCULO]);
    expect(correlativasFaltantes(PLAN, {}, PRECALCULO)).toEqual([]);
  });

  it("los créditos se chequean antes que las correlativas", () => {
    expect(puedeMarcar(PLAN, {}, CALCULO_1, "aprobada").causa).toBe("creditos");
  });
});

describe("casos borde", () => {
  it("materia desconocida", () => {
    const resultado = puedeMarcar(PLAN, {}, 999, "regular");
    expect(resultado.ok).toBe(false);
    expect(resultado.causa).toBe("desconocida");
  });

  it("estado inválido", () => {
    const resultado = puedeMarcar(
      PLAN,
      {},
      PRECALCULO,
      "promocionada" as never,
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.causa).toBe("estado_invalido");
  });

  it("desmarcar siempre se puede desde el punto de vista de la materia", () => {
    expect(puedeMarcar(PLAN, { [PRECALCULO]: "aprobada" }, PRECALCULO, null).ok).toBe(
      true,
    );
  });
});

describe("estadoDeBloqueo", () => {
  it("sin créditos, bloqueada por créditos", () => {
    expect(estadoDeBloqueo(PLAN, {}, CALCULO_1)).toBe("bloqueada_por_creditos");
  });

  it("con créditos pero sin la correlativa, bloqueada por correlativa", () => {
    const estados: Estados = {
      [PRECALCULO]: "regular",
      [QUIMICA]: "aprobada",
      [INFORMATICA]: "aprobada",
      [FISICA]: "aprobada",
    };
    expect(estadoDeBloqueo(PLAN, estados, CALCULO_1)).toBe(
      "bloqueada_por_correlativa",
    );
  });

  it("con todo cumplido, disponible", () => {
    expect(estadoDeBloqueo(PLAN, PRIMER_ANIO_APROBADO, CALCULO_1)).toBe(
      "disponible",
    );
    expect(estadoDeBloqueo(PLAN, {}, PRECALCULO)).toBe("disponible");
  });
});

describe("validarConjunto", () => {
  it("el conjunto vacío es válido", () => {
    expect(validarConjunto(PLAN, {})).toEqual([]);
  });

  it("un conjunto alcanzable es válido", () => {
    const estados: Estados = {
      ...PRIMER_ANIO_APROBADO,
      [CALCULO_1]: "aprobada",
      [FISICA]: "regular",
    };
    expect(validarConjunto(PLAN, estados)).toEqual([]);
  });

  it("detecta un salto de créditos", () => {
    const conflictos = validarConjunto(PLAN, { [CALCULO_1]: "regular" });
    expect(conflictos.map((c) => c.idMateria)).toEqual([CALCULO_1]);
    expect(conflictos[0]?.causa).toBe("creditos");
  });

  it("detecta una aprobada sin su correlativa", () => {
    // 6 + 7 = 13 créditos alcanzan para 2º año, pero Química quedó regular
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [INFORMATICA]: "aprobada",
      [QUIMICA]: "regular",
      [QUIMICA_ORGANICA]: "aprobada",
    };
    const conflictos = validarConjunto(PLAN, estados);
    expect(conflictos.map((c) => c.idMateria)).toEqual([QUIMICA_ORGANICA]);
    expect(conflictos[0]?.causa).toBe("correlativa");
  });

  it("el mismo caso con la correlativa aprobada es válido", () => {
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [INFORMATICA]: "aprobada",
      [QUIMICA]: "aprobada",
      [QUIMICA_ORGANICA]: "aprobada",
    };
    expect(validarConjunto(PLAN, estados)).toEqual([]);
  });

  it("reporta todos los conflictos, no sólo el primero", () => {
    const conflictos = validarConjunto(PLAN, {
      [CALCULO_1]: "regular",
      [CALCULO_2]: "regular",
    });
    expect(conflictos.map((c) => c.idMateria).sort()).toEqual([
      CALCULO_1,
      CALCULO_2,
    ]);
  });

  it("una materia de otro plan es un conflicto", () => {
    expect(validarConjunto(PLAN, { 999: "aprobada" })[0]?.causa).toBe(
      "desconocida",
    );
  });
});

describe("combinarEstados", () => {
  it("une los dos lados", () => {
    expect(
      combinarEstados({ [PRECALCULO]: "aprobada" }, { [QUIMICA]: "regular" }),
    ).toEqual({ [PRECALCULO]: "aprobada", [QUIMICA]: "regular" });
  });

  it("aprobada le gana a regular, venga del lado que venga", () => {
    expect(
      combinarEstados({ [PRECALCULO]: "regular" }, { [PRECALCULO]: "aprobada" }),
    ).toEqual({ [PRECALCULO]: "aprobada" });

    expect(
      combinarEstados({ [PRECALCULO]: "aprobada" }, { [PRECALCULO]: "regular" }),
    ).toEqual({ [PRECALCULO]: "aprobada" });
  });

  it("regular le gana a no tener estado", () => {
    expect(combinarEstados({}, { [PRECALCULO]: "regular" })).toEqual({
      [PRECALCULO]: "regular",
    });
  });

  it("es conmutativo", () => {
    const a: Estados = { [PRECALCULO]: "aprobada", [QUIMICA]: "regular" };
    const b: Estados = { [QUIMICA]: "aprobada", [INFORMATICA]: "regular" };
    expect(combinarEstados(a, b)).toEqual(combinarEstados(b, a));
  });

  it("no muta ninguna de las dos entradas", () => {
    const a: Estados = { [PRECALCULO]: "regular" };
    const b: Estados = { [PRECALCULO]: "aprobada" };
    combinarEstados(a, b);
    expect(a).toEqual({ [PRECALCULO]: "regular" });
    expect(b).toEqual({ [PRECALCULO]: "aprobada" });
  });

  it("nunca pierde una materia", () => {
    const a: Estados = { [PRECALCULO]: "aprobada", [QUIMICA]: "regular" };
    const b: Estados = { [INFORMATICA]: "aprobada" };
    const combinado = combinarEstados(a, b);
    for (const clave of [...Object.keys(a), ...Object.keys(b)]) {
      expect(combinado[Number(clave)]).toBeDefined();
    }
  });
});

describe("sanearEstados", () => {
  it("deja intacto un conjunto válido", () => {
    const estados: Estados = { ...PRIMER_ANIO_APROBADO, [CALCULO_1]: "regular" };
    const resultado = sanearEstados(PLAN, estados);

    expect(resultado.estados).toEqual(estados);
    expect(resultado.descartadas).toEqual([]);
  });

  it("descarta lo que ya no cumple las reglas y dice por qué", () => {
    // Como si el plan hubiera subido los créditos de 2º año desde la última vez
    const resultado = sanearEstados(PLAN, { [CALCULO_1]: "aprobada" });

    expect(resultado.estados).toEqual({});
    expect(resultado.descartadas).toHaveLength(1);
    expect(resultado.descartadas[0]?.idMateria).toBe(CALCULO_1);
    expect(resultado.descartadas[0]?.causa).toBe("creditos");
  });

  it("descarta materias que ya no están en el plan", () => {
    const resultado = sanearEstados(PLAN, {
      [PRECALCULO]: "aprobada",
      999: "aprobada",
    });

    expect(resultado.estados).toEqual({ [PRECALCULO]: "aprobada" });
    expect(resultado.descartadas.map((c) => c.idMateria)).toEqual([999]);
  });

  it("conserva lo que sí se sostiene al descartar el resto", () => {
    const resultado = sanearEstados(PLAN, {
      [PRECALCULO]: "aprobada",
      [QUIMICA]: "aprobada",
      [CALCULO_2]: "aprobada", // 3º año: imposible con 10 créditos
    });

    expect(resultado.estados).toEqual({
      [PRECALCULO]: "aprobada",
      [QUIMICA]: "aprobada",
    });
    expect(resultado.descartadas.map((c) => c.idMateria)).toEqual([CALCULO_2]);
  });

  it("lo que devuelve siempre es válido", () => {
    const resultado = sanearEstados(PLAN, {
      [PRECALCULO]: "regular",
      [CALCULO_1]: "aprobada",
      [CALCULO_2]: "aprobada",
      [QUIMICA_ORGANICA]: "aprobada",
    });
    expect(validarConjunto(PLAN, resultado.estados)).toEqual([]);
  });

  it("no muta la entrada", () => {
    const estados: Estados = { [CALCULO_1]: "aprobada" };
    sanearEstados(PLAN, estados);
    expect(estados).toEqual({ [CALCULO_1]: "aprobada" });
  });
});

describe("aplicarCambio", () => {
  it("aplica un cambio limpio sin revertir nada", () => {
    const cambio = aplicarCambio(PLAN, {}, PRECALCULO, "aprobada");

    expect(cambio.ok).toBe(true);
    expect(cambio.revertidas).toEqual([]);
    expect(cambio.estados).toEqual({ [PRECALCULO]: "aprobada" });
  });

  it("rechaza un cambio imposible sin tocar los estados", () => {
    const estados: Estados = { [PRECALCULO]: "aprobada" };
    const cambio = aplicarCambio(PLAN, estados, CALCULO_1, "regular");

    expect(cambio.ok).toBe(false);
    expect(cambio.motivo).toContain("Te faltan");
    expect(cambio.estados).toBe(estados);
  });

  it("no muta el objeto original", () => {
    const estados: Estados = { [PRECALCULO]: "aprobada" };
    aplicarCambio(PLAN, estados, QUIMICA, "aprobada");
    expect(estados).toEqual({ [PRECALCULO]: "aprobada" });
  });

  it("desmarcar una hoja no revierte nada", () => {
    const cambio = aplicarCambio(PLAN, PRIMER_ANIO_APROBADO, QUIMICA, null);

    expect(cambio.ok).toBe(true);
    expect(cambio.revertidas).toEqual([]);
    expect(cambio.estados).toEqual({
      [PRECALCULO]: "aprobada",
      [INFORMATICA]: "aprobada",
    });
  });

  it("bajar una correlativa baja de aprobada a regular lo que dependía de ella", () => {
    const estados: Estados = { ...PRIMER_ANIO_APROBADO, [CALCULO_1]: "aprobada" };
    const cambio = aplicarCambio(PLAN, estados, PRECALCULO, "regular");

    expect(cambio.ok).toBe(true);
    // Al bajar Precálculo a regular quedan 4 + 7 = 11 créditos, por debajo de
    // los 12 de 2º año: Cálculo I no se sostiene ni siquiera como regular, así
    // que pierde el estado del todo.
    expect(cambio.revertidas).toHaveLength(1);
    expect(cambio.revertidas[0]?.idMateria).toBe(CALCULO_1);
    expect(cambio.revertidas[0]?.de).toBe("aprobada");
    expect(cambio.revertidas[0]?.a).toBe(null);
    expect(validarConjunto(PLAN, cambio.estados)).toEqual([]);
  });

  it("baja a regular cuando los créditos alcanzan", () => {
    // Química Orgánica depende de Química General, pero los créditos para 2º
    // año los dan Precálculo e Informática: al bajar Química, Orgánica puede
    // seguir regular.
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [INFORMATICA]: "aprobada",
      [QUIMICA]: "aprobada",
      [QUIMICA_ORGANICA]: "aprobada",
    };
    const cambio = aplicarCambio(PLAN, estados, QUIMICA, "regular");

    expect(cambio.ok).toBe(true);
    expect(cambio.revertidas).toEqual([
      {
        idMateria: QUIMICA_ORGANICA,
        nombre: "Química Orgánica",
        de: "aprobada",
        a: "regular",
        motivo: expect.stringContaining("Química General") as string,
      },
    ]);
    expect(cambio.estados[QUIMICA_ORGANICA]).toBe("regular");
    expect(validarConjunto(PLAN, cambio.estados)).toEqual([]);
  });

  it("revierte en cascada por varios niveles", () => {
    // Cadena: Precálculo -> Cálculo I -> Cálculo II. Para tener Cálculo II hay
    // que llegar a 38 créditos, así que se arma el conjunto a mano.
    const estados: Estados = {
      [PRECALCULO]: "aprobada", // 6
      [QUIMICA]: "aprobada", // 4
      [INFORMATICA]: "aprobada", // 7
      [CALCULO_1]: "aprobada", // 3
      [FISICA]: "aprobada", // 5
      [QUIMICA_ORGANICA]: "aprobada", // 4  -> 29, no alcanza para 3º año
    };
    // Confirmamos que el conjunto de partida es válido
    expect(validarConjunto(PLAN, estados)).toEqual([]);

    const cambio = aplicarCambio(PLAN, estados, PRECALCULO, null);

    expect(cambio.ok).toBe(true);
    // Sin Precálculo quedan 23 créditos: Cálculo I, Física y Química Orgánica
    // pierden la correlativa o los créditos.
    const revertidas = cambio.revertidas.map((r) => r.idMateria).sort();
    expect(revertidas).toContain(CALCULO_1);
    expect(revertidas).toContain(FISICA);
    expect(validarConjunto(PLAN, cambio.estados)).toEqual([]);
  });

  it("siempre deja un conjunto consistente", () => {
    const estados: Estados = {
      [PRECALCULO]: "aprobada",
      [QUIMICA]: "aprobada",
      [INFORMATICA]: "aprobada",
      [CALCULO_1]: "aprobada",
      [FISICA]: "regular",
      [QUIMICA_ORGANICA]: "aprobada",
    };

    // Desmarcar cualquier materia tiene que terminar en un conjunto válido
    for (const id of Object.keys(estados).map(Number)) {
      const cambio = aplicarCambio(PLAN, estados, id, null);
      expect(validarConjunto(PLAN, cambio.estados)).toEqual([]);
    }
  });
});
