/**
 * Cuántas materias aprobaste en cada año calendario.
 *
 * Una barra por año, con el año más productivo destacado y el resto
 * apagado: la pregunta que contesta es "cuál fue mi mejor año", así que el
 * gráfico la responde solo, sin hacer comparar alturas parecidas.
 *
 * No lleva eje ni grilla. Con pocas barras, el número arriba de cada una
 * dice más y ocupa menos que una escala al costado.
 *
 * Sale de las fechas de aprobación, que son opcionales: una materia aprobada
 * sin fecha no se puede ubicar en ningún año y se cuenta aparte, abajo.
 */

import { useMalla } from "../../store/useMalla";
import { aprobadasPorAnio } from "./porAnio";

/** Alto del área de barras, en píxeles. */
const ALTO = 108;
/** Lo mínimo que mide una barra con valor, para que se vea que está. */
const MINIMO = 4;

export function BarrasPorAnio() {
  const estados = useMalla((s) => s.estados);
  const aprobaciones = useMalla((s) => s.aprobaciones);

  const { anios, sinFecha, mejor } = aprobadasPorAnio(estados, aprobaciones);

  if (anios.length === 0) {
    return (
      <p className="barras__vacio">
        {sinFecha > 0
          ? "Ninguna de tus materias aprobadas tiene fecha. Poné una con el click derecho sobre la materia."
          : "Todavía no aprobaste ninguna materia."}
      </p>
    );
  }

  const tope = Math.max(...anios.map((anio) => anio.cantidad));

  return (
    <div className="barras">
      <ul className="barras__grafico" style={{ height: ALTO }}>
        {anios.map(({ anio, cantidad }) => {
          const alto = cantidad === 0 ? 0 : Math.max(MINIMO, (cantidad / tope) * ALTO);
          const destacada = anio === mejor && cantidad > 0;

          return (
            <li key={anio} className="barras__columna">
              <span className="barras__valor">{cantidad}</span>
              <span
                className={
                  "barras__barra" + (destacada ? " barras__barra--mejor" : "")
                }
                style={{ height: alto }}
                title={`${anio}: ${cantidad} ${cantidad === 1 ? "materia" : "materias"}`}
              />
              <span className="barras__anio">{anio}</span>
            </li>
          );
        })}
      </ul>

      {sinFecha > 0 && (
        <p className="barras__nota">
          {sinFecha} sin fecha, {sinFecha === 1 ? "no entra" : "no entran"} en
          ningún año
        </p>
      )}
    </div>
  );
}
