/**
 * Cuánto falta para destrabar cada año.
 *
 * Una barra por año, pero no son cinco medidas distintas: el gate se compara
 * contra el **total** de créditos aprobados, así que es el mismo número tuyo
 * contra varios umbrales. Por eso el total va arriba una sola vez.
 *
 * Es la regla central de la app y hasta ahora sólo se veía materia por
 * materia, en el encabezado de cada año de la malla.
 */

import { useMalla } from "../../store/useMalla";
import { requisitosPorAnio } from "./requisitos";

export function RequisitosAnio() {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);

  if (!plan) return null;

  const { total, anios } = requisitosPorAnio(plan, estados);

  if (anios.length === 0) {
    return (
      <p className="barras__vacio">Este plan no pide créditos por año.</p>
    );
  }

  return (
    <div className="requisitos">
      <p className="requisitos__total">
        <strong>{total}</strong> <span>créditos aprobados</span>
      </p>

      <ul className="requisitos__lista">
        {anios.map((anio) => (
          <li key={anio.numero}>
            <div className="requisitos__fila">
              <span className="requisitos__anio">{anio.numero}º año</span>
              {/* Nunca sólo el color: el año cumplido lleva tilde y el que
                  falta, el número. */}
              <span
                className={
                  "requisitos__estado" +
                  (anio.cumplido ? " requisitos__estado--listo" : "")
                }
              >
                {anio.cumplido ? "✓ destrabado" : `faltan ${anio.faltan}`}
              </span>
            </div>
            <div
              className="requisitos__pista"
              title={`${anio.numero}º año pide ${anio.requeridos} créditos; tenés ${total}`}
            >
              <div
                className={
                  "requisitos__relleno" +
                  (anio.cumplido ? " requisitos__relleno--listo" : "")
                }
                style={{ width: `${(anio.cubiertos / anio.requeridos) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
