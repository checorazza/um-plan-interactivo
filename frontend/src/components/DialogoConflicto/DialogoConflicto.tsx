/**
 * Qué hacer cuando el progreso de este dispositivo y el de la nube difieren.
 *
 * Se pregunta en vez de decidir solo: cualquier criterio automático puede
 * borrar meses de progreso sin que el usuario se entere. Sólo aparece cuando
 * los dos lados tienen algo; si uno está vacío, no hay nada que perder y se
 * resuelve sin molestar.
 */

import { useEffect, useRef } from "react";

import { combinarEstados } from "../../domain/reglas";
import { useMalla, type OpcionConflicto } from "../../store/useMalla";
import type { Estados } from "../../types/estado";
import "../ConfirmacionCascada/ConfirmacionCascada.css";
import "./DialogoConflicto.css";

function resumir(estados: Estados) {
  const valores = Object.values(estados);
  return {
    aprobadas: valores.filter((e) => e === "aprobada").length,
    regulares: valores.filter((e) => e === "regular").length,
  };
}

interface PropsOpcion {
  titulo: string;
  detalle: string;
  estados: Estados;
  destacada?: boolean;
  onElegir: () => void;
}

function Opcion({ titulo, detalle, estados, destacada, onElegir }: PropsOpcion) {
  const { aprobadas, regulares } = resumir(estados);
  return (
    <button
      type="button"
      className={`opcion ${destacada ? "opcion--destacada" : ""}`}
      onClick={onElegir}
    >
      <strong>{titulo}</strong>
      <span className="opcion__cuenta">
        {aprobadas} aprobadas · {regulares} regulares
      </span>
      <span className="opcion__detalle">{detalle}</span>
    </button>
  );
}

export function DialogoConflicto() {
  const conflicto = useMalla((s) => s.conflicto);
  const resolver = useMalla((s) => s.resolverConflicto);
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conflicto) dialogo.current?.focus();
  }, [conflicto]);

  if (!conflicto) return null;

  const elegir = (opcion: OpcionConflicto) => {
    void resolver(opcion);
  };

  return (
    // Sin cierre al hacer click afuera ni con Escape: hay que elegir algo.
    // Quedarse a medias dejaría la app mostrando una cosa y la cuenta otra.
    <div className="telon">
      <div
        className="dialogo dialogo--conflicto"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflicto-titulo"
        tabIndex={-1}
        ref={dialogo}
      >
        <h2 id="conflicto-titulo">Tenés progreso en los dos lados</h2>
        <p className="dialogo__intro">
          Lo guardado en este dispositivo no coincide con lo de tu cuenta.
          Elegí con cuál seguir: lo que no elijas se reemplaza.
        </p>

        <div className="opciones">
          <Opcion
            titulo="Combinar los dos"
            detalle="Se queda con el estado más avanzado de cada materia. No se pierde nada."
            estados={combinarEstados(conflicto.local, conflicto.nube)}
            destacada
            onElegir={() => elegir("combinar")}
          />
          <Opcion
            titulo="Este dispositivo"
            detalle="Reemplaza lo que hay en tu cuenta."
            estados={conflicto.local}
            onElegir={() => elegir("dispositivo")}
          />
          <Opcion
            titulo="Tu cuenta"
            detalle="Reemplaza lo de este dispositivo."
            estados={conflicto.nube}
            onElegir={() => elegir("nube")}
          />
        </div>
      </div>
    </div>
  );
}
