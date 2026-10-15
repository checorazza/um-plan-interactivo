import { useEffect } from "react";

import { Avisos } from "./components/Avisos/Avisos";
import { ConfirmacionCascada } from "./components/ConfirmacionCascada/ConfirmacionCascada";
import { DialogoConflicto } from "./components/DialogoConflicto/DialogoConflicto";
import { DialogoFecha } from "./components/DialogoFecha/DialogoFecha";
import { Malla } from "./components/Malla/Malla";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useMalla } from "./store/useMalla";
import { useSesion } from "./store/useSesion";
import "./App.css";

function App() {
  const cargando = useMalla((s) => s.cargando);
  const error = useMalla((s) => s.error);
  const plan = useMalla((s) => s.plan);
  const cargarCarreras = useMalla((s) => s.cargarCarreras);
  const sincronizar = useMalla((s) => s.sincronizar);
  const restaurar = useSesion((s) => s.restaurar);

  useEffect(() => {
    void cargarCarreras();
  }, [cargarCarreras]);

  // Si había una sesión guardada, se retoma y se sincroniza.
  useEffect(() => {
    void restaurar().then(() => sincronizar());
  }, [restaurar, sincronizar]);

  return (
    <div className="app">
      <Sidebar />

      <main className="app__contenido">
        {plan && <Malla />}
        {plan && <Avisos />}

        {!plan && cargando && <p className="app__aviso">Cargando el plan…</p>}

        {!plan && !cargando && error && (
          <div className="app__aviso app__aviso--error">
            <p>No se pudo cargar el plan: {error}</p>
            <button
              type="button"
              className="boton"
              onClick={() => void cargarCarreras()}
            >
              Reintentar
            </button>
          </div>
        )}

        {!plan && !cargando && !error && (
          <p className="app__aviso">
            Todavía no hay carreras cargadas en la base.
          </p>
        )}
      </main>

      <ConfirmacionCascada />
      <DialogoFecha />
      <DialogoConflicto />
    </div>
  );
}

export default App;
