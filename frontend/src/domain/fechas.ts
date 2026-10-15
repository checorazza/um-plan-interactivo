/**
 * La fecha de vencimiento de una regularidad.
 *
 * Se guarda y se compara como `AAAA-MM-DD` en texto, sin `Date`. Una fecha de
 * calendario no tiene hora ni huso: con `Date` habría que elegir uno, y el
 * mismo vencimiento daría vencido o no según dónde esté el navegador. En
 * texto, comparar es comparar strings y no hay nada que elegir.
 *
 * La regla no se aplica: una regularidad vencida no cambia el estado de la
 * materia ni la bloquea. Sólo se muestra en rojo.
 */

import type { Estados, FechasDeMateria } from "../types/estado";
import type { Plan } from "../types/plan";

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** Una fecha válida en `AAAA-MM-DD`, o null. */
export function sanearFecha(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (!FORMATO.test(limpio)) return null;

  // El formato no alcanza: "2027-02-31" lo pasa. Se arma la fecha en UTC y se
  // vuelve a leer, que es lo que descarta los días que no existen.
  const fecha = new Date(`${limpio}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  return fecha.toISOString().slice(0, 10) === limpio ? limpio : null;
}

/** Hoy, en el calendario local de quien mira. */
export function hoy(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/**
 * ¿Ya pasó?
 *
 * El día del vencimiento todavía no está vencido: la regularidad vale hasta
 * esa fecha inclusive.
 */
export function estaVencida(fecha: string, dia: string = hoy()): boolean {
  return fecha < dia;
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, que es como se escribe una fecha acá. */
export function mostrarFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

/**
 * Una fecha por defecto para el selector: dos años desde hoy.
 *
 * No es una regla de la facultad, es sólo dónde abrir el calendario para no
 * hacer scrollear doce meses. El usuario la cambia.
 */
export function sugerida(desde: string = hoy()): string {
  const [anio, resto] = [desde.slice(0, 4), desde.slice(4)];
  return `${Number(anio) + 2}${resto}`;
}

/** Una regularidad con fecha, lista para mostrar. */
export interface Vencimiento {
  idMateria: number;
  nombre: string;
  fecha: string;
  vencida: boolean;
}

/**
 * Las regularidades con fecha, de la que vence antes a la que vence después.
 *
 * Las ya vencidas quedan primero, que es donde corresponde: son las más
 * urgentes, no las menos. Una materia sin fecha no aparece —no hay nada que
 * avisar— y una aprobada tampoco, aunque todavía arrastre una fecha vieja en
 * memoria.
 */
export function proximosVencimientos(
  plan: Plan,
  estados: Estados,
  vencimientos: FechasDeMateria,
  dia: string = hoy(),
): Vencimiento[] {
  const lista: Vencimiento[] = [];

  for (const [clave, fecha] of Object.entries(vencimientos)) {
    const idMateria = Number(clave);
    if (estados[idMateria] !== "regular") continue;
    const materia = plan.materias.get(idMateria);
    if (!materia) continue;

    lista.push({
      idMateria,
      nombre: materia.nombre,
      fecha,
      vencida: estaVencida(fecha, dia),
    });
  }

  // A igual fecha, por nombre: si no, el orden depende de los ids y dos
  // materias que vencen el mismo día bailan entre recargas.
  return lista.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.nombre.localeCompare(b.nombre),
  );
}
