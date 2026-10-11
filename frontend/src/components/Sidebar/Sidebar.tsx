/** Panel lateral: carrera, progreso de créditos y acciones generales. */

import { creditosAprobados } from "../../domain/reglas";
import { useMalla } from "../../store/useMalla";
import { Sesion } from "../Sesion/Sesion";
import "./Sidebar.css";

export function Sidebar() {
  const carreras = useMalla((s) => s.carreras);
  const idCarrera = useMalla((s) => s.idCarrera);
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);
  const seleccionarCarrera = useMalla((s) => s.seleccionarCarrera);
  const reiniciar = useMalla((s) => s.reiniciar);
  const sinPersistencia = useMalla((s) => s.sinPersistencia);

  const materias = plan ? [...plan.materias.values()] : [];
  const aprobadas = materias.filter((m) => estados[m.id_materia] === "aprobada");
  const regulares = materias.filter((m) => estados[m.id_materia] === "regular");

  const creditos = plan ? creditosAprobados(plan, estados) : 0;
  const creditosTotales = materias.reduce((suma, m) => suma + m.creditos, 0);
  const porcentaje =
    creditosTotales > 0 ? Math.round((creditos / creditosTotales) * 100) : 0;

  return (
    <aside className="sidebar">
      <header className="sidebar__marca">
        <h1>Plan Interactivo</h1>
        <p>Marcá y seguí tu carrera.</p>
      </header>

      {carreras.length > 1 && (
        <label className="sidebar__campo">
          <span>Carrera</span>
          <select
            value={idCarrera ?? ""}
            onChange={(evento) => {
              void seleccionarCarrera(Number(evento.target.value));
            }}
          >
            {carreras.map((carrera) => (
              <option key={carrera.id_carrera} value={carrera.id_carrera}>
                {carrera.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {plan && (
        <>
          <section className="sidebar__progreso">
            <div className="sidebar__creditos">
              <strong>{creditos}</strong>
              <span>de {creditosTotales} créditos</span>
            </div>
            <div
              className="barra"
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Créditos aprobados"
            >
              <div className="barra__relleno" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="sidebar__resumen">
              {aprobadas.length} aprobadas · {regulares.length} regulares ·{" "}
              {materias.length} materias
            </p>
          </section>

          <section className="sidebar__leyenda">
            <h2>Referencias</h2>
            <ul>
              <li>
                <span className="muestra muestra--aprobada" /> Aprobada
              </li>
              <li>
                <span className="muestra muestra--regular" /> Regular
              </li>
              <li>
                <span className="muestra muestra--sin-estado" /> Disponible
              </li>
              <li>
                <span className="muestra muestra--correlativa" /> Falta la
                correlativa (se puede regularizar)
              </li>
              <li>
                <span className="muestra muestra--creditos" /> Sin los créditos
                del año
              </li>
            </ul>
          </section>
        </>
      )}

      <Sesion />

      <footer className="sidebar__pie">
        <button
          type="button"
          className="boton boton--peligro"
          onClick={reiniciar}
          disabled={aprobadas.length + regulares.length === 0}
        >
          Reiniciar progreso
        </button>
        <p className="sidebar__nota">
          {sinPersistencia
            ? "Este navegador no deja guardar datos, así que el progreso se pierde al cerrar la pestaña."
            : "Tu progreso se guarda en este dispositivo. No hace falta iniciar sesión."}
        </p>
      </footer>
    </aside>
  );
}
