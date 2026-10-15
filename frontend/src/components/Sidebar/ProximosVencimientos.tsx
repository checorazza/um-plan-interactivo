/**
 * Las regularidades con fecha, de la que vence antes a la que vence después.
 *
 * Aparece sólo cuando hay alguna: una sección vacía en un panel angosto es
 * lugar ocupado sin decir nada. Las vencidas quedan arriba, en rojo, igual
 * que en la tarjeta de la materia.
 */

import { mostrarFecha, proximosVencimientos } from "../../domain/fechas";
import { useMalla } from "../../store/useMalla";

export function ProximosVencimientos() {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);
  const vencimientos = useMalla((s) => s.vencimientos);

  if (!plan) return null;

  const lista = proximosVencimientos(plan, estados, vencimientos);
  if (lista.length === 0) return null;

  return (
    <section className="sidebar__vencimientos">
      <h2>Próximos vencimientos</h2>
      <ul>
        {lista.map((vencimiento) => (
          <li key={vencimiento.idMateria}>
            <span className="sidebar__materia">{vencimiento.nombre}</span>
            <span
              className={
                "sidebar__fecha" +
                (vencimiento.vencida ? " sidebar__fecha--vencida" : "")
              }
              title={
                vencimiento.vencida
                  ? "La regularidad venció"
                  : "Regular hasta esa fecha"
              }
            >
              {mostrarFecha(vencimiento.fecha)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
