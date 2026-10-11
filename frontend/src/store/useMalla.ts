/**
 * Estado de la app: el plan cargado y el progreso del usuario.
 *
 * Toda la lógica de reglas vive en `src/domain/reglas.ts`; acá sólo se
 * orquesta. En particular, `marcar` nunca aplica un cambio que requiera
 * revertir otras materias: lo deja pendiente de confirmación y la UI pregunta.
 */

import { create } from "zustand";

import { ErrorDeApi, getCarreras, getPlan } from "../api/cliente";
import { armarPlan } from "../domain/plan";
import { aplicarCambio, type Revertida } from "../domain/reglas";
import type { Carrera } from "../types/carrera";
import type { Estado, Estados } from "../types/estado";
import type { Plan } from "../types/plan";

/** Un cambio que espera confirmación porque revierte otras materias. */
export interface CascadaPendiente {
  idMateria: number;
  nombre: string;
  nuevoEstado: Estado | null;
  estados: Estados;
  revertidas: Revertida[];
}

interface EstadoMalla {
  carreras: Carrera[];
  idCarrera: number | null;
  plan: Plan | null;
  estados: Estados;

  cargando: boolean;
  error: string | null;

  /** Materia con el menú de acciones abierto. */
  seleccionada: number | null;
  cascada: CascadaPendiente | null;

  cargarCarreras: () => Promise<void>;
  seleccionarCarrera: (idCarrera: number) => Promise<void>;
  seleccionar: (idMateria: number | null) => void;
  marcar: (idMateria: number, nuevoEstado: Estado | null) => void;
  confirmarCascada: () => void;
  cancelarCascada: () => void;
  reiniciar: () => void;
}

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorDeApi) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

export const useMalla = create<EstadoMalla>((set, get) => ({
  carreras: [],
  idCarrera: null,
  plan: null,
  estados: {},
  cargando: false,
  error: null,
  seleccionada: null,
  cascada: null,

  cargarCarreras: async () => {
    set({ cargando: true, error: null });
    try {
      const carreras = await getCarreras();
      set({ carreras, cargando: false });
      const primera = carreras[0];
      if (primera && get().idCarrera === null) {
        await get().seleccionarCarrera(primera.id_carrera);
      }
    } catch (error) {
      set({ cargando: false, error: mensajeDe(error) });
    }
  },

  seleccionarCarrera: async (idCarrera) => {
    set({ cargando: true, error: null, seleccionada: null });
    try {
      const respuesta = await getPlan(idCarrera);
      set({
        idCarrera,
        plan: armarPlan(respuesta),
        cargando: false,
      });
    } catch (error) {
      set({ cargando: false, error: mensajeDe(error) });
    }
  },

  seleccionar: (idMateria) => set({ seleccionada: idMateria }),

  marcar: (idMateria, nuevoEstado) => {
    const { plan, estados } = get();
    if (!plan) return;

    const cambio = aplicarCambio(plan, estados, idMateria, nuevoEstado);

    if (!cambio.ok) {
      // No debería pasar: la UI deshabilita las acciones imposibles. Si pasa,
      // el motivo se muestra en vez de fallar en silencio.
      set({ error: cambio.motivo });
      return;
    }

    if (cambio.revertidas.length > 0) {
      set({
        cascada: {
          idMateria,
          nombre: plan.materias.get(idMateria)?.nombre ?? `#${idMateria}`,
          nuevoEstado,
          estados: cambio.estados,
          revertidas: cambio.revertidas,
        },
      });
      return;
    }

    set({ estados: cambio.estados, error: null });
  },

  confirmarCascada: () => {
    const { cascada } = get();
    if (!cascada) return;
    set({ estados: cascada.estados, cascada: null, error: null });
  },

  cancelarCascada: () => set({ cascada: null }),

  reiniciar: () => set({ estados: {}, seleccionada: null, cascada: null }),
}));
