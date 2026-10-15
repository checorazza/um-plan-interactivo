/**
 * La fecha de una materia recién marcada: hasta cuándo vale su regularidad,
 * o cuándo la aprobó.
 *
 * Es el mismo diálogo para las dos porque el trámite es el mismo; lo que
 * cambia es el texto y hacia qué lado del calendario mira. Una regularidad
 * vence en el futuro; una aprobación ya pasó.
 *
 * Se abre **después** de marcar, no antes: la materia ya quedó marcada y esto
 * sólo elige la fecha. Por eso el botón dice "Omitir" y no "Cancelar": no hay
 * nada que cancelar, la fecha es opcional. Al editar una que ya existe sí
 * aparece "Cancelar", porque ahí sí hay algo que dejar como estaba.
 */

import { useEffect, useRef, useState } from "react";

import { hoy, sanearFecha, sugerida } from "../../domain/fechas";
import { useMalla, type ClaseDeFecha } from "../../store/useMalla";
import "./DialogoFecha.css";

const TEXTOS: Record<
  ClaseDeFecha,
  { titulo: string; ayuda: string; etiqueta: string }
> = {
  regularidad: {
    titulo: "Regularidad de",
    ayuda:
      "¿Hasta cuándo te vale? Pasada esa fecha la vas a ver en rojo, como recordatorio de que hay que recursarla.",
    etiqueta: "Vence el",
  },
  aprobacion: {
    titulo: "Aprobaste",
    ayuda: "¿Cuándo la aprobaste?",
    etiqueta: "Aprobada el",
  },
};

export function DialogoFecha() {
  const pendiente = useMalla((s) => s.fecha);
  const fijar = useMalla((s) => s.fijarFecha);
  const cerrar = useMalla((s) => s.cerrarFecha);

  const campo = useRef<HTMLInputElement>(null);

  const idMateria = pendiente?.idMateria;
  const clase = pendiente?.clase ?? "regularidad";
  const actual = pendiente?.actual ?? null;
  // Una regularidad vence más adelante; una aprobación ya pasó, y lo más
  // probable es que haya sido hoy, que es cuando uno la marca.
  const porDefecto = clase === "regularidad" ? sugerida() : hoy();

  // Cada materia estrena el campo. Se hace durante el render y no en un
  // efecto, que es lo que React recomienda para reiniciar estado cuando
  // cambia de qué se está hablando.
  const [fecha, setFecha] = useState(() => actual ?? porDefecto);
  const [para, setPara] = useState(idMateria);
  if (idMateria !== para) {
    setPara(idMateria);
    setFecha(actual ?? porDefecto);
  }

  useEffect(() => {
    if (idMateria !== undefined) campo.current?.focus();
  }, [idMateria]);

  useEffect(() => {
    if (!pendiente) return;
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [pendiente, cerrar]);

  if (!pendiente) return null;

  const texto = TEXTOS[pendiente.clase];
  const valida = sanearFecha(fecha);
  const editando = pendiente.actual !== null;

  return (
    <div className="telon" onClick={cerrar}>
      <div
        className="dialogo dialogo--angosto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fecha-titulo"
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="fecha-titulo">
          {texto.titulo} {pendiente.nombre}
        </h2>
        <p className="dialogo__intro">{texto.ayuda}</p>

        <form
          className="fecha__campo"
          onSubmit={(evento) => {
            evento.preventDefault();
            fijar(valida);
          }}
        >
          <label htmlFor="fecha-valor">{texto.etiqueta}</label>
          <input
            id="fecha-valor"
            ref={campo}
            type="date"
            value={fecha}
            // Una regularidad no vence antes de hoy y una materia no se
            // aprobó mañana: cada una mira para su lado.
            min={pendiente.clase === "regularidad" ? hoy() : undefined}
            max={pendiente.clase === "aprobacion" ? hoy() : undefined}
            onChange={(evento) => setFecha(evento.target.value)}
          />
        </form>

        <div className="dialogo__acciones">
          {editando && (
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => fijar(null)}
            >
              Quitar la fecha
            </button>
          )}
          <button type="button" className="boton" onClick={cerrar}>
            {editando ? "Cancelar" : "Omitir"}
          </button>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => fijar(valida)}
            disabled={!valida}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
