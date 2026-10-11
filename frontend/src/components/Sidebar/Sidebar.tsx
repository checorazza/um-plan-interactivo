/**
 * Panel lateral: carrera, progreso de créditos y acciones generales.
 *
 * Tiene dos vistas y muestra una o la otra, no las dos: el panel es angosto y
 * en el teléfono es una barra, así que la personalización ocupa su lugar en
 * vez de agregarse abajo.
 */

import { useState } from "react";

import { creditosAprobados } from "../../domain/reglas";
import { useMalla } from "../../store/useMalla";
import { Personalizar } from "../Personalizar/Personalizar";
import { Sesion } from "../Sesion/Sesion";
import { IconoPaleta } from "./iconos";
import "./Sidebar.css";

export function Sidebar() {
  const [personalizando, setPersonalizando] = useState(false);
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
  // El avance se mide en materias, que es lo que el número grande muestra.
  // Por créditos daría otro porcentaje, y dos números distintos para lo
  // mismo en el mismo panel confunden más de lo que informan.
  const porcentaje =
    materias.length > 0
      ? Math.round((aprobadas.length / materias.length) * 100)
      : 0;

  if (personalizando) {
    return (
      <aside className="sidebar sidebar--personalizando">
        <Personalizar alVolver={() => setPersonalizando(false)} />
      </aside>
    );
  }

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
            <div className="sidebar__avance">
              <strong>{aprobadas.length}</strong>
              <span>de {materias.length} materias</span>
              <span className="sidebar__porcentaje">{porcentaje}%</span>
            </div>
            <div
              className="barra"
              role="progressbar"
              aria-valuenow={porcentaje}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Materias aprobadas"
            >
              <div className="barra__relleno" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="sidebar__resumen">
              {creditos} de {creditosTotales} créditos
              {regulares.length > 0 && ` · ${regulares.length} regulares`}
            </p>
          </section>

          <button
            type="button"
            className="boton sidebar__personalizar"
            onClick={() => setPersonalizando(true)}
          >
            <IconoPaleta />
            Personalizar
          </button>
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
