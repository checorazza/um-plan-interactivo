/**
 * Un gráfico puesto sobre el tablero.
 *
 * Es un nodo de React Flow como las materias, así que vive en coordenadas
 * del tablero: se mueve, hace zoom y se desplaza junto con la malla, en vez
 * de quedar flotando encima en coordenadas de pantalla. A diferencia de las
 * materias, éste sí se arrastra.
 */

import type { Node, NodeProps } from "@xyflow/react";

import { useGraficos } from "../../store/useGraficos";
import type { TipoGrafico } from "../../storage/graficos";
import { TITULOS } from "./nodo";
import { TortaProgreso } from "./TortaProgreso";
import "./Graficos.css";

export type DatosGrafico = {
  idGrafico: string;
  tipo: TipoGrafico;
};

export type NodoGrafico = Node<DatosGrafico, "grafico">;

export function GraficoNode({ data }: NodeProps<NodoGrafico>) {
  const quitar = useGraficos((s) => s.quitar);

  return (
    <div className="grafico">
      {/* Se arrastra desde cualquier parte menos el botón de cerrar, que
          lleva `nodrag`. Pedir un agarre chico es pedirle puntería al
          usuario para algo que no la necesita. */}
      <header className="grafico__barra">
        <span className="grafico__titulo">{TITULOS[data.tipo]}</span>
        <button
          type="button"
          className="grafico__cerrar nodrag"
          onClick={() => quitar(data.idGrafico)}
          aria-label={`Quitar el gráfico de ${TITULOS[data.tipo].toLowerCase()}`}
          title="Quitar"
        >
          ×
        </button>
      </header>

      <div className="grafico__cuerpo">
        {data.tipo === "torta-progreso" && <TortaProgreso />}
      </div>
    </div>
  );
}
