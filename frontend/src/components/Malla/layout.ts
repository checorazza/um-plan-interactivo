/**
 * Posiciones de los nodos de la malla.
 *
 * Las posiciones se **calculan** a partir del plan, nunca se guardan: si
 * cambia el plan, la malla se reacomoda sola. Cada año es una columna y las
 * materias bajan en el orden en que las devuelve la API, que ya viene por
 * semestre y código.
 *
 * Es el mismo acomodo en cualquier pantalla. Hubo una variante que apilaba
 * todo en una sola columna en el teléfono, pensada para recorrerla
 * scrolleando; se sacó porque la malla se arrastra con el dedo en cualquier
 * dirección, y entonces la forma angosta sólo escondía la estructura por
 * años, que es justamente lo que el gráfico tiene para mostrar.
 */

import type { Plan } from "../../types/plan";

export const ANCHO_NODO = 210;
/** Alto del encabezado de año. Fijo, para que el minimapa pueda dibujarlo. */
export const ALTO_NODO_ANIO = 56;

/** Separación entre columnas de años. */
const SEPARACION_ANIO = 300;
/** Aire entre una materia y la siguiente. Deja lugar al menú de acciones. */
const SEPARACION_MATERIA = 48;
/** Espacio bajo el encabezado del año. */
const ALTO_ENCABEZADO = 92;
// --- alto de una materia ---
//
// El nombre no se recorta, así que la tarjeta crece según cuántas líneas
// ocupe. El alto se **calcula**, no se mide después de pintar: React Flow
// necesita las posiciones antes, y medir implicaría dibujar, medir y
// reacomodar, con el salto visual que eso trae.
//
// Estos números son los del CSS de `Malla.css`. Si allá cambia el tamaño de
// letra, el interlineado o el padding, hay que cambiarlos acá: si se separan,
// el síntoma es texto desbordado o tarjetas con aire de más.

/**
 * Ancho en el que fluye el nombre.
 *
 * No se deriva del ancho del nodo: con `box-sizing: border-box` los bordes se
 * comen parte del ancho, y cuánto exactamente depende de cómo el navegador
 * redondee el borde de 1.5 px según la densidad de pantalla. Un píxel de
 * diferencia alcanza para que un nombre entre en un renglón o en dos, y
 * entonces el alto calculado no coincide con el real.
 *
 * Por eso el número se fija acá y se repite como `max-width` en
 * `.materia__nombre`: los dos lados tienen que usar el mismo.
 */
export const ANCHO_TEXTO = 185;
const PADDING_VERTICAL = 8;
const SEPARACION_INTERNA = 3;
const ALTO_LINEA = 17;
const ALTO_CREDITOS = 16.5;

/** Padding arriba y abajo, la separación interna y la línea de créditos. */
const ALTO_FIJO = PADDING_VERTICAL * 2 + SEPARACION_INTERNA + ALTO_CREDITOS;

export const ALTO_NODO_MINIMO = ALTO_FIJO + ALTO_LINEA;

/** La misma fuente que `.materia__nombre`. */
const FUENTE_NOMBRE =
  '600 13px ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Ancho medio de un carácter, para cuando no hay con qué medir de verdad. */
const ANCHO_CARACTER = 7.2;

export type Medidor = (texto: string) => number;

let medidorGuardado: Medidor | null = null;

/**
 * Mide texto con la fuente real, vía canvas.
 *
 * Estimar por cantidad de caracteres no alcanza: "Arquitectura de
 * Computadoras" tiene 28 caracteres y mide 183 px, pero 28 caracteres
 * angostos miden bastante menos. Con la estimación, esa tarjeta se quedaba
 * corta y el texto desbordaba.
 *
 * Fuera del navegador (tests) cae en la aproximación por caracteres.
 */
export function medidor(): Medidor {
  if (medidorGuardado) return medidorGuardado;

  try {
    const contexto = document.createElement("canvas").getContext("2d");
    if (contexto) {
      contexto.font = FUENTE_NOMBRE;
      medidorGuardado = (texto) => contexto.measureText(texto).width;
      return medidorGuardado;
    }
  } catch {
    // Sin DOM: se usa la aproximación.
  }

  medidorGuardado = (texto) => texto.length * ANCHO_CARACTER;
  return medidorGuardado;
}

/**
 * Cuántas líneas ocupa un nombre dentro de la tarjeta.
 *
 * Simula el corte por palabras del navegador: las palabras no se parten,
 * salvo que una sola no entre en un renglón.
 */
export function lineasDe(nombre: string, medir: Medidor = medidor()): number {
  const palabras = (nombre ?? "").split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return 1;

  let lineas = 1;
  let actual = "";

  for (const palabra of palabras) {
    if (actual === "") {
      actual = palabra;
    } else if (medir(`${actual} ${palabra}`) <= ANCHO_TEXTO) {
      actual = `${actual} ${palabra}`;
    } else {
      lineas += 1;
      actual = palabra;
    }

    // Una palabra sola más larga que el renglón se parte sola.
    while (medir(actual) > ANCHO_TEXTO && actual.length > 1) {
      let corte = actual.length;
      while (corte > 1 && medir(actual.slice(0, corte)) > ANCHO_TEXTO) corte -= 1;
      lineas += 1;
      actual = actual.slice(corte);
    }
  }

  return lineas;
}

/** Alto de la tarjeta de una materia, según lo que ocupe su nombre. */
export function altoDeMateria(nombre: string, medir?: Medidor): number {
  return ALTO_FIJO + lineasDe(nombre, medir) * ALTO_LINEA;
}

export interface Posicion {
  x: number;
  y: number;
}

export interface Ubicaciones {
  materias: Map<number, Posicion>;
  anios: Map<number, Posicion>;
}

/** Cada año avanza hacia la derecha y sus materias bajan. */
export function calcularUbicaciones(plan: Plan): Ubicaciones {
  const materias = new Map<number, Posicion>();
  const anios = new Map<number, Posicion>();

  const ordenados = [...plan.anios.values()].sort((a, b) => a.numero - b.numero);

  ordenados.forEach((anio, indice) => {
    const x = indice * SEPARACION_ANIO;
    anios.set(anio.id_anio, { x, y: 0 });

    // Cada materia arranca donde terminó la anterior: las tarjetas no miden
    // todas lo mismo.
    let y = ALTO_ENCABEZADO;
    for (const idMateria of plan.materiasPorAnio.get(anio.id_anio) ?? []) {
      materias.set(idMateria, { x, y });
      const nombre = plan.materias.get(idMateria)?.nombre ?? "";
      y += altoDeMateria(nombre) + SEPARACION_MATERIA;
    }
  });

  return { materias, anios };
}
