/**
 * Las preferencias de aspecto.
 *
 * Está separado del store de la malla porque no tiene nada que ver con el
 * progreso: son dos cosas que se guardan distinto y se borran distinto.
 *
 * El tema y los colores se aplican escribiendo sobre el `:root`, encima de
 * los tokens de `index.css`. Así nada en los componentes necesita saber que
 * esto existe: siguen usando `var(--aprobada-borde)` como siempre.
 */

import { create } from "zustand";

import {
  CLAVES_COLOR,
  POR_DEFECTO,
  type ClaveColor,
  type Preferencias,
  type Tema,
  guardarPreferencias,
  leerPreferencias,
} from "../storage/preferencias";

/**
 * De qué familia de tokens es cada referencia.
 *
 * Los nombres de las variables no coinciden con las claves porque en la malla
 * "disponible" es una materia sin estado y "sin créditos" es una bloqueada.
 */
const FAMILIA: Record<ClaveColor, string> = {
  aprobada: "aprobada",
  regular: "regular",
  disponible: "sin-estado",
  sinCreditos: "bloqueada",
};

/** Todas las variables que estas preferencias pueden pisar. */
const VARIABLES: string[] = [
  "--fondo",
  "--arista",
  ...Object.values(FAMILIA).flatMap((familia) => [
    `--${familia}-fondo`,
    `--${familia}-borde`,
    `--${familia}-texto`,
  ]),
];

/**
 * Las variables de CSS que corresponden a estas preferencias.
 *
 * De cada color elegido se derivan los tres tokens de la familia: el elegido
 * es el borde —el que identifica al estado—, el fondo es una pincelada de ese
 * color sobre la superficie y el texto una mezcla con el color de texto. Se
 * usa `color-mix` contra otras variables en vez de calcular acá los valores
 * para que el mismo color elegido quede bien en claro y en oscuro, y para que
 * cambiar el tema no obligue a recalcular nada.
 */
export function variablesDe(preferencias: Preferencias): Record<string, string> {
  const variables: Record<string, string> = {};

  if (preferencias.fondo) variables["--fondo"] = preferencias.fondo;
  // Sólo la arista normal: la de una correlativa ya aprobada toma el color
  // de "Aprobada", y la de la materia seleccionada el de acento.
  if (preferencias.colorEnlaces) variables["--arista"] = preferencias.colorEnlaces;

  for (const clave of CLAVES_COLOR) {
    const color = preferencias.colores[clave];
    if (!color) continue;
    const familia = FAMILIA[clave];
    variables[`--${familia}-borde`] = color;
    variables[`--${familia}-fondo`] =
      `color-mix(in srgb, ${color} 16%, var(--superficie))`;
    variables[`--${familia}-texto`] =
      `color-mix(in srgb, ${color} 55%, var(--texto))`;
  }

  return variables;
}

/** Escribe las preferencias en el documento. No hace nada sin DOM. */
export function aplicar(preferencias: Preferencias): void {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;

  if (preferencias.tema === "auto") {
    delete raiz.dataset.tema;
    // Con `light dark` los controles nativos (los `select`, la paleta de
    // colores) siguen al sistema, igual que los tokens.
    raiz.style.colorScheme = "";
  } else {
    raiz.dataset.tema = preferencias.tema;
    raiz.style.colorScheme = preferencias.tema === "oscuro" ? "dark" : "light";
  }

  const variables = variablesDe(preferencias);
  for (const nombre of VARIABLES) {
    const valor = variables[nombre];
    if (valor) raiz.style.setProperty(nombre, valor);
    else raiz.style.removeProperty(nombre);
  }
}

interface EstadoPreferencias extends Preferencias {
  cambiarTema: (tema: Tema) => void;
  cambiarEnlaces: (mostrar: boolean) => void;
  cambiarEnlacesAprobados: (ocultar: boolean) => void;
  cambiarFondo: (color: string | null) => void;
  cambiarColorEnlaces: (color: string | null) => void;
  cambiarColor: (clave: ClaveColor, color: string | null) => void;
  restablecer: () => void;
}

export const usePreferencias = create<EstadoPreferencias>((set) => {
  // Se lleva aparte del estado de zustand porque las acciones necesitan las
  // preferencias solas, sin los métodos, para aplicarlas y guardarlas.
  let actual = leerPreferencias();
  aplicar(actual);

  /** Un solo camino para cambiar algo: aplicar, guardar y recién ahí mostrar. */
  const asentar = (cambio: Partial<Preferencias>) => {
    actual = { ...actual, ...cambio };
    aplicar(actual);
    guardarPreferencias(actual);
    set(cambio);
  };

  return {
    ...actual,

    cambiarTema: (tema) => asentar({ tema }),
    cambiarEnlaces: (mostrarEnlaces) => asentar({ mostrarEnlaces }),
    cambiarEnlacesAprobados: (ocultarEnlacesAprobados) =>
      asentar({ ocultarEnlacesAprobados }),
    cambiarFondo: (fondo) => asentar({ fondo }),
    cambiarColorEnlaces: (colorEnlaces) => asentar({ colorEnlaces }),
    cambiarColor: (clave, color) =>
      asentar({ colores: { ...actual.colores, [clave]: color } }),
    restablecer: () =>
      asentar({ ...POR_DEFECTO, colores: { ...POR_DEFECTO.colores } }),
  };
});
