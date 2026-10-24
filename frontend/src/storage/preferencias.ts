/**
 * Las preferencias de aspecto: tema, fondo, colores y enlaces.
 *
 * Van en su propia clave de `localStorage`, aparte del progreso: son cosas
 * distintas y con ciclos de vida distintos (reiniciar el progreso no tiene
 * por qué devolver los colores al original).
 *
 * Los colores terminan escritos como propiedades personalizadas de CSS, y lo
 * guardado en `localStorage` lo puede editar cualquiera desde la consola. Por
 * eso se validan contra `#rrggbb` al leer: un valor arbitrario ahí adentro
 * sería CSS inyectado en la página.
 */

import {
  PREFIJO,
  borrarCrudo,
  escribirCrudo,
  leerCrudo,
} from "./crudo";

export const VERSION_PREFERENCIAS = 1;

const CLAVE = `${PREFIJO}:preferencias`;

/** `auto` sigue al sistema, que es lo que hacía la app antes de esta opción. */
export type Tema = "auto" | "claro" | "oscuro";

const TEMAS: Tema[] = ["auto", "claro", "oscuro"];

/**
 * Los colores que el usuario puede cambiar, uno por referencia de la malla.
 *
 * "Falta la correlativa" no está porque no tiene color propio: es una materia
 * disponible con el borde cortado.
 */
export type ClaveColor = "aprobada" | "regular" | "disponible" | "sinCreditos";

export const CLAVES_COLOR: ClaveColor[] = [
  "aprobada",
  "regular",
  "disponible",
  "sinCreditos",
];

/** `null` en un color significa "el del tema". */
export type Colores = Record<ClaveColor, string | null>;

export interface Preferencias {
  tema: Tema;
  mostrarEnlaces: boolean;
  /**
   * Esconde el enlace cuando las dos materias que une están aprobadas: ya no
   * dice nada que el color de las tarjetas no diga.
   */
  ocultarEnlacesAprobados: boolean;
  fondo: string | null;
  /** El color de las líneas entre materias. */
  colorEnlaces: string | null;
  colores: Colores;
  /** Confeti y sonido al aprobar una materia. */
  festejar: boolean;
}

export const POR_DEFECTO: Preferencias = {
  tema: "auto",
  mostrarEnlaces: true,
  ocultarEnlacesAprobados: false,
  fondo: null,
  colorEnlaces: null,
  colores: {
    aprobada: null,
    regular: null,
    disponible: null,
    sinCreditos: null,
  },
  festejar: true,
};

const HEXA = /^#[0-9a-f]{6}$/i;

/** Un color válido y normalizado, o null. Nada más entra al CSS. */
export function sanearColor(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().toLowerCase();
  return HEXA.test(limpio) ? limpio : null;
}

function sanearColores(valor: unknown): Colores {
  const colores: Colores = { ...POR_DEFECTO.colores };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return colores;
  const crudo = valor as Record<string, unknown>;
  for (const clave of CLAVES_COLOR) {
    colores[clave] = sanearColor(crudo[clave]);
  }
  return colores;
}

/** Copia defensiva: el objeto por defecto no se puede mutar desde afuera. */
function porDefecto(): Preferencias {
  return { ...POR_DEFECTO, colores: { ...POR_DEFECTO.colores } };
}

/**
 * Lleva al formato actual cualquier cosa con forma de preferencias.
 *
 * Se usa con lo de `localStorage` y con lo que viene de un archivo
 * importado: los dos son dato de afuera.
 */
export function interpretarPreferencias(valor: unknown): Preferencias {
  if (!valor || typeof valor !== "object") return porDefecto();

  const crudo = valor as Record<string, unknown>;
  // De momento sólo existe la versión 1; una futura incompatible empieza de
  // cero, que acá no cuesta nada: son preferencias, no datos del usuario.
  if (crudo.version !== VERSION_PREFERENCIAS) return porDefecto();

  return {
    tema: TEMAS.includes(crudo.tema as Tema) ? (crudo.tema as Tema) : "auto",
    mostrarEnlaces:
      typeof crudo.mostrarEnlaces === "boolean" ? crudo.mostrarEnlaces : true,
    ocultarEnlacesAprobados: crudo.ocultarEnlacesAprobados === true,
    fondo: sanearColor(crudo.fondo),
    colorEnlaces: sanearColor(crudo.colorEnlaces),
    colores: sanearColores(crudo.colores),
    festejar: crudo.festejar !== false,
  };
}

export function leerPreferencias(): Preferencias {
  return interpretarPreferencias(leerCrudo(CLAVE));
}

export function guardarPreferencias(preferencias: Preferencias): boolean {
  return escribirCrudo(CLAVE, {
    version: VERSION_PREFERENCIAS,
    ...preferencias,
  });
}

export function borrarPreferencias(): void {
  borrarCrudo(CLAVE);
}
