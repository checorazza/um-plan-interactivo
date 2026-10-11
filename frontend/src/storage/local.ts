/**
 * Persistencia en `localStorage`.
 *
 * Es el camino por defecto de la app: sin sesión, el progreso vive acá y nada
 * más. Por eso todo está envuelto en try/catch —en modo incógnito, con el
 * storage bloqueado por el navegador o con la cuota llena, cualquier acceso
 * puede tirar— y leer siempre puede devolver nada. La app tiene que andar
 * igual: lo peor que puede pasar es empezar de cero, nunca romperse.
 *
 * Lo guardado es dato, no verdad: antes de usarlo se valida la forma acá y
 * después las reglas, con `sanearEstados`.
 */

import type { Estado, Estados } from "../types/estado";

const PREFIJO = "um-plan";

/**
 * Versión del formato guardado. Subirla cuando cambie la forma del dato, y
 * agregar el caso correspondiente en `migrar`.
 */
export const VERSION = 1;

const ESTADOS_VALIDOS: Estado[] = ["regular", "aprobada"];

interface Guardado {
  version: number;
  estados: Estados;
  actualizadoEn: string;
}

function claveEstados(idCarrera: number): string {
  return `${PREFIJO}:estados:${idCarrera}`;
}

const CLAVE_CARRERA = `${PREFIJO}:carrera`;

/** `localStorage`, o null si el navegador no lo deja usar. */
function almacen(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Acceder a la propiedad ya puede tirar si las cookies están bloqueadas.
    return null;
  }
}

function leerCrudo(clave: string): unknown {
  const storage = almacen();
  if (!storage) return null;
  try {
    const texto = storage.getItem(clave);
    return texto === null ? null : JSON.parse(texto);
  } catch {
    return null;
  }
}

function escribirCrudo(clave: string, valor: unknown): boolean {
  const storage = almacen();
  if (!storage) return false;
  try {
    storage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    // Cuota llena o storage de sólo lectura.
    return false;
  }
}

function borrarCrudo(clave: string): void {
  const storage = almacen();
  if (!storage) return;
  try {
    storage.removeItem(clave);
  } catch {
    /* no hay nada que hacer */
  }
}

/**
 * Se queda sólo con las entradas que tienen la forma correcta.
 *
 * El contenido de localStorage es editable por cualquiera desde la consola, y
 * puede venir de una versión vieja de la app.
 */
function sanearForma(valor: unknown): Estados {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  const estados: Estados = {};
  for (const [clave, estado] of Object.entries(valor as Record<string, unknown>)) {
    const idMateria = Number(clave);
    if (!Number.isInteger(idMateria) || idMateria <= 0) continue;
    if (typeof estado !== "string") continue;
    if (!ESTADOS_VALIDOS.includes(estado as Estado)) continue;
    estados[idMateria] = estado as Estado;
  }
  return estados;
}

/**
 * Lleva un dato guardado al formato actual.
 *
 * Hoy sólo existe la versión 1. Cuando haya una 2, este es el lugar donde se
 * convierte lo viejo en vez de descartarlo.
 */
function migrar(valor: unknown): Estados | null {
  if (!valor || typeof valor !== "object") return null;

  const dato = valor as Partial<Guardado>;
  if (dato.version === VERSION) return sanearForma(dato.estados);

  // Versión desconocida (de una app más nueva, o dato corrupto): se ignora.
  return null;
}

/** El progreso guardado para una carrera. `{}` si no hay nada utilizable. */
export function leerEstados(idCarrera: number): Estados {
  return migrar(leerCrudo(claveEstados(idCarrera))) ?? {};
}

/** Guarda el progreso. Devuelve `false` si el navegador no lo permitió. */
export function guardarEstados(idCarrera: number, estados: Estados): boolean {
  const guardado: Guardado = {
    version: VERSION,
    estados,
    actualizadoEn: new Date().toISOString(),
  };
  return escribirCrudo(claveEstados(idCarrera), guardado);
}

export function borrarEstados(idCarrera: number): void {
  borrarCrudo(claveEstados(idCarrera));
}

/** Cuándo se guardó por última vez el progreso de una carrera. */
export function leerActualizadoEn(idCarrera: number): string | null {
  const valor = leerCrudo(claveEstados(idCarrera));
  if (!valor || typeof valor !== "object") return null;
  const dato = (valor as Partial<Guardado>).actualizadoEn;
  return typeof dato === "string" ? dato : null;
}

/** La última carrera que el usuario tenía abierta. */
export function leerCarrera(): number | null {
  const valor = leerCrudo(CLAVE_CARRERA);
  return typeof valor === "number" && Number.isInteger(valor) ? valor : null;
}

export function guardarCarrera(idCarrera: number): void {
  escribirCrudo(CLAVE_CARRERA, idCarrera);
}

/** Borra todo lo que la app guardó. Para el botón de reiniciar. */
export function borrarTodo(): void {
  const storage = almacen();
  if (!storage) return;
  try {
    const claves: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const clave = storage.key(i);
      if (clave?.startsWith(`${PREFIJO}:`)) claves.push(clave);
    }
    for (const clave of claves) storage.removeItem(clave);
  } catch {
    /* no hay nada que hacer */
  }
}
