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
 *
 * El progreso se guarda en **un solo mapa plano** por id de materia, igual que
 * en el servidor. Los ids son únicos entre carreras, así que partirlo por
 * carrera no aportaba nada y obligaba a traducir en cada sincronización.
 *
 * Aparte va un segundo mapa, `basicas`, con el estado de cada materia común a
 * varias ingenierías. Sin sesión la app sólo conoce el plan que tiene abierto,
 * así que no sabe qué id tiene Cálculo I en las otras carreras: guardar el
 * estado contra el grupo de la básica es lo que permite que, al abrir otra
 * carrera, aparezca ya aprobada.
 */

import type { Estado, Estados } from "../types/estado";
import type { Plan } from "../types/plan";
import type { Usuario } from "../types/usuario";

const PREFIJO = "um-plan";

/**
 * Versión del formato guardado.
 *
 * - 1: una clave por carrera, `um-plan:estados:<idCarrera>`.
 * - 2: una sola clave `um-plan:estados` con todas las materias juntas.
 * - 3: se agrega `basicas`, el estado por grupo de materia común.
 */
export const VERSION = 3;

const CLAVE_ESTADOS = `${PREFIJO}:estados`;
const CLAVE_CARRERA = `${PREFIJO}:carrera`;
const CLAVE_SESION = `${PREFIJO}:sesion`;

const ESTADOS_VALIDOS: Estado[] = ["regular", "aprobada"];

interface Guardado {
  version: number;
  estados: Estados;
  /** Estado por id de básica, para compartir el progreso entre carreras. */
  basicas: Estados;
  actualizadoEn: string;
}

export interface Sesion {
  token: string;
  usuario: Usuario;
}

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

