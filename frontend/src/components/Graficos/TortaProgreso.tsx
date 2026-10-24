/**
 * Cuánto de la carrera llevás, como anillo.
 *
 * Las tres porciones suman el total de materias: aprobadas, regulares y las
 * que faltan. "Total" no es una porción más: sería contar dos veces lo que ya
 * está en las otras.
 *
 * En el centro va el porcentaje aprobado: es la única cifra que resume la
 * carrera entera en un número, y el anillo que la rodea ya muestra de dónde
 * sale.
 *
 * Los colores son los mismos que los de las tarjetas de la malla, incluidos
 * los que el usuario haya cambiado en Personalizar: el verde de acá es el
 * verde de allá, y eso es lo que hace que no haga falta pensar la leyenda.
 */

import { useMalla } from "../../store/useMalla";
import { arcos, porcentaje, type Porcion } from "./torta";

/** Radio y grosor del anillo, en unidades del `viewBox`. */
const RADIO = 46;
const GROSOR = 13;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
/** El hueco entre porciones: deja ver el fondo, no es un borde pintado. */
const HUECO = 2.5;

export function TortaProgreso() {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);

  const materias = plan ? [...plan.materias.values()] : [];
  const aprobadas = materias.filter(
    (materia) => estados[materia.id_materia] === "aprobada",
  ).length;
  const regulares = materias.filter(
    (materia) => estados[materia.id_materia] === "regular",
  ).length;
  const total = materias.length;

  const porciones: Porcion[] = [
    {
      clave: "aprobadas",
      etiqueta: "Aprobadas",
      valor: aprobadas,
      color: "var(--aprobada-borde)",
    },
    {
      clave: "regulares",
      etiqueta: "Regulares",
      valor: regulares,
      color: "var(--regular-borde)",
    },
    {
      clave: "faltan",
      etiqueta: "Sin cursar",
      valor: Math.max(0, total - aprobadas - regulares),
      color: "var(--sin-estado-borde)",
    },
  ];

  const dibujados = arcos(porciones, CIRCUNFERENCIA, HUECO);
  const porClave = new Map(porciones.map((porcion) => [porcion.clave, porcion]));

  return (
    <div className="torta">
      <div className="torta__anillo">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={resumen(porciones, total, aprobadas)}
        >
          {/* La pista de atrás: con pocas materias marcadas, deja ver que el
              anillo está entero y no a medio dibujar. */}
          <circle
            className="torta__pista"
            cx="60"
            cy="60"
            r={RADIO}
            fill="none"
            strokeWidth={GROSOR}
          />
          {/* Arranca arriba y gira como el reloj. */}
          <g transform="rotate(-90 60 60)">
            {dibujados.map((arco) => {
              const porcion = porClave.get(arco.clave);
              if (!porcion) return null;
              return (
                <circle
                  key={arco.clave}
                  cx="60"
                  cy="60"
                  r={RADIO}
                  fill="none"
                  stroke={porcion.color}
                  strokeWidth={GROSOR}
                  strokeDasharray={`${arco.largo} ${CIRCUNFERENCIA - arco.largo}`}
                  strokeDashoffset={arco.desfase}
                >
                  <title>
                    {porcion.etiqueta}: {porcion.valor} de {total} (
                    {porcentaje(porcion.valor, total)}%)
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>

        <div className="torta__centro">
          <strong>{porcentaje(aprobadas, total)}%</strong>
          <span>aprobado</span>
        </div>
      </div>

      {/* La leyenda lleva los valores: con tres porciones chicas, un número
          sobre cada una se pisaría con el anillo. */}
      <ul className="torta__leyenda">
        {porciones.map((porcion) => (
          <li key={porcion.clave}>
            <span
              className="torta__muestra"
              style={{ backgroundColor: porcion.color }}
            />
            <span className="torta__etiqueta">{porcion.etiqueta}</span>
            <span className="torta__valor">{porcion.valor}</span>
            <span className="torta__porcentaje">
              {porcentaje(porcion.valor, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El mismo contenido en una frase, para quien no ve el dibujo. */
function resumen(porciones: Porcion[], total: number, aprobadas: number): string {
  const partes = porciones.map(
    (porcion) => `${porcion.valor} ${porcion.etiqueta.toLowerCase()}`,
  );
  return `${porcentaje(aprobadas, total)}% aprobado. De ${total} materias: ${partes.join(", ")}.`;
}
