/**
 * La sesión con Google.
 *
 * Está separada del store de la malla a propósito: la malla tiene que
 * funcionar entera sin sesión, y mezclar las dos cosas invita a que algo del
 * camino principal termine dependiendo del login.
 *
 * El token se guarda en localStorage para no pedir login en cada visita. Vive
 * donde el JavaScript de la página lo puede leer, así que no es a prueba de
 * XSS: el riesgo acá es que alguien vea o edite qué materias aprobó una
 * persona, no algo más grave, y la alternativa (cookie HttpOnly) obliga a que
 * API y front compartan dominio, que con Vercel + Neon no es el caso.
 */

import { create } from "zustand";

import {
  ErrorDeApi,
  GOOGLE_CLIENT_ID,
  getMe,
  postAuthGoogle,
  usarToken,
} from "../api/cliente";
import { borrarSesion, guardarSesion, leerSesion } from "../storage/local";
import type { Usuario } from "../types/usuario";

/** `false` si no hay client id configurado: la app queda sólo local. */
export const LOGIN_DISPONIBLE = GOOGLE_CLIENT_ID !== "";

interface EstadoSesion {
  usuario: Usuario | null;
  entrando: boolean;
  error: string | null;

  /** Lee la sesión guardada y la valida contra la API. */
  restaurar: () => Promise<void>;
  /** Canjea el ID token de Google por el JWT de la API. */
  iniciar: (idToken: string) => Promise<boolean>;
  cerrar: () => void;
  limpiarError: () => void;
}

export const useSesion = create<EstadoSesion>((set) => ({
  usuario: null,
  entrando: false,
  error: null,

  restaurar: async () => {
    const sesion = leerSesion();
    if (!sesion) return;

    // El token se usa optimistamente y después se valida: así la UI no
    // parpadea entre "sin sesión" y "con sesión" en cada carga.
    usarToken(sesion.token);
    set({ usuario: sesion.usuario });

    try {
      const usuario = await getMe();
      set({ usuario });
      guardarSesion({ token: sesion.token, usuario });
    } catch (error) {
      if (error instanceof ErrorDeApi && error.esSesionVencida) {
        usarToken(null);
        borrarSesion();
        set({ usuario: null });
      }
      // Cualquier otro error (la API caída, por ejemplo) no cierra la sesión:
      // se sigue con lo que había guardado.
    }
  },

  iniciar: async (idToken) => {
    set({ entrando: true, error: null });
    try {
      const { access_token, usuario } = await postAuthGoogle(idToken);
      usarToken(access_token);
      guardarSesion({ token: access_token, usuario });
      set({ usuario, entrando: false });
      return true;
    } catch (error) {
      const mensaje =
        error instanceof ErrorDeApi ? error.message : "No se pudo iniciar sesión";
      set({ entrando: false, error: mensaje });
      return false;
    }
  },

  cerrar: () => {
    usarToken(null);
    borrarSesion();
    set({ usuario: null, error: null });
  },

  limpiarError: () => set({ error: null }),
}));
