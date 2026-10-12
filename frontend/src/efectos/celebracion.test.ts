/**
 * La física del confeti.
 *
 * El dibujo y el sonido necesitan navegador y no se prueban acá; esto es la
 * parte pura, que es la que puede quedar mal sin que se note: una partícula
 * que no muere nunca deja el canvas y su `requestAnimationFrame` corriendo
 * para siempre.
 */

import { describe, expect, it } from "vitest";

import { avanzar, crearParticulas, opacidad } from "./celebracion";

/** Azar de mentira, para que las partículas salgan siempre iguales. */
function azarFijo(valor = 0.5) {
  return () => valor;
}

const COLORES = ["#111111", "#222222"];

describe("crearParticulas", () => {
  it("salen de los dos costados", () => {
    const particulas = crearParticulas(1000, 800, COLORES, azarFijo());
    const x = new Set(particulas.map((p) => p.x));
    expect([...x].sort((a, b) => a - b)).toEqual([0, 1000]);
  });

  it("arrancan hacia arriba y hacia adentro", () => {
    const particulas = crearParticulas(1000, 800, COLORES, azarFijo());

    for (const particula of particulas) {
      // El eje y crece hacia abajo, así que subir es velocidad negativa.
      expect(particula.vy).toBeLessThan(0);
      // Las de la izquierda van hacia la derecha y al revés.
      if (particula.x === 0) expect(particula.vx).toBeGreaterThan(0);
      else expect(particula.vx).toBeLessThan(0);
    }
  });

  it("usa sólo los colores que se le pasan", () => {
    const particulas = crearParticulas(1000, 800, COLORES, azarFijo(0.9));
    for (const particula of particulas) {
      expect(COLORES).toContain(particula.color);
    }
  });

  it("arrancan abajo, no en el medio de la pantalla", () => {
    const particulas = crearParticulas(1000, 800, COLORES, azarFijo());
    for (const particula of particulas) {
      expect(particula.y).toBeGreaterThan(800 * 0.7);
    }
  });
});

describe("avanzar", () => {
  function unaParticula() {
    return crearParticulas(1000, 800, COLORES, azarFijo())[0]!;
  }

  it("la gravedad la termina bajando", () => {
    const particula = unaParticula();
    const alturaInicial = particula.y;

    // Sube primero...
    for (let i = 0; i < 10; i += 1) avanzar(particula, 1 / 60);
    expect(particula.y).toBeLessThan(alturaInicial);

    // ...y después cae por debajo de donde salió.
    for (let i = 0; i < 90; i += 1) avanzar(particula, 1 / 60);
    expect(particula.y).toBeGreaterThan(alturaInicial);
  });

  it("todas mueren: el canvas no se queda animando para siempre", () => {
    const particulas = crearParticulas(1000, 800, COLORES, Math.random);
    // Dos segundos y pico a 60 cuadros por segundo.
    const vivas = particulas.filter((particula) => {
      let viva = true;
      for (let i = 0; i < 150 && viva; i += 1) viva = avanzar(particula, 1 / 60);
      return viva;
    });
    expect(vivas).toHaveLength(0);
  });

  it("devuelve false justo cuando se le acaba la vida", () => {
    const particula = unaParticula();
    expect(avanzar(particula, particula.vida - 0.001)).toBe(true);
    expect(avanzar(particula, 0.002)).toBe(false);
  });

  it("un salto grande de tiempo no la manda al infinito", () => {
    // Pasa al volver a una pestaña que estuvo en segundo plano.
    const particula = unaParticula();
    avanzar(particula, 0.05);
    expect(Number.isFinite(particula.x)).toBe(true);
    expect(Number.isFinite(particula.y)).toBe(true);
  });
});

describe("opacidad", () => {
  it("es 1 mientras le sobra vida y baja al final", () => {
    const particula = unaParticula();
    expect(opacidad(particula)).toBe(1);

    particula.vida = 0.2;
    expect(opacidad(particula)).toBeGreaterThan(0);
    expect(opacidad(particula)).toBeLessThan(1);

    particula.vida = 0;
    expect(opacidad(particula)).toBe(0);
  });

  function unaParticula() {
    return crearParticulas(1000, 800, COLORES, azarFijo())[0]!;
  }
});
