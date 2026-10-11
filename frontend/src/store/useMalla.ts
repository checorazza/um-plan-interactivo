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
import {
  aplicarCambio,
  sanearEstados,
  type Conflicto,
  type Revertida,
} from "../domain/reglas";
import {
  borrarTodo,
  guardarCarrera,
  guardarEstados,
  leerCarrera,
  leerEstados,
} from "../storage/local";
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
  /**
   * Materias que venían guardadas pero ya no cumplen las reglas del plan.
   * Pasa cuando el plan cambió desde la última visita.
   */
  descartadas: Conflicto[];
  /** El navegador no deja escribir (incógnito, cuota llena, cookies off). */
  sinPersistencia: boolean;

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
  descartarAviso: () => void;
}

/**
 * Guarda el progreso.
 *
 * Se escribe en cada cambio en vez de con debounce: los cambios los dispara un
 * click, así que son pocos y espaciados, y escribir ya deja a salvo el último
 * aunque la pestaña se cierre enseguida.
 */
function persistir(
  idCarrera: number | null,
  estados: Estados,
  set: (parcial: Partial<EstadoMalla>) => void,
) {
  if (idCarrera === null) return;
  set({ sinPersistencia: !guardarEstados(idCarrera, estados) });
}

/**
 * La carga inicial en curso, si la hay.
 *
 * `cargarCarreras` se dispara desde un efecto, y React la invoca dos veces al
 * montar en desarrollo (StrictMode). Sin este guard se pide el plan dos veces
 * y, peor, la segunda pasada lee del storage lo que la primera ya saneó: el
 * aviso de "se desmarcaron materias" se perdía.
 */
let cargaEnCurso: Promise<void> | null = null;

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
  descartadas: [],
  sinPersistencia: false,
  seleccionada: null,
  cascada: null,

  cargarCarreras: async () => {
    if (cargaEnCurso) return cargaEnCurso;
    cargaEnCurso = (async () => {
      set({ cargando: true, error: null });
      try {
        const carreras = await getCarreras();
        set({ carreras, cargando: false });

        if (get().idCarrera !== null) return;

        // Si la carrera que el usuario tenía abierta sigue existiendo, se vuelve
        // a ella; si no, a la primera.
        const guardada = leerCarrera();
        const elegida =
          carreras.find((c) => c.id_carrera === guardada) ?? carreras[0];
        if (elegida) {
          await get().seleccionarCarrera(elegida.id_carrera);
        }
      } catch (error) {
        set({ cargando: false, error: mensajeDe(error) });
      }
    })();

    try {
      await cargaEnCurso;
    } finally {
      cargaEnCurso = null;
    }
  },

  seleccionarCarrera: async (idCarrera) => {
    set({ cargando: true, error: null, seleccionada: null });
    try {
      const respuesta = await getPlan(idCarrera);
      const plan = armarPlan(respuesta);

      // Lo guardado se valida contra el plan recién traído: puede haber
      // cambiado (otra correlativa, otros créditos) desde la última visita.
      const { estados, descartadas } = sanearEstados(
        plan,
        leerEstados(idCarrera),
      );

      set({ idCarrera, plan, estados, descartadas, cargando: false });
      guardarCarrera(idCarrera);

      // Si algo se descartó, lo guardado ya no refleja lo que se muestra.
      if (descartadas.length > 0) persistir(idCarrera, estados, set);
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
    persistir(get().idCarrera, cambio.estados, set);
  },

  confirmarCascada: () => {
    const { cascada } = get();
    if (!cascada) return;
    set({ estados: cascada.estados, cascada: null, error: null });
    persistir(get().idCarrera, cascada.estados, set);
  },

  cancelarCascada: () => set({ cascada: null }),

  reiniciar: () => {
    set({ estados: {}, seleccionada: null, cascada: null, descartadas: [] });
    borrarTodo();
    const idCarrera = get().idCarrera;
    if (idCarrera !== null) guardarCarrera(idCarrera);
  },

  descartarAviso: () => set({ descartadas: [] }),
}));
