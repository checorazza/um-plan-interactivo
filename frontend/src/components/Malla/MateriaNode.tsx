/**
 * Un nodo de la malla: una materia.
 *
 * Al hacer click aparecen las dos acciones —regularizar y aprobada—, cada una
 * deshabilitada con el motivo cuando la regla no se cumple. Las acciones son
 * interruptores: tocar la que ya está puesta le quita el estado a la materia,
 * que es la única forma de deshacer.
 */

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import { estadoDeBloqueo, puedeAprobar, puedeRegularizar } from "../../domain/reglas";
import { useMalla } from "../../store/useMalla";
import type { Estado } from "../../types/estado";
import {
  IconoAprobada,
  IconoCandado,
  IconoCandadoAbierto,
  IconoRegular,
} from "./iconos";

export type DatosMateria = {
  idMateria: number;
  /** No se muestra; sirve para el orden y para referirse a la materia. */
  codigo: string;
  nombre: string;
  creditos: number;
  /** Copia del estado, para que el minimapa pueda colorear sin leer el store. */
  estado: Estado | undefined;
  /** Exenta de las reglas porque el usuario la desbloqueó a mano. */
  desbloqueada: boolean;
};

export type NodoMateria = Node<DatosMateria, "materia">;

export function MateriaNode({ data, selected }: NodeProps<NodoMateria>) {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);
  const desbloqueadas = useMalla((s) => s.desbloqueadas);
  const marcar = useMalla((s) => s.marcar);

  if (!plan) return null;

  const estado: Estado | undefined = estados[data.idMateria];
  const bloqueo = estadoDeBloqueo(plan, estados, data.idMateria, desbloqueadas);
  const regular = puedeRegularizar(plan, estados, data.idMateria, desbloqueadas);
  const aprobada = puedeAprobar(plan, estados, data.idMateria, desbloqueadas);

  // Una materia ya marcada siempre se puede desmarcar, aunque hoy no cumpla
  // las reglas para volver a marcarse.
  const habilitarRegular = regular.ok || estado === "regular";
  const habilitarAprobada = aprobada.ok || estado === "aprobada";

  const alternar = (destino: Estado) => {
    marcar(data.idMateria, estado === destino ? null : destino);
  };

  const clases = [
    "materia",
    estado ? `materia--${estado}` : "materia--sin-estado",
    !estado && bloqueo !== "disponible" ? `materia--${bloqueo}` : "",
    selected ? "materia--seleccionada" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const etiquetaEstado = data.desbloqueada
    ? `${estado ?? "sin cursar"}, desbloqueada a mano`
    : estado === "aprobada"
      ? "aprobada"
      : estado === "regular"
        ? "regular"
        : bloqueo === "bloqueada_por_creditos"
          ? "bloqueada"
          : "sin cursar";

  return (
    <div className={clases}>
      <Handle type="target" position={Position.Left} className="materia__handle" />

      <div className="materia__cuerpo">
        {/* El nombre entero, sin recortar: la tarjeta crece lo que haga
            falta (ver `altoDeMateria` en layout.ts). */}
        <span className="materia__nombre">{data.nombre}</span>
        <span className="materia__creditos">
          <span>
            {data.creditos} {data.creditos === 1 ? "crédito" : "créditos"}
            <span className="visualmente-oculto"> — {etiquetaEstado}</span>
          </span>
          {data.desbloqueada ? (
            <IconoCandadoAbierto
              className="materia__candado materia__candado--abierto"
            />
          ) : (
            !estado &&
            bloqueo === "bloqueada_por_creditos" && (
              <IconoCandado className="materia__candado" />
            )
          )}
        </span>
      </div>

      {selected && (
        <div className="materia__acciones" role="group" aria-label={`Acciones de ${data.nombre}`}>
          <button
            type="button"
            className="accion accion--regular"
            aria-pressed={estado === "regular"}
            disabled={!habilitarRegular}
            title={habilitarRegular ? "Regularizar" : regular.motivo}
            onClick={() => alternar("regular")}
          >
            <IconoRegular />
            <span>Regular</span>
          </button>
          <button
            type="button"
            className="accion accion--aprobada"
            aria-pressed={estado === "aprobada"}
            disabled={!habilitarAprobada}
            title={habilitarAprobada ? "Marcar como aprobada" : aprobada.motivo}
            onClick={() => alternar("aprobada")}
          >
            <IconoAprobada />
            <span>Aprobada</span>
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="materia__handle" />
    </div>
  );
}
