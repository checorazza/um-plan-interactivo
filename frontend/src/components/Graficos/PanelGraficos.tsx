/**
 * El panel de gráficos: de acá se arrastran al tablero.
 *
 * Arrastrar es el gesto principal, pero no el único: en un teléfono el
 * arrastre nativo del navegador no existe, así que tocar la tarjeta también
 * la pone, en el centro de lo que se esté viendo.
 */

import type { TipoGrafico } from "../../storage/graficos";
import { IconoVolver } from "../Sidebar/iconos";
import { IconoBarras, IconoMedidor, IconoTorta } from "./iconos";
import { TIPO_ARRASTRE } from "./nodo";
import "./Graficos.css";

const ICONOS: Record<TipoGrafico, typeof IconoTorta> = {
  "torta-progreso": IconoTorta,
  "aprobadas-por-anio": IconoBarras,
  "requisitos-anio": IconoMedidor,
};

const DISPONIBLES: {
  tipo: TipoGrafico;
  titulo: string;
  descripcion: string;
}[] = [
  {
    tipo: "torta-progreso",
    titulo: "Progreso",
    descripcion: "Aprobadas, regulares y lo que falta, sobre el total.",
  },
  {
    tipo: "aprobadas-por-anio",
    titulo: "Aprobadas por año",
    descripcion: "Cuántas aprobaste cada año, según las fechas que cargues.",
  },
  {
    tipo: "requisitos-anio",
    titulo: "Requisitos por año",
    descripcion: "Cuántos créditos te faltan para destrabar cada año.",
  },
];

interface Props {
  alVolver: () => void;
  /** Pone el gráfico en el centro de la vista. Es el camino sin arrastre. */
  alElegir: (tipo: TipoGrafico) => void;
}

export function PanelGraficos({ alVolver, alElegir }: Props) {
  return (
    <div className="personalizar">
      <header className="personalizar__cabecera">
        <button
          type="button"
          className="personalizar__volver"
          onClick={alVolver}
          aria-label="Volver al panel"
        >
          <IconoVolver />
        </button>
        <h2>Gráficos</h2>
      </header>

      <p className="graficos__ayuda">
        Arrastralos a la malla, o tocalos para ponerlos. Después se mueven
        desde cualquier parte del gráfico.
      </p>

      <ul className="graficos__lista">
        {DISPONIBLES.map((grafico) => {
          const Icono = ICONOS[grafico.tipo];
          return (
          <li key={grafico.tipo}>
            <button
              type="button"
              className="graficos__ficha"
              draggable
              onDragStart={(evento) => {
                evento.dataTransfer.setData(TIPO_ARRASTRE, grafico.tipo);
                evento.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => alElegir(grafico.tipo)}
            >
              <Icono className="graficos__icono" />
              <span className="graficos__texto">
                <strong>{grafico.titulo}</strong>
                <span>{grafico.descripcion}</span>
              </span>
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
