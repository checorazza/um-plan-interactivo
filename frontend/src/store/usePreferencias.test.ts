import { describe, expect, it } from "vitest";

import { POR_DEFECTO } from "../storage/preferencias";
import { variablesDe } from "./usePreferencias";

describe("variablesDe", () => {
  it("sin preferencias no pisa ninguna variable", () => {
    expect(variablesDe(POR_DEFECTO)).toEqual({});
  });

  it("el fondo y los enlaces van tal cual", () => {
    expect(variablesDe({ ...POR_DEFECTO, fondo: "#101010" })).toEqual({
      "--fondo": "#101010",
    });
    expect(variablesDe({ ...POR_DEFECTO, colorEnlaces: "#808080" })).toEqual({
      "--arista": "#808080",
    });
  });

  it("de un color elegido derivan los tres tokens de la familia", () => {
    const variables = variablesDe({
      ...POR_DEFECTO,
      colores: { ...POR_DEFECTO.colores, aprobada: "#00aa55" },
    });

    expect(variables["--aprobada-borde"]).toBe("#00aa55");
    // El fondo y el texto se mezclan contra las variables del tema, no contra
    // un color fijo: el mismo elegido tiene que andar en claro y en oscuro.
    expect(variables["--aprobada-fondo"]).toBe(
      "color-mix(in srgb, #00aa55 16%, var(--superficie))",
    );
    expect(variables["--aprobada-texto"]).toBe(
      "color-mix(in srgb, #00aa55 55%, var(--texto))",
    );
  });

  it("cada referencia pisa la familia de tokens que le corresponde", () => {
    const variables = variablesDe({
      ...POR_DEFECTO,
      colores: {
        aprobada: "#111111",
        regular: "#222222",
        cursando: "#555555",
        disponible: "#333333",
        sinCreditos: "#444444",
      },
    });

    expect(variables["--regular-borde"]).toBe("#222222");
    // "Disponible" es una materia sin estado y "sin créditos" una bloqueada.
    expect(variables["--sin-estado-borde"]).toBe("#333333");
    expect(variables["--bloqueada-borde"]).toBe("#444444");
  });
});
