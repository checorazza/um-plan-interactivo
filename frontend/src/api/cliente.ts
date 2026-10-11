/**
 * Cliente HTTP de la API.
 *
 * La app funciona sin backend: si la API no responde, la malla sigue andando
 * con lo que haya en localStorage. Por eso los errores se devuelven como
 * `ErrorDeApi` y no se tragan en silencio.
 */

import type { Carrera } from "../types/carrera";
import type { RespuestaPlan } from "../types/plan";

const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

export class ErrorDeApi extends Error {
  readonly estado: number;
  /** Conflictos de reglas, cuando la API responde 409 o 422. */
  readonly conflictos: unknown;

  constructor(mensaje: string, estado: number, conflictos?: unknown) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.estado = estado;
    this.conflictos = conflictos;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...opciones.headers,
      },
    });
  } catch {
    throw new ErrorDeApi("No se pudo conectar con el servidor", 0);
  }

  if (respuesta.status === 204) return undefined as T;

  const cuerpo: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const mensaje =
      cuerpo && typeof cuerpo === "object" && "message" in cuerpo
        ? String((cuerpo as { message: unknown }).message)
        : `Error ${respuesta.status}`;
    const conflictos =
      cuerpo && typeof cuerpo === "object" && "conflictos" in cuerpo
        ? (cuerpo as { conflictos: unknown }).conflictos
        : undefined;
    throw new ErrorDeApi(mensaje, respuesta.status, conflictos);
  }

  return cuerpo as T;
}

export function getCarreras(): Promise<Carrera[]> {
  return pedir<Carrera[]>("/carreras");
}

export function getPlan(idCarrera: number): Promise<RespuestaPlan> {
  return pedir<RespuestaPlan>(`/carreras/${idCarrera}/plan`);
}
