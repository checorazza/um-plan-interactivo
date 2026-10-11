/**
 * La advertencia antes de desbloquear una materia.
 *
 * Desbloquear es una excepción a las reglas del plan, no un cambio de plan:
 * vale para la marca que se elige acá y se pierde al desmarcarla. El diálogo
 * lo dice antes, porque después no hay nada que lo recuerde.
 */

import { useEffect, useRef } from "react";

import type { Bloqueo } from "../../domain/reglas";
import type { Estado } from "../../types/estado";
import { IconoAprobada, IconoRegular } from "./iconos";

export interface Desbloqueo {
  idMateria: number;
  nombre: string;
  bloqueo: Bloqueo;
  motivo: string;
}

interface Props {
  desbloqueo: Desbloqueo;
  onElegir: (estado: Estado) => void;
  onCancelar: () => void;
}

export function ConfirmacionDesbloqueo({
  desbloqueo,
  onElegir,
  onCancelar,
}: Props) {
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogo.current?.focus();
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [onCancelar]);

  return (
    <div className="telon" onClick={onCancelar}>
      <div
        className="dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="desbloqueo-titulo"
        tabIndex={-1}
        ref={dialogo}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="desbloqueo-titulo">Desbloquear {desbloqueo.nombre}</h2>
        <p className="dialogo__intro">
          Hoy no se puede marcar: {desbloqueo.motivo.toLowerCase()}.
        </p>

        <p className="dialogo__aviso">
          Si la desbloqueás vas a poder marcarla igual, pero la excepción dura
          lo que dure la marca: <strong>si después la desmarcás, vas a tener
          que desbloquearla de nuevo</strong>.
        </p>

        <div className="dialogo__acciones">
          <button type="button" className="boton" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton accion--regular"
            onClick={() => onElegir("regular")}
          >
            <IconoRegular />
            <span>Regular</span>
          </button>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => onElegir("aprobada")}
          >
            <IconoAprobada />
            <span>Aprobada</span>
          </button>
        </div>
      </div>
    </div>
  );
}