function clavesConPrefijo(): string[] {
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
 * Junta el progreso del formato 1, que tenía una clave por carrera.
 *
 * Devuelve null si no había nada que migrar. Los ids de materia son únicos
 * entre carreras, así que las claves viejas se pueden unir sin colisiones.
 */
function migrarDesdeV1(): Estados | null {
  const viejas = clavesConPrefijo().filter((c) =>
    c.startsWith(`${CLAVE_ESTADOS}:`),
  );
  if (viejas.length === 0) return null;

  const estados: Estados = {};
  for (const clave of viejas) {
    const valor = leerCrudo(clave);
    if (valor && typeof valor === "object") {
      Object.assign(estados, sanearForma((valor as Partial<Guardado>).estados));
    }
  }

  escribirCrudo(CLAVE_ESTADOS, {
    version: VERSION,
    estados,
    actualizadoEn: new Date().toISOString(),
  });
  for (const clave of viejas) borrarCrudo(clave);

  return estados;
}

/** Lo guardado, ya llevado al formato actual. */
function leerGuardado(): { estados: Estados; basicas: Estados } {
  const valor = leerCrudo(CLAVE_ESTADOS);

  if (valor && typeof valor === "object") {
    const dato = valor as Partial<Guardado>;
    if (dato.version === VERSION) {
      return {
        estados: sanearForma(dato.estados),
        basicas: sanearForma(dato.basicas),
      };
    }
    // La 2 tenía la misma forma, sin `basicas`: se adopta tal cual.
    if (dato.version === 2) {
      return { estados: sanearForma(dato.estados), basicas: {} };
    }
    // Versión desconocida (de una app más nueva, o dato corrupto): se ignora.
    return { estados: {}, basicas: {} };
  }

  return { estados: migrarDesdeV1() ?? {}, basicas: {} };
}

/** Todo el progreso guardado, de todas las carreras. */
export function leerTodo(): Estados {
  return leerGuardado().estados;
}

/** El estado de cada materia básica, por id de grupo. */
export function leerBasicas(): Estados {
  return leerGuardado().basicas;
}

/** Guarda todo el progreso. Devuelve `false` si el navegador no lo permitió. */
export function guardarTodo(estados: Estados, basicas?: Estados): boolean {
  const guardado: Guardado = {
    version: VERSION,
    estados,
    basicas: basicas ?? leerGuardado().basicas,
    actualizadoEn: new Date().toISOString(),
  };
  return escribirCrudo(CLAVE_ESTADOS, guardado);
}

/**
 * Registra el estado de una básica, o lo borra con `null`.
 *
 * Sólo se llama ante un cambio **explícito** del usuario. Lo que descarta
 * `sanearEstados` al abrir una carrera no toca este mapa: que una básica no
 * sea alcanzable en un plan no significa que el usuario la haya desaprobado
 * en el otro.
 */
export function registrarBasica(idBasica: number, estado: Estado | null): void {
  const { estados, basicas } = leerGuardado();
  if (estado === null) delete basicas[idBasica];
  else basicas[idBasica] = estado;
  guardarTodo(estados, basicas);
}

/**
 * Pasa al mapa de básicas los estados que quedaron guardados por materia.
 *
 * Hace falta porque el servidor guarda el progreso por materia, sin saber de
 * grupos: al traer el progreso de la nube, una básica llega como estado de
 * una materia concreta. Acá se adopta en el grupo la primera vez que se abre
 * la carrera que la contiene.
 */
export function adoptarBasicas(plan: Plan): void {
  const { estados, basicas } = leerGuardado();
  let hubo = false;

  for (const [idMateria, materia] of plan.materias) {
    if (materia.id_basica === null) continue;
    const propio = estados[idMateria];
    if (!propio) continue;

    // El grupo manda; una entrada suelta por materia sólo sirve para sembrarlo.
    if (!basicas[materia.id_basica]) basicas[materia.id_basica] = propio;
    delete estados[idMateria];
    hubo = true;
  }

  if (hubo) guardarTodo(estados, basicas);
}

/**
 * El progreso que corresponde a las materias de un plan.
 *
 * El estado de una básica vive **sólo** en el mapa de grupos, nunca duplicado
 * por carrera: si se guardara en las dos, desmarcarla en una dejaría la copia
 * de la otra viva y las carreras se desincronizarían.
 *
 * `propagados` son las que salieron del grupo. Si el plan de esta carrera no
 * las admite, `sanearEstados` las va a descartar de la vista, y eso no es un
 * dato perdido —siguen aprobadas en la otra carrera—, así que no se anuncian.
 */
export function leerDeCarrera(plan: Plan): {
  estados: Estados;
  propagados: number[];
} {
  const { estados: todo, basicas } = leerGuardado();
  const estados: Estados = {};
  const propagados: number[] = [];

  for (const [idMateria, materia] of plan.materias) {
    if (materia.id_basica !== null) {
      const compartido = basicas[materia.id_basica];
      if (compartido) {
        estados[idMateria] = compartido;
        propagados.push(idMateria);
      }
      continue;
    }
    const propio = todo[idMateria];
    if (propio) estados[idMateria] = propio;
  }

  return { estados, propagados };
}

/**
 * Reemplaza el progreso de las materias de un plan, dejando intacto el del
 * resto de las carreras.
 */
export function guardarDeCarrera(plan: Plan, estados: Estados): boolean {
  const { estados: todo, basicas } = leerGuardado();

  for (const idMateria of plan.materias.keys()) delete todo[idMateria];

  // Las básicas no se guardan por materia: su estado vive en el grupo, y lo
  // escribe `registrarBasica` cuando el usuario cambia algo a propósito. Si
  // se escribieran acá, lo que descarta `sanearEstados` al abrir una carrera
  // borraría el progreso de la otra.
  for (const [idMateria, estado] of Object.entries(estados)) {
    const materia = plan.materias.get(Number(idMateria));
    if (materia && materia.id_basica !== null) continue;
    todo[Number(idMateria)] = estado;
  }

  return guardarTodo(todo, basicas);
}

/** Cuándo se guardó el progreso por última vez. */
export function leerActualizadoEn(): string | null {
  const valor = leerCrudo(CLAVE_ESTADOS);
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

/** La sesión abierta, si la hay. */
export function leerSesion(): Sesion | null {
  const valor = leerCrudo(CLAVE_SESION);
  if (!valor || typeof valor !== "object") return null;

  const dato = valor as Partial<Sesion>;
  if (typeof dato.token !== "string" || !dato.token) return null;
  if (!dato.usuario || typeof dato.usuario !== "object") return null;
  if (typeof dato.usuario.id_usuario !== "number") return null;

  return { token: dato.token, usuario: dato.usuario };
}

export function guardarSesion(sesion: Sesion): void {
  escribirCrudo(CLAVE_SESION, sesion);
}

export function borrarSesion(): void {
  borrarCrudo(CLAVE_SESION);
}

/** Borra el progreso, dejando la sesión y la carrera elegida. */
export function borrarProgreso(): void {
  borrarCrudo(CLAVE_ESTADOS);
  for (const clave of clavesConPrefijo()) {
    if (clave.startsWith(`${CLAVE_ESTADOS}:`)) borrarCrudo(clave);
  }
}

/** Borra todo lo que la app guardó, sesión incluida. */
export function borrarTodo(): void {
  for (const clave of clavesConPrefijo()) borrarCrudo(clave);
}
