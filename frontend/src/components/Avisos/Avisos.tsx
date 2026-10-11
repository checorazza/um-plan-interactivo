/**
 * Avisos flotantes sobre la malla.
 *
 * Hoy sólo uno: cuando el progreso guardado traía materias que el plan actual
 * ya no admite. Pasa si el plan cambió desde la última visita, y es importante
 * decirlo —si no, el usuario ve menos materias marcadas de las que dejó y
 * parece que la app perdió datos.
 */

import { useMalla } from "../../store/useMalla";
import "./Avisos.css";

export function Avisos() {
  const plan = useMalla((s) => s.plan);
  const descartadas = useMalla((s) => s.descartadas);
  const descartarAviso = useMalla((s) => s.descartarAviso);

  if (!plan || descartadas.length === 0) return null;

  const nombres = descartadas.map(
    (c) => plan.materias.get(c.idMateria)?.nombre ?? `#${c.idMateria}`,
  );

  return (
    <div className="aviso" role="status">
      <div className="aviso__texto">
        <strong>
          {descartadas.length === 1
            ? "Se desmarcó una materia"
            : `Se desmarcaron ${descartadas.length} materias`}
        </strong>
        <p>
          El plan cambió desde la última vez y{" "}
          {descartadas.length === 1 ? "ya no cumplía" : "ya no cumplían"} los
          requisitos: {nombres.join(", ")}.
        </p>
      </div>
      <button
        type="button"
        className="aviso__cerrar"
        onClick={descartarAviso}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
