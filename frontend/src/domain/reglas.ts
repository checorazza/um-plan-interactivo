/**
 * Motor de reglas del plan de estudios.
 *
 * Funciones puras sobre `(plan, estados)`: ni React ni fetch. Es el espejo de
 * `backend/src/domain/reglas.py`; si una regla cambia, cambia en los dos lados.
 *
 * Las reglas:
 *
 * 1. Una materia está sin estado, `regular` o `aprobada`.
 * 2. Sólo las materias aprobadas otorgan créditos.
 * 3. Para marcar una materia del año N (regular *o* aprobada) hace falta que el
 *    total de créditos aprobados, de cualquier año, alcance los créditos
 *    requeridos por el año N.
 * 4. Para marcar una materia como aprobada hacen falta todas sus correlativas
 *    aprobadas.
 * 5. Regularizar no exige correlativas: alcanza con el gate de créditos.
 * 6. Un conjunto de estados es válido sólo si existe algún orden en el que se
 *    pudo haber llegado a él respetando 3 y 4.
 */

import type { Estado, Estados } from "../types/estado";
import type { Plan } from "../types/plan";

export type Causa =
  | "creditos"
  | "correlativa"
  | "desconocida"
  | "estado_invalido";

export interface Resultado {
  ok: boolean;
  /** Texto listo para mostrar en un tooltip. Vacío cuando `ok`. */
  motivo: string;
  causa?: Causa;
}

export interface Conflicto {
  idMateria: number;
  motivo: string;
  causa: Causa;
}

/** Por qué un nodo de la malla se ve bloqueado. */
export type Bloqueo =
  | "disponible"
  | "bloqueada_por_creditos"
  | "bloqueada_por_correlativa";

const OK: Resultado = { ok: true, motivo: "" };

const ESTADOS: Estado[] = ["regular", "aprobada"];

/**
 * Suma los créditos de las materias aprobadas.
 *
 * `excluyendo` saca una materia de la cuenta: una materia no puede aportar
 * créditos al requisito que habilita marcarla a ella misma.
 */
export function creditosAprobados(
  plan: Plan,
  estados: Estados,
  excluyendo?: number,
): number {
  let total = 0;
  for (const [clave, estado] of Object.entries(estados)) {
    const idMateria = Number(clave);
    if (estado !== "aprobada" || idMateria === excluyendo) continue;
    const materia = plan.materias.get(idMateria);
    if (materia) total += materia.creditos;
  }
  return total;
}

/** Créditos aprobados agrupados por id de año, para mostrar progreso. */
export function creditosPorAnio(
  plan: Plan,
  estados: Estados,
): Map<number, number> {
  const porAnio = new Map<number, number>();
  for (const idAnio of plan.anios.keys()) porAnio.set(idAnio, 0);

  for (const [clave, estado] of Object.entries(estados)) {
    if (estado !== "aprobada") continue;
    const materia = plan.materias.get(Number(clave));
    if (!materia) continue;
    const actual = porAnio.get(materia.id_anio);
    if (actual !== undefined) porAnio.set(materia.id_anio, actual + materia.creditos);
  }
  return porAnio;
}

/** Créditos que hace falta tener para tocar el año de esta materia. */
export function creditosRequeridos(plan: Plan, idMateria: number): number {
  const materia = plan.materias.get(idMateria);
  if (!materia) return 0;
  return plan.anios.get(materia.id_anio)?.creditos_requeridos ?? 0;
}

/** Correlativas de una materia que todavía no están aprobadas. */
export function correlativasFaltantes(
  plan: Plan,
  estados: Estados,
  idMateria: number,
): number[] {
  const materia = plan.materias.get(idMateria);
  if (!materia) return [];
  return materia.correlativas.filter((id) => estados[id] !== "aprobada");
}

function nombres(plan: Plan, ids: number[]): string[] {
  return ids.map((id) => plan.materias.get(id)?.nombre ?? `#${id}`);
}

/**
 * ¿Se puede poner `idMateria` en `nuevoEstado`, dado `estados`?
 *
 * El estado previo de `idMateria` no influye, y sus propios créditos nunca
 * cuentan para su propio gate. Desmarcar (`null`) siempre se puede desde el
 * punto de vista de esta materia: lo que puede romper son *otras*, y de eso se
 * encarga `aplicarCambio`.
 */
export function puedeMarcar(
  plan: Plan,
  estados: Estados,
  idMateria: number,
  nuevoEstado: Estado | null,
): Resultado {
  if (nuevoEstado === null) return OK;

  if (!ESTADOS.includes(nuevoEstado)) {
    return {
      ok: false,
      motivo: `Estado inválido: ${String(nuevoEstado)}`,
      causa: "estado_invalido",
    };
  }

  const materia = plan.materias.get(idMateria);
  if (!materia) {
    return {
      ok: false,
      motivo: `La materia #${idMateria} no pertenece a este plan`,
      causa: "desconocida",
    };
  }

  const anio = plan.anios.get(materia.id_anio);
  const requeridos = anio?.creditos_requeridos ?? 0;
  const tiene = creditosAprobados(plan, estados, idMateria);
  if (tiene < requeridos) {
    const faltan = requeridos - tiene;
    const numero = anio?.numero ?? "?";
    return {
      ok: false,
      motivo: `Te faltan ${faltan} créditos para ${numero}º año (tenés ${tiene} de ${requeridos})`,
      causa: "creditos",
    };
  }

  // Regularizar no exige correlativas; aprobar sí.
  if (nuevoEstado === "aprobada") {
    const faltantes = correlativasFaltantes(plan, estados, idMateria);
    if (faltantes.length > 0) {
      return {
        ok: false,
        motivo: `Primero tenés que aprobar: ${nombres(plan, faltantes).join(", ")}`,
        causa: "correlativa",
      };
    }
  }

  return OK;
}

