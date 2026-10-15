/**
 * Los gráficos puestos sobre el tablero.
 *
 * Están aparte de `useMalla` a propósito: no son progreso ni reglas, son
 * acomodo de pantalla. La carrera abierta se le avisa desde la malla, que es
 * la que sabe cuál es.
 */

import { create } from "zustand";

import {
  type Grafico,
  type TipoGrafico,
  guardarGraficos,
  leerGraficos,
} from "../storage/graficos";

export interface Posicion {
  x: number;
  y: number;
}

interface EstadoGraficos {
  /** Nombre de la carrera abierta, o null antes de abrir ninguna. */
  carrera: string | null;
  graficos: Grafico[];

  /** Cambia de carrera y trae sus gráficos. */
  abrir: (carrera: string) => void;
  agregar: (tipo: TipoGrafico, posicion: Posicion) => void;
  mover: (id: string, posicion: Posicion) => void;
  quitar: (id: string) => void;
}

/** Id único de cada gráfico puesto. `crypto.randomUUID` no está en todos lados. */
let siguiente = 0;
function nuevoId(): string {
  siguiente += 1;
  return `grafico-${Date.now().toString(36)}-${siguiente}`;
}

export const useGraficos = create<EstadoGraficos>((set, get) => {
  /** Guarda y deja el estado igual a lo guardado. */
  function asentar(graficos: Grafico[]) {
    const { carrera } = get();
    set({ graficos });
    if (carrera) guardarGraficos(carrera, graficos);
  }

  return {
    carrera: null,
    graficos: [],

    abrir: (carrera) => {
      if (get().carrera === carrera) return;
      set({ carrera, graficos: leerGraficos(carrera) });
    },

    agregar: (tipo, posicion) => {
      asentar([
        ...get().graficos,
        { id: nuevoId(), tipo, x: posicion.x, y: posicion.y },
      ]);
    },

    mover: (id, posicion) => {
      asentar(
        get().graficos.map((grafico) =>
          grafico.id === id
            ? { ...grafico, x: posicion.x, y: posicion.y }
            : grafico,
        ),
      );
    },

    quitar: (id) => {
      asentar(get().graficos.filter((grafico) => grafico.id !== id));
    },
  };
});
