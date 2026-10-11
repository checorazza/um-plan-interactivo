import { useEffect } from "react";

import { Avisos } from "./components/Avisos/Avisos";
import { ConfirmacionCascada } from "./components/ConfirmacionCascada/ConfirmacionCascada";
import { Malla } from "./components/Malla/Malla";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useMalla } from "./store/useMalla";
import "./App.css";

function App() {
  const cargando = useMalla((s) => s.cargando);
  const error = useMalla((s) => s.error);
  const plan = useMalla((s) => s.plan);
  const cargarCarreras = useMalla((s) => s.cargarCarreras);

  useEffect(() => {
    void cargarCarreras();
  }, [cargarCarreras]);

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
    </div>
  );
}

export default App;