/** `puedeMarcar` con `regular`, para el icono de regularizar. */
export function puedeRegularizar(
  plan: Plan,
  estados: Estados,
  idMateria: number,
): Resultado {
  return puedeMarcar(plan, estados, idMateria, "regular");
}

/** `puedeMarcar` con `aprobada`, para el icono de aprobada. */
export function puedeAprobar(
  plan: Plan,
  estados: Estados,
  idMateria: number,
): Resultado {
  return puedeMarcar(plan, estados, idMateria, "aprobada");
}

/**
 * Cómo se ve una materia en la malla.
 *
 * `bloqueada_por_creditos` es un bloqueo duro: no se puede ni regularizar.
 * `bloqueada_por_correlativa` sólo impide aprobarla.
 */
export function estadoDeBloqueo(
  plan: Plan,
  estados: Estados,
  idMateria: number,
): Bloqueo {
  if (!puedeRegularizar(plan, estados, idMateria).ok) {
    return "bloqueada_por_creditos";
  }
  if (!puedeAprobar(plan, estados, idMateria).ok) {
    return "bloqueada_por_correlativa";
  }
  return "disponible";
}

/**
 * Valida un conjunto completo de estados.
 *
 * Devuelve los conflictos de las materias que no se podrían haber marcado en
 * ningún orden. Array vacío = conjunto consistente.
 *
 * Acepta materias de a una, quedándose sólo con las que ya pasan las reglas con
 * lo aceptado hasta el momento, y repite mientras haya progreso. Funciona
 * porque los créditos sólo crecen al aceptar materias: si una materia no entra
 * ahora, tampoco va a entrar con menos aceptado.
 */
export function validarConjunto(plan: Plan, estados: Estados): Conflicto[] {
  const pendientes = new Map<number, Estado>();
  for (const [clave, estado] of Object.entries(estados)) {
    pendientes.set(Number(clave), estado);
  }
  const aceptados: Estados = {};

  let huboProgreso = true;
  while (huboProgreso) {
    huboProgreso = false;
    for (const [idMateria, estado] of [...pendientes]) {
      if (puedeMarcar(plan, aceptados, idMateria, estado).ok) {
        aceptados[idMateria] = estado;
        pendientes.delete(idMateria);
        huboProgreso = true;
      }
    }
  }

  const conflictos: Conflicto[] = [];
  for (const [idMateria, estado] of pendientes) {
    const resultado = puedeMarcar(plan, aceptados, idMateria, estado);
    conflictos.push({
      idMateria,
      motivo: resultado.motivo,
      causa: resultado.causa ?? "desconocida",
    });
  }
  return conflictos;
}

/** Una materia que la cascada tuvo que revertir. */
export interface Revertida {
  idMateria: number;
  nombre: string;
  de: Estado;
  a: Estado | null;
  motivo: string;
}

export interface Cambio {
  /** El conjunto de estados resultante, ya consistente. */
  estados: Estados;
  /** Qué hubo que revertir para que lo sea. Vacío si el cambio fue limpio. */
  revertidas: Revertida[];
  /** `false` si el cambio pedido no era posible; `estados` vuelve sin tocar. */
  ok: boolean;
  /** Por qué no se pudo, cuando `ok` es `false`. */
  motivo: string;
}

/**
 * Aplica un cambio y revierte en cascada lo que quede inconsistente.
 *
 * Si la materia en sí no se puede marcar, devuelve `ok: false` sin tocar nada.
 * Si se puede pero rompe otras, las baja de `aprobada` a `regular` cuando eso
 * alcanza, y les quita el estado cuando no, repitiendo hasta que el conjunto
 * vuelve a ser válido. Cada vuelta baja al menos una materia, así que termina.
 *
 * La UI usa `revertidas` para el diálogo de confirmación: calcula el cambio,
 * lo muestra, y recién aplica el resultado si el usuario acepta.
 */
export function aplicarCambio(
  plan: Plan,
  estados: Estados,
  idMateria: number,
  nuevoEstado: Estado | null,
): Cambio {
  const sinEsta = { ...estados };
  delete sinEsta[idMateria];

  const resultado = puedeMarcar(plan, sinEsta, idMateria, nuevoEstado);
  if (!resultado.ok) {
    return {
      estados,
      revertidas: [],
      ok: false,
      motivo: resultado.motivo,
    };
  }

  const siguiente: Estados = { ...sinEsta };
  if (nuevoEstado !== null) siguiente[idMateria] = nuevoEstado;

  const revertidas: Revertida[] = [];

  for (;;) {
    const conflictos = validarConjunto(plan, siguiente);
    if (conflictos.length === 0) break;

    for (const conflicto of conflictos) {
      const actual = siguiente[conflicto.idMateria];
      if (actual === undefined) continue;

      const resto = { ...siguiente };
      delete resto[conflicto.idMateria];

      // Bajar de aprobada a regular puede alcanzar: regularizar no exige
      // correlativas. Si tampoco se puede, se le quita el estado.
      const destino: Estado | null =
        actual === "aprobada" &&
        puedeMarcar(plan, resto, conflicto.idMateria, "regular").ok
          ? "regular"
          : null;

      if (destino === null) {
        delete siguiente[conflicto.idMateria];
      } else {
        siguiente[conflicto.idMateria] = destino;
      }

      revertidas.push({
        idMateria: conflicto.idMateria,
        nombre:
          plan.materias.get(conflicto.idMateria)?.nombre ??
          `#${conflicto.idMateria}`,
        de: actual,
        a: destino,
        motivo: conflicto.motivo,
      });
    }
  }

  return { estados: siguiente, revertidas, ok: true, motivo: "" };
}
