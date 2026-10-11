/**
 * El bloque de sesión del panel lateral.
 *
 * Sin `VITE_GOOGLE_CLIENT_ID` no se muestra nada: la app es local y funciona
 * completa así. Iniciar sesión es para sincronizar entre dispositivos, no un
 * requisito para usarla.
 */

import { GoogleLogin } from "@react-oauth/google";

import { useMalla } from "../../store/useMalla";
import { LOGIN_DISPONIBLE, useSesion } from "../../store/useSesion";
import "./Sesion.css";

const TEXTO_SYNC = {
  local: "",
  sincronizando: "Sincronizando…",
  sincronizado: "Sincronizado",
  error: "No se pudo sincronizar",
} as const;

export function Sesion() {
  const usuario = useSesion((s) => s.usuario);
  const entrando = useSesion((s) => s.entrando);
  const error = useSesion((s) => s.error);
  const iniciar = useSesion((s) => s.iniciar);

  const sync = useMalla((s) => s.sync);
  const errorSync = useMalla((s) => s.errorSync);
  const sincronizar = useMalla((s) => s.sincronizar);
  const salirDeLaSesion = useMalla((s) => s.salirDeLaSesion);

  if (!LOGIN_DISPONIBLE) return null;

  if (!usuario) {
    return (
      <section className="sesion">
        <h2>Sincronizar</h2>
        <p className="sesion__ayuda">
          Entrá con Google para tener tu progreso en todos tus dispositivos.
        </p>
        {entrando ? (
          <p className="sesion__estado">Entrando…</p>
        ) : (
          <GoogleLogin
            onSuccess={(respuesta) => {
              const idToken = respuesta.credential;
              if (!idToken) return;
              void iniciar(idToken).then((ok) => {
                if (ok) void sincronizar();
              });
            }}
            onError={() => {
              /* el propio botón ya le muestra el error al usuario */
            }}
            text="signin_with"
            width="244"
          />
        )}
        {error && <p className="sesion__error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="sesion">
      <div className="sesion__usuario">
        {usuario.foto_url && (
          <img src={usuario.foto_url} alt="" width={28} height={28} />
        )}
        <div className="sesion__datos">
          <strong>{usuario.nombre ?? usuario.email}</strong>
          <span className={`sesion__sync sesion__sync--${sync}`}>
            {TEXTO_SYNC[sync]}
          </span>
        </div>
      </div>

      {sync === "error" && (
        <p className="sesion__error">
          {errorSync} Tu progreso está guardado en este dispositivo; se
          reintenta en el próximo cambio.
        </p>
      )}

      <div className="sesion__acciones">
        <button
          type="button"
          className="boton"
          onClick={() => salirDeLaSesion(false)}
        >
          Cerrar sesión
        </button>
        <button
          type="button"
          className="boton boton--peligro"
          onClick={() => salirDeLaSesion(true)}
          title="Cierra la sesión y borra el progreso de este dispositivo. Lo sincronizado queda en tu cuenta."
        >
          Salir y borrar de acá
        </button>
      </div>
    </section>
  );
}
