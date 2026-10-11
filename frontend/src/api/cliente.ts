/**
 * Cliente HTTP de la API.
 *
 * La app funciona sin backend: si la API no responde, la malla sigue andando
 * con lo que haya en localStorage. Por eso los errores se devuelven como
 * `ErrorDeApi` y no se tragan en silencio.
 */

import type { Carrera } from "../types/carrera";
import type { Estado, EstadoMateria, Estados } from "../types/estado";
import type { RespuestaPlan } from "../types/plan";
import type { Usuario } from "../types/usuario";

/**
 * Dónde vive la API.
 *
 * En producción el front y la API comparten dominio —Vercel manda `/api/*` al
 * servicio de Flask—, así que `VITE_API_URL` va vacío y las llamadas salen
 * relativas. En local apunta al Flask de al lado. El prefijo `/api` es el
 * mismo en los dos casos.
 */
const BASE = `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000"}/api`;

/** Client ID de Google. Vacío = la app es sólo local, sin botón de login. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

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

  /** El token venció o ya no sirve: hay que volver a iniciar sesión. */
  get esSesionVencida() {
    return this.estado === 401;
  }
}

/**
 * El JWT de la sesión. Lo setea el store de sesión; el cliente no lo lee de
 * localStorage para no tener dos dueños del mismo dato.
 */
let token: string | null = null;

export function usarToken(nuevo: string | null) {
  token = nuevo;
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const cabeceras: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opciones.headers as Record<string, string> | undefined),
  };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, { ...opciones, headers: cabeceras });
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

// --- catálogo (público) ---

export function getCarreras(): Promise<Carrera[]> {
  return pedir<Carrera[]>("/carreras");
}

export function getPlan(idCarrera: number): Promise<RespuestaPlan> {
  return pedir<RespuestaPlan>(`/carreras/${idCarrera}/plan`);
}

// --- sesión ---

export interface RespuestaLogin {
  access_token: string;
  usuario: Usuario;
}

export function postAuthGoogle(idToken: string): Promise<RespuestaLogin> {
  return pedir<RespuestaLogin>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export function getMe(): Promise<Usuario> {
  return pedir<Usuario>("/me");
}

// --- progreso ---

export async function getMisEstados(): Promise<Estados> {
  const filas = await pedir<EstadoMateria[]>("/me/estados");
  const estados: Estados = {};
  for (const fila of filas) estados[fila.id_materia] = fila.estado;
  return estados;
}

/** Reemplaza todo el progreso del usuario en el servidor. */
export function putMisEstados(estados: Estados): Promise<EstadoMateria[]> {
  const cuerpo = Object.entries(estados).map(([clave, estado]) => ({
    id_materia: Number(clave),
    estado: estado as Estado,
  }));
  return pedir<EstadoMateria[]>("/me/estados", {
    method: "PUT",
    body: JSON.stringify({ estados: cuerpo }),
  });
}
