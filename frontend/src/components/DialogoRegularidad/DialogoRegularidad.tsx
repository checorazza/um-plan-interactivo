/**
 * Hasta cuándo vale una regularidad.
 *
 * Se abre después de regularizar, no antes: la materia ya quedó regular y
 * esto sólo elige la fecha. Si se cierra sin elegir, la materia sigue
 * regular y sin vencimiento; se le puede poner uno después con el click
 * derecho.
 *
 * La fecha no cambia ninguna regla. Pasada, la materia se muestra en rojo y
 * nada más: lo que hay que hacer con una regularidad vencida lo decide la
 * facultad, no la app.
 */

import { useEffect, useRef, useState } from "react";

import { hoy, sanearFecha, sugerida } from "../../domain/fechas";
import { useMalla } from "../../store/useMalla";
import "./DialogoRegularidad.css";

export function DialogoRegularidad() {
  const regularidad = useMalla((s) => s.regularidad);
  const fijar = useMalla((s) => s.fijarRegularidad);
  const cerrar = useMalla((s) => s.cerrarRegularidad);

  const dialogo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idMateria = regularidad?.idMateria;
  const actual = regularidad?.actual ?? null;

  // Cada materia estrena el campo: con su fecha si ya tenía, y si no con una
  // sugerencia, para no abrir el calendario en el mes equivocado. Se hace
  // durante el render y no en un efecto, que es lo que React recomienda para
  // reiniciar estado cuando cambia de qué se está hablando.
  const [fecha, setFecha] = useState(() => actual ?? sugerida());
  const [para, setPara] = useState(idMateria);
  if (idMateria !== para) {
    setPara(idMateria);
    setFecha(actual ?? sugerida());
  }

  useEffect(() => {
    if (idMateria !== undefined) campo.current?.focus();
  }, [idMateria]);

  useEffect(() => {
    if (!regularidad) return;
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [regularidad, cerrar]);

  if (!regularidad) return null;

  const valida = sanearFecha(fecha);

  return (
    <div className="telon" onClick={cerrar}>
      <div
        className="dialogo dialogo--angosto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regularidad-titulo"
        tabIndex={-1}
        ref={dialogo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="regularidad-titulo">Regularidad de {regularidad.nombre}</h2>
        <p className="dialogo__intro">
          ¿Hasta cuándo te vale? Pasada esa fecha la vas a ver en rojo, como
          recordatorio de que hay que recursarla.
        </p>

        <form
          className="regularidad__campo"
          onSubmit={(evento) => {
            evento.preventDefault();
            fijar(valida);
          }}
        >
          <label htmlFor="regularidad-fecha">Vence el</label>
          <input
            id="regularidad-fecha"
            ref={campo}
            type="date"
            value={fecha}
            min={hoy()}
            onChange={(evento) => setFecha(evento.target.value)}
          />
        </form>

        <div className="dialogo__acciones">
          {actual !== null && (
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => fijar(null)}
            >
              Quitar la fecha
            </button>
          )}
          <button type="button" className="boton" onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => fijar(valida)}
          >
            {valida ? "Guardar" : "Seguir sin fecha"}
          </button>
        </div>
      </div>
    </div>
  );
}
