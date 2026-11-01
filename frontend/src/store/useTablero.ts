/**
 * Cómo está acomodado el tablero: los gráficos puestos y dónde quedó el plan.
 *
 * Está aparte de `useMalla` a propósito: no es progreso ni reglas, es
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
import {
  type Desplazamiento,
  SIN_MOVER,
  guardarDesplazamiento,
  leerDesplazamiento,
} from "../storage/tablero";

export interface Posicion {
  x: number;
  y: number;
}

interface EstadoTablero {
  /** Nombre de la carrera abierta, o null antes de abrir ninguna. */
  carrera: string | null;
  graficos: Grafico[];
  /**
   * Cuánto se corrió el plan de estudios respecto de donde lo pone el
   * acomodo automático. Los gráficos no se mueven con él: cada uno tiene su
   * posición propia.
   */
  desplazamiento: Desplazamiento;

  /** Cambia de carrera y trae sus gráficos. */
  abrir: (carrera: string) => void;
  agregar: (tipo: TipoGrafico, posicion: Posicion) => void;
  mover: (id: string, posicion: Posicion) => void;
  quitar: (id: string) => void;
  /** Corre el plan de estudios a un desplazamiento nuevo. */
  moverPlan: (desplazamiento: Desplazamiento) => void;
  /** Devuelve el plan a donde lo pone el acomodo automático. */
  restablecerPlan: () => void;
  /** Vuelve a leer lo de la carrera abierta. La usa la importación. */
  recargar: () => void;
}

/** Id único de cada gráfico puesto. `crypto.randomUUID` no está en todos lados. */
let siguiente = 0;
function nuevoId(): string {
  siguiente += 1;
  return `grafico-${Date.now().toString(36)}-${siguiente}`;
}

export const useTablero = create<EstadoTablero>((set, get) => {
  /** Guarda y deja el estado igual a lo guardado. */
  function asentar(graficos: Grafico[]) {
    const { carrera } = get();
    set({ graficos });
    if (carrera) guardarGraficos(carrera, graficos);
  }

  return {
    carrera: null,
    graficos: [],
    desplazamiento: SIN_MOVER,

    abrir: (carrera) => {
      if (get().carrera === carrera) return;
      set({
        carrera,
        graficos: leerGraficos(carrera),
        desplazamiento: leerDesplazamiento(carrera),
      });
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

    moverPlan: (desplazamiento) => {
      const { carrera } = get();
      set({ desplazamiento });
      if (carrera) guardarDesplazamiento(carrera, desplazamiento);
    },

    restablecerPlan: () => get().moverPlan(SIN_MOVER),

    recargar: () => {
      const { carrera } = get();
      if (!carrera) return;
      set({
        graficos: leerGraficos(carrera),
        desplazamiento: leerDesplazamiento(carrera),
      });
    },
  };
});
