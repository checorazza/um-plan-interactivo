/**
 * Diálogo de la regla 6: cuando un cambio invalida materias ya marcadas, se
 * muestran cuáles y qué les va a pasar, y recién con la confirmación se aplica.
 *
 * El estado nunca queda inconsistente: o se acepta la cascada completa, o no
 * se cambia nada.
 */

import { useEffect, useRef } from "react";

import { useMalla } from "../../store/useMalla";
import "./ConfirmacionCascada.css";

const COMO_QUEDA = {
  regular: "pasa a regular",
  nada: "queda sin marcar",
} as const;

export function ConfirmacionCascada() {
  const cascada = useMalla((s) => s.cascada);
  const confirmar = useMalla((s) => s.confirmarCascada);
  const cancelar = useMalla((s) => s.cancelarCascada);
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cascada) return;
    dialogo.current?.focus();
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cancelar();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [cascada, cancelar]);

  if (!cascada) return null;

  const accion =
    cascada.nuevoEstado === null
      ? `desmarcar ${cascada.nombre}`
      : `marcar ${cascada.nombre} como ${cascada.nuevoEstado}`;

  return (
    <div className="telon" onClick={cancelar}>
      <div
        className="dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cascada-titulo"
        tabIndex={-1}
        ref={dialogo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="cascada-titulo">Esto afecta a otras materias</h2>
        <p className="dialogo__intro">
          Al {accion},{" "}
          {cascada.revertidas.length === 1
            ? "esta materia deja"
            : "estas materias dejan"}{" "}
          de cumplir los requisitos:
        </p>

        <ul className="dialogo__lista">
          {cascada.revertidas.map((revertida) => (
            <li key={revertida.idMateria}>
              <div className="dialogo__materia">
                <strong>{revertida.nombre}</strong>
                <span className="dialogo__transicion">
                  {revertida.de} →{" "}
                  {revertida.a === "regular" ? COMO_QUEDA.regular : COMO_QUEDA.nada}
                </span>
              </div>
              <span className="dialogo__motivo">{revertida.motivo}</span>
            </li>
          ))}
        </ul>

        <div className="dialogo__acciones">
          <button type="button" className="boton" onClick={cancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            onClick={confirmar}
          >
            Aplicar de todos modos
          </button>
        </div>
      </div>
    </div>
  );
}
