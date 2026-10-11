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
 *
 * Los ids de la base **no son estables**: recargar un plan los cambia. Por eso
 * cada estado se guarda junto con su clave natural —la carrera y el código de
 * la materia— y, si al abrir un plan un id ya no existe, el estado se
 * recupera por esa clave y se vuelve a guardar con el id nuevo. Sin eso,
 * corregir un plan borraba en silencio el progreso de todo el mundo.
 */

import type { Estado, Estados } from "../types/estado";
import type { Plan } from "../types/plan";
import type { Usuario } from "../types/usuario";
import {
  PREFIJO,
  borrarCrudo,
  clavesConPrefijo,
  escribirCrudo,
  leerCrudo,
} from "./crudo";

/**
 * Versión del formato guardado.
 *
 * - 1: una clave por carrera, `um-plan:estados:<idCarrera>`.
 * - 2: una sola clave `um-plan:estados` con todas las materias juntas.
 * - 3: se agrega `basicas`, el estado por grupo de materia común.
 * - 4: se agregan las claves naturales, y las básicas pasan a ir por código
 *      en vez de por id de grupo.
 * - 5: se agregan las materias desbloqueadas a mano.
 */
export const VERSION = 5;

const CLAVE_ESTADOS = `${PREFIJO}:estados`;
const CLAVE_CARRERA = `${PREFIJO}:carrera`;
const CLAVE_SESION = `${PREFIJO}:sesion`;

const ESTADOS_VALIDOS: Estado[] = ["regular", "aprobada"];

/** Clave natural de una materia: no depende de los ids de la base. */
export type Clave = string;

export function claveDe(carrera: string, codigo: string): Clave {
  return `${carrera}|${codigo}`;
}

interface Guardado {
  version: number;
  estados: Estados;
  /** `{id de materia: clave natural}`, para recuperar si los ids cambian. */
  claves: Record<string, Clave>;
  /** Estado de cada básica, por **código**: el id de grupo tampoco es estable. */
  basicas: Record<string, Estado>;
  /** Ids de las materias que el usuario desbloqueó a mano. */
  desbloqueadas: number[];
  actualizadoEn: string;
}

export interface Sesion {
  token: string;
  usuario: Usuario;
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

/** Igual que `sanearForma`, para el mapa de claves naturales. */
function sanearClaves(valor: unknown): Record<string, Clave> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const claves: Record<string, Clave> = {};
  for (const [id, clave] of Object.entries(valor as Record<string, unknown>)) {
    if (!Number.isInteger(Number(id))) continue;
    if (typeof clave !== "string" || !clave.includes("|")) continue;
    claves[id] = clave;
  }
  return claves;
}

