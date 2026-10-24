import { describe, expect, it } from "vitest";

import { aprobadasPorAnio } from "./porAnio";

describe("aprobadasPorAnio", () => {
  it("cuenta las aprobadas de cada año", () => {
    const { anios } = aprobadasPorAnio(
      { 1: "aprobada", 2: "aprobada", 3: "aprobada" },
      { 1: "2024-03-10", 2: "2024-11-20", 3: "2025-07-01" },
    );
    expect(anios).toEqual([
      { anio: 2024, cantidad: 2 },
      { anio: 2025, cantidad: 1 },
    ]);
  });

  it("rellena los años sin aprobadas", () => {
    // Si 2025 se saltara, 2024 y 2026 quedarían pegados y el gráfico diría
    // que fueron seguidos.
    const { anios } = aprobadasPorAnio(
      { 1: "aprobada", 2: "aprobada" },
      { 1: "2024-03-10", 2: "2026-07-01" },
    );
    expect(anios.map((a) => a.anio)).toEqual([2024, 2025, 2026]);
    expect(anios[1]?.cantidad).toBe(0);
  });

  it("no agrega años vacíos antes ni después", () => {
    const { anios } = aprobadasPorAnio({ 1: "aprobada" }, { 1: "2024-03-10" });
    expect(anios).toEqual([{ anio: 2024, cantidad: 1 }]);
  });

  it("marca el año con más aprobadas", () => {
    const { mejor } = aprobadasPorAnio(
      { 1: "aprobada", 2: "aprobada", 3: "aprobada" },
      { 1: "2024-03-10", 2: "2025-07-01", 3: "2025-09-01" },
    );
    expect(mejor).toBe(2025);
  });

  it("en un empate gana el más temprano, para que no baile", () => {
    const { mejor } = aprobadasPorAnio(
      { 1: "aprobada", 2: "aprobada" },
      { 1: "2024-03-10", 2: "2025-07-01" },
    );
    expect(mejor).toBe(2024);
  });

  it("cuenta aparte las aprobadas sin fecha", () => {
    const { anios, sinFecha } = aprobadasPorAnio(
      { 1: "aprobada", 2: "aprobada" },
      { 1: "2024-03-10" },
    );
    expect(anios).toEqual([{ anio: 2024, cantidad: 1 }]);
    expect(sinFecha).toBe(1);
  });

  it("las regulares no cuentan, aunque arrastren una fecha", () => {
    const { anios, sinFecha } = aprobadasPorAnio(
      { 1: "regular", 2: "aprobada" },
      { 1: "2024-01-01", 2: "2024-03-10" },
    );
    expect(anios).toEqual([{ anio: 2024, cantidad: 1 }]);
    expect(sinFecha).toBe(0);
  });

  it("sin ninguna fecha no hay años que mostrar", () => {
    const resultado = aprobadasPorAnio({ 1: "aprobada" }, {});
    expect(resultado.anios).toEqual([]);
    expect(resultado.mejor).toBeNull();
    expect(resultado.sinFecha).toBe(1);
  });

  it("sin nada aprobado tampoco", () => {
    expect(aprobadasPorAnio({}, {})).toEqual({
      anios: [],
      sinFecha: 0,
      mejor: null,
    });
  });
});
