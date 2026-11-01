/**
 * Cómo venís en cada año del plan.
 *
 * Una barra por año, partida en aprobadas, regulares, cursando y lo que
 * falta. Todas las barras miden lo mismo aunque los años tengan distinta
 * cantidad de materias: la pregunta es en qué año estás frenado, y eso se
 * lee comparando proporciones, no largos. La cantidad va aparte, como
 * "8/12", para que el tamaño del año no se pierda.
 *
 * Los colores son los de las tarjetas de la malla, los que el usuario haya
 * elegido incluidos.
 */

import { useMalla } from "../../store/useMalla";
import { type AnioDelPlan, progresoPorAnio } from "./porAnioDelPlan";

const PARTES = [
  { clave: "aprobadas", etiqueta: "Aprobadas", color: "var(--aprobada-borde)" },
  { clave: "regulares", etiqueta: "Regulares", color: "var(--regular-borde)" },
  { clave: "cursando", etiqueta: "Cursando", color: "var(--cursando-borde)" },
  { clave: "faltan", etiqueta: "Faltan", color: "var(--sin-estado-borde)" },
] as const;

export function ProgresoPorAnio() {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);

  if (!plan) return null;

  const anios = progresoPorAnio(plan, estados);
  if (anios.length === 0) {
    return <p className="barras__vacio">Este plan no tiene materias.</p>;
  }

  return (
    <div className="porAnio">
      <ul className="porAnio__lista">
        {anios.map((anio) => (
          <li key={anio.numero}>
            <div className="porAnio__fila">
              <span className="porAnio__anio">{anio.numero}º</span>
              <div
                className="porAnio__barra"
                role="img"
                aria-label={describir(anio)}
              >
                {PARTES.map((parte) => {
                  const valor = anio[parte.clave];
                  if (valor === 0) return null;
                  return (
                    <span
                      key={parte.clave}
                      style={{
                        width: `${(valor / anio.total) * 100}%`,
                        backgroundColor: parte.color,
                      }}
                      title={`${parte.etiqueta}: ${valor} de ${anio.total}`}
                    />
                  );
                })}
              </div>
              <span className="porAnio__cuenta">
                {anio.aprobadas}/{anio.total}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* La identidad nunca queda sólo en el color. */}
      <ul className="porAnio__leyenda">
        {PARTES.map((parte) => (
          <li key={parte.clave}>
            <span
              className="porAnio__muestra"
              style={{ backgroundColor: parte.color }}
            />
            {parte.etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El contenido de la barra en una frase, para quien no ve el dibujo. */
function describir(anio: AnioDelPlan): string {
  const partes = PARTES.map(
    (parte) => `${anio[parte.clave]} ${parte.etiqueta.toLowerCase()}`,
  );
  return `${anio.numero}º año, ${anio.total} materias: ${partes.join(", ")}.`;
}