/** Los ids de materia válidos de una lista cualquiera. */
function sanearIds(valor: unknown): Set<number> {
  if (!Array.isArray(valor)) return new Set();
  const ids = new Set<number>();
  for (const dato of valor) {
    const id = Number(dato);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

/** Igual que `sanearForma`, pero indexado por código de básica. */
function sanearPorCodigo(valor: unknown): Record<string, Estado> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const mapa: Record<string, Estado> = {};
  for (const [codigo, estado] of Object.entries(valor as Record<string, unknown>)) {
    if (!codigo) continue;
    if (typeof estado !== "string") continue;
    if (!ESTADOS_VALIDOS.includes(estado as Estado)) continue;
    mapa[codigo] = estado as Estado;
  }
  return mapa;
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

interface Contenido {
  estados: Estados;
  claves: Record<string, Clave>;
  basicas: Record<string, Estado>;
  desbloqueadas: Set<number>;
}

/** Lo guardado, ya llevado al formato actual. */
function leerGuardado(): Contenido {
  const valor = leerCrudo(CLAVE_ESTADOS);

  if (valor && typeof valor === "object") {
    const dato = valor as Partial<Guardado>;
    if (dato.version === VERSION) {
      return {
        estados: sanearForma(dato.estados),
        claves: sanearClaves(dato.claves),
        basicas: sanearPorCodigo(dato.basicas),
        desbloqueadas: sanearIds(dato.desbloqueadas),
      };
    }
    // La 4 es la 5 sin desbloqueos: no había ninguno, así que se adopta tal
    // cual y el resto del progreso se conserva.
    if (dato.version === 4) {
      return {
        estados: sanearForma(dato.estados),
        claves: sanearClaves(dato.claves),
        basicas: sanearPorCodigo(dato.basicas),
        desbloqueadas: new Set(),
      };
    }
    // Las versiones 2 y 3 guardaban los estados por id, igual que ahora, pero
    // sin la clave natural: se adoptan y las claves se van completando a
    // medida que se abren las carreras. Las básicas de la 3 iban por id de
    // grupo, que no sirve de clave; se descartan y se vuelven a sembrar
    // desde los estados por materia, que sí están.
    if (dato.version === 2 || dato.version === 3) {
      return {
        estados: sanearForma(dato.estados),
        claves: {},
        basicas: {},
        desbloqueadas: new Set(),
      };
    }
    // Versión desconocida (de una app más nueva, o dato corrupto): se ignora.
    return { estados: {}, claves: {}, basicas: {}, desbloqueadas: new Set() };
  }

  return {
    estados: migrarDesdeV1() ?? {},
    claves: {},
    basicas: {},
    desbloqueadas: new Set(),
  };
}

/** Todo el progreso guardado, de todas las carreras. */
export function leerTodo(): Estados {
  return leerGuardado().estados;
}

/** El estado de cada materia básica, por código. */
export function leerBasicas(): Record<string, Estado> {
  return leerGuardado().basicas;
}

/** Las claves naturales conocidas, por id de materia. */
export function leerClaves(): Record<string, Clave> {
  return leerGuardado().claves;
}

/** Lo que acompaña a los estados. Lo que no se pasa se deja como estaba. */
export interface Aparte {
  basicas?: Record<string, Estado>;
  claves?: Record<string, Clave>;
  desbloqueadas?: Set<number>;
}

/** Guarda todo el progreso. Devuelve `false` si el navegador no lo permitió. */
export function guardarTodo(estados: Estados, aparte: Aparte = {}): boolean {
  const previo = leerGuardado();
  const guardado: Guardado = {
    version: VERSION,
    estados,
    claves: aparte.claves ?? previo.claves,
    basicas: aparte.basicas ?? previo.basicas,
    desbloqueadas: [...(aparte.desbloqueadas ?? previo.desbloqueadas)].sort(
      (a, b) => a - b,
    ),
    actualizadoEn: new Date().toISOString(),
  };
  return escribirCrudo(CLAVE_ESTADOS, guardado);
}

/** Las materias desbloqueadas a mano, de todas las carreras. */
export function leerDesbloqueadas(): Set<number> {
  return leerGuardado().desbloqueadas;
}

/**
 * Registra el estado de una básica, o lo borra con `null`.
 *
 * Sólo se llama ante un cambio **explícito** del usuario. Lo que descarta
 * `sanearEstados` al abrir una carrera no toca este mapa: que una básica no
 * sea alcanzable en un plan no significa que el usuario la haya desaprobado
 * en el otro.
 */
export function registrarBasica(codigo: string, estado: Estado | null): void {
  const { estados, basicas, claves } = leerGuardado();
  if (estado === null) delete basicas[codigo];
  else basicas[codigo] = estado;
  guardarTodo(estados, { basicas, claves });
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
  const { estados, basicas, claves } = leerGuardado();
  let hubo = false;

  for (const [idMateria, materia] of plan.materias) {
    if (materia.id_basica === null) continue;
    const propio = estados[idMateria];
    if (!propio) continue;

    // El grupo manda; una entrada suelta por materia sólo sirve para
    // sembrarlo. Se indexa por código, que no cambia al recargar el plan.
    if (!basicas[materia.codigo]) basicas[materia.codigo] = propio;
    delete estados[idMateria];
    delete claves[idMateria];
    hubo = true;
  }

  if (hubo) guardarTodo(estados, { basicas, claves });
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
  desbloqueadas: Set<number>;
  propagados: number[];
} {
  const {
    estados: todo,
    basicas,
    claves,
    desbloqueadas: todasDesbloqueadas,
  } = leerGuardado();

  // Lo guardado, indexado por clave natural: así se puede recuperar aunque
  // el id haya cambiado porque se recargó el plan.
  const porClave = new Map<Clave, Estado>();
  const desbloqueadasPorClave = new Set<Clave>();
  for (const [id, clave] of Object.entries(claves)) {
    const estado = todo[Number(id)];
    if (estado) porClave.set(clave, estado);
    if (todasDesbloqueadas.has(Number(id))) desbloqueadasPorClave.add(clave);
  }

  const estados: Estados = {};
  const desbloqueadas = new Set<number>();
  const propagados: number[] = [];
  let huboRecuperacion = false;

  for (const [idMateria, materia] of plan.materias) {
    const clave = claveDe(plan.carrera.nombre, materia.codigo);
    if (todasDesbloqueadas.has(idMateria)) {
      desbloqueadas.add(idMateria);
    } else if (desbloqueadasPorClave.has(clave)) {
      // Mismo caso que los estados: el plan se recargó y la materia tiene
      // otro id. El desbloqueo se recupera por carrera y código.
      desbloqueadas.add(idMateria);
      huboRecuperacion = true;
    }

    if (materia.id_basica !== null) {
      const compartido = basicas[materia.codigo];
      if (compartido) {
        estados[idMateria] = compartido;
        propagados.push(idMateria);
      }
      continue;
    }

    const propio = todo[idMateria];
    if (propio) {
      estados[idMateria] = propio;
      continue;
    }

    // El id no está: puede que el plan se haya recargado y la materia tenga
    // uno nuevo. Se la busca por carrera y código.
    const recuperado = porClave.get(clave);
    if (recuperado) {
      estados[idMateria] = recuperado;
      huboRecuperacion = true;
    }
  }

  // Lo recuperado se vuelve a guardar con los ids nuevos, así la próxima vez
  // se encuentra directo y los ids viejos dejan de ocupar lugar.
  if (huboRecuperacion) guardarDeCarrera(plan, estados, desbloqueadas);

  return { estados, desbloqueadas, propagados };
}

/**
 * Reemplaza el progreso de las materias de un plan, dejando intacto el del
 * resto de las carreras.
 */
export function guardarDeCarrera(
  plan: Plan,
  estados: Estados,
  desbloqueadas: Set<number> = new Set(),
): boolean {
  const {
    estados: todo,
    basicas,
    claves,
    desbloqueadas: todasDesbloqueadas,
  } = leerGuardado();

  // Fuera lo viejo de esta carrera: por id actual y por clave natural, que
  // es lo que queda colgado cuando los ids cambiaron.
  const deLaCarrera = new Set<Clave>();
  for (const materia of plan.materias.values()) {
    deLaCarrera.add(claveDe(plan.carrera.nombre, materia.codigo));
  }
  for (const [id, clave] of Object.entries(claves)) {
    if (!deLaCarrera.has(clave)) continue;
    delete todo[Number(id)];
    delete claves[id];
    todasDesbloqueadas.delete(Number(id));
  }
  for (const idMateria of plan.materias.keys()) {
    delete todo[idMateria];
    delete claves[idMateria];
    todasDesbloqueadas.delete(idMateria);
  }

  // Las básicas no se guardan por materia: su estado vive en el grupo, y lo
  // escribe `registrarBasica` cuando el usuario cambia algo a propósito. Si
  // se escribieran acá, lo que descarta `sanearEstados` al abrir una carrera
  // borraría el progreso de la otra.
  for (const [idMateria, estado] of Object.entries(estados)) {
    const materia = plan.materias.get(Number(idMateria));
    if (!materia || materia.id_basica !== null) continue;
    todo[Number(idMateria)] = estado;
    claves[idMateria] = claveDe(plan.carrera.nombre, materia.codigo);
  }

  // Los desbloqueos sí se guardan por materia, también los de las básicas:
  // desbloquear es una excepción a las reglas *de este plan*, y el mismo
  // código puede estar disponible en otra carrera.
  for (const idMateria of desbloqueadas) {
    const materia = plan.materias.get(idMateria);
    if (!materia) continue;
    todasDesbloqueadas.add(idMateria);
    claves[idMateria] = claveDe(plan.carrera.nombre, materia.codigo);
  }

  return guardarTodo(todo, {
    basicas,
    claves,
    desbloqueadas: todasDesbloqueadas,
  });
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
