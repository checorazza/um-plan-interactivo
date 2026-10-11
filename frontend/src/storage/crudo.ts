/**
 * Acceso crudo a `localStorage`, compartido por los módulos que guardan algo.
 *
 * Todo está envuelto en try/catch: en modo incógnito, con el storage
 * bloqueado por el navegador o con la cuota llena, cualquier acceso puede
 * tirar. Leer siempre puede devolver nada y escribir siempre puede fallar; la
 * app tiene que andar igual.
 */

export const PREFIJO = "um-plan";

/** `localStorage`, o null si el navegador no lo deja usar. */
export function almacen(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Acceder a la propiedad ya puede tirar si las cookies están bloqueadas.
    return null;
  }
}

export function leerCrudo(clave: string): unknown {
  const storage = almacen();
  if (!storage) return null;
  try {
    const texto = storage.getItem(clave);
    return texto === null ? null : JSON.parse(texto);
  } catch {
    return null;
  }
}

export function escribirCrudo(clave: string, valor: unknown): boolean {
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

export function borrarCrudo(clave: string): void {
  const storage = almacen();
  if (!storage) return;
  try {
    storage.removeItem(clave);
  } catch {
    /* no hay nada que hacer */
  }
}

export function clavesConPrefijo(): string[] {
  const storage = almacen();
  if (!storage) return [];
  try {
    const claves: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const clave = storage.key(i);
      if (clave?.startsWith(`${PREFIJO}:`)) claves.push(clave);
    }
    return claves;
  } catch {
    return [];
  }
}
