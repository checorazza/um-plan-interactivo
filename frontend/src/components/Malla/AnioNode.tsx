/**
 * Encabezado de un año en la malla: su número, los créditos que exige y los
 * que el usuario tiene. Si el año está cerrado, muestra un candado.
 */

import type { Node, NodeProps } from "@xyflow/react";

import { creditosAprobados } from "../../domain/reglas";
import { useMalla } from "../../store/useMalla";
import { IconoCandado } from "./iconos";

export type DatosAnio = {
  numero: number;
  creditosRequeridos: number;
};

export type NodoAnio = Node<DatosAnio, "anio">;

export function AnioNode({ data }: NodeProps<NodoAnio>) {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);

  if (!plan) return null;

  const tiene = creditosAprobados(plan, estados);
  const abierto = tiene >= data.creditosRequeridos;
  const faltan = data.creditosRequeridos - tiene;

  return (
    <div className={`anio ${abierto ? "anio--abierto" : "anio--cerrado"}`}>
      <div className="anio__titulo">
        {!abierto && <IconoCandado className="anio__candado" />}
        <span>{data.numero}º año</span>
      </div>
      {data.creditosRequeridos > 0 ? (
        <span className="anio__creditos">
          {abierto
            ? `${data.creditosRequeridos} créditos ✓`
            : `faltan ${faltan} de ${data.creditosRequeridos} créditos`}
        </span>
      ) : (
        <span className="anio__creditos">sin requisitos</span>
      )}
    </div>
  );
}
