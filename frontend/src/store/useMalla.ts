/**
 * Estado de la app: el plan cargado y el progreso del usuario.
 *
 * Toda la lógica de reglas vive en `src/domain/reglas.ts`; acá sólo se
 * orquesta. En particular, `marcar` nunca aplica un cambio que requiera
 * revertir otras materias: lo deja pendiente de confirmación y la UI pregunta.
 *
 * localStorage es siempre la fuente inmediata, con o sin sesión. El servidor
 * es una copia que se empuja detrás: así un backend caído no rompe nada, que
 * es el caso principal de la app.
 */

import { create } from "zustand";

import {
  ErrorDeApi,
  getCarreras,
  getMisEstados,
  getPlan,
  putMisEstados,
} from "../api/cliente";
import { armarPlan } from "../domain/plan";
import {
  aplicarCambio,
  combinarEstados,
  sanearEstados,
  type Conflicto,
  type Revertida,
} from "../domain/reglas";
import {
  borrarProgreso,
  guardarCarrera,
  guardarDeCarrera,
  guardarTodo,
  leerCarrera,
  leerDeCarrera,
  leerTodo,
  adoptarBasicas,
  registrarBasica,
} from "../storage/local";
import type { Carrera } from "../types/carrera";
import type { Estado, Estados } from "../types/estado";
import type { Plan, RespuestaPlan } from "../types/plan";
import { useSesion } from "./useSesion";

/** Un cambio que espera confirmación porque revierte otras materias. */
export interface CascadaPendiente {
  idMateria: number;
  nombre: string;
  nuevoEstado: Estado | null;
  estados: Estados;
  revertidas: Revertida[];
}

/** Cómo resolver un progreso local y uno de la nube que no coinciden. */
export type OpcionConflicto = "dispositivo" | "nube" | "combinar";

export interface ConflictoSync {
  local: Estados;
  nube: Estados;
}

export type EstadoSync =
  | "local" // sin sesión: sólo este dispositivo
  | "sincronizando"
  | "sincronizado"
  | "error";

interface EstadoMalla {
  carreras: Carrera[];
  idCarrera: number | null;
  plan: Plan | null;
  /** Progreso de la carrera abierta. El de las otras vive en el storage. */
  estados: Estados;
  /**
   * Materias de esta carrera desbloqueadas a mano: quedan exentas de los
   * créditos del año y de las correlativas hasta que se las desmarca.
   */
  desbloqueadas: Set<number>;

  cargando: boolean;
  error: string | null;
  /**
   * Materias que venían guardadas pero ya no cumplen las reglas del plan.
   * Pasa cuando el plan cambió desde la última visita.
   */
  descartadas: Conflicto[];
  /** El navegador no deja escribir (incógnito, cuota llena, cookies off). */
  sinPersistencia: boolean;

  sync: EstadoSync;
  errorSync: string | null;
  conflicto: ConflictoSync | null;

  /** Materia con el menú de acciones abierto. */
  seleccionada: number | null;
  cascada: CascadaPendiente | null;

  cargarCarreras: () => Promise<void>;
  /**
   * `precargado` evita una segunda vuelta a la red: al abrir la app ya
   * sabemos, por el storage, qué carrera mostrar, así que el plan se puede
   * pedir en paralelo con la lista de carreras en vez de esperarla.
   */
  seleccionarCarrera: (
    idCarrera: number,
    precargado?: Promise<RespuestaPlan>,
  ) => Promise<void>;
  seleccionar: (idMateria: number | null) => void;
  /**
   * Exime a una materia de las reglas y la marca. El desbloqueo se pierde en
   * cuanto se la desmarca.
   */
  desbloquear: (idMateria: number, estado: Estado) => void;
  marcar: (idMateria: number, nuevoEstado: Estado | null) => void;
  confirmarCascada: () => void;
  cancelarCascada: () => void;
  reiniciar: () => void;
  descartarAviso: () => void;

  /** Compara el progreso local con el de la nube. Se llama al iniciar sesión. */
  sincronizar: () => Promise<void>;
  resolverConflicto: (opcion: OpcionConflicto) => Promise<void>;
  /** Vuelve al modo local. `borrar` limpia el progreso de este dispositivo. */
  salirDeLaSesion: (borrar: boolean) => void;
}

function mensajeDe(error: unknown): string {
  if (error instanceof ErrorDeApi) return error.message;
  if (error instanceof Error) return error.message;
  return "Error inesperado";
}

function iguales(a: Estados, b: Estados): boolean {
  const clavesA = Object.keys(a);
  const clavesB = Object.keys(b);
  if (clavesA.length !== clavesB.length) return false;
  return clavesA.every((clave) => a[Number(clave)] === b[Number(clave)]);
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

/** Temporizador del push al servidor. */
let empujeProgramado: ReturnType<typeof setTimeout> | null = null;
const ESPERA_EMPUJE = 700;

export const useMalla = create<EstadoMalla>((set, get) => {
  /**
   * Propaga a las otras carreras los cambios sobre materias básicas.
   *
   * Sólo ante un cambio explícito del usuario. Lo que descarta `sanearEstados`
   * al abrir una carrera no se propaga: que una básica no sea alcanzable en
   * este plan no quiere decir que deje de estar aprobada en el otro.
   */
  function anotarBasicas(plan: Plan, antes: Estados, despues: Estados) {
    for (const [idMateria, materia] of plan.materias) {
      if (materia.id_basica === null) continue;
      const a = antes[idMateria];
      const d = despues[idMateria];
      if (a === d) continue;
      // Por código, no por id de grupo: los ids cambian al recargar un plan.
      registrarBasica(materia.codigo, d ?? null);
    }
  }

  /** Guarda en el dispositivo y, si hay sesión, programa el push. */
  function persistir(estados: Estados, antes: Estados) {
    const plan = get().plan;
    if (!plan) return;

    anotarBasicas(plan, antes, estados);
    set({
      sinPersistencia: !guardarDeCarrera(plan, estados, get().desbloqueadas),
    });
    programarEmpuje();
  }

  /**
   * Empuja **todo** el progreso al servidor, no sólo lo que cambió.
   *
   * Mandar el conjunto completo evita toda la coreografía de cambios
   * puntuales (el 409 de las cascadas, el orden en que se aplican, los
   * reintentos parciales): el servidor valida el conjunto entero y queda
   * igual a lo que el usuario ve. Son unas decenas de materias, así que el
   * payload es chico.
   */
  function programarEmpuje() {
    if (!useSesion.getState().usuario) return;

    if (empujeProgramado) clearTimeout(empujeProgramado);
    empujeProgramado = setTimeout(() => {
      empujeProgramado = null;
      void empujar();
    }, ESPERA_EMPUJE);
  }

  async function empujar() {
    if (!useSesion.getState().usuario) return;

    set({ sync: "sincronizando", errorSync: null });
    try {
      await putMisEstados(leerTodo());
      set({ sync: "sincronizado" });
    } catch (error) {
      if (error instanceof ErrorDeApi && error.esSesionVencida) {
        useSesion.getState().cerrar();
        set({ sync: "local", errorSync: "La sesión venció. Volvé a entrar." });
        return;
      }
      // El progreso sigue a salvo en el dispositivo; se reintenta en el
      // próximo cambio.
      set({ sync: "error", errorSync: mensajeDe(error) });
    }
  }

  /** Vuelve a cargar en la vista el progreso del storage. */
  function refrescarDesdeStorage() {
    const plan = get().plan;
    if (!plan) return;
    adoptarBasicas(plan);
    const guardado = leerDeCarrera(plan);
    const { estados } = sanearEstados(
      plan,
      guardado.estados,
      guardado.desbloqueadas,
    );
    set({ estados, desbloqueadas: guardado.desbloqueadas });
  }

  return {
    carreras: [],
    idCarrera: null,
    plan: null,
    estados: {},
    desbloqueadas: new Set(),
    cargando: false,
    error: null,
    descartadas: [],
    sinPersistencia: false,
    sync: "local",
    errorSync: null,
    conflicto: null,
    seleccionada: null,
    cascada: null,

    cargarCarreras: async () => {
      if (cargaEnCurso) return cargaEnCurso;
      cargaEnCurso = (async () => {
        set({ cargando: true, error: null });

        // Las dos llamadas salen juntas. La lista de carreras no hace falta
        // para pedir el plan de la que ya estaba abierta, y encadenarlas
        // costaba una vuelta completa a la red de más en cada visita.
        const guardada = leerCarrera();
        const pedidoCarreras = getCarreras();
        const pedidoPlan =
          guardada === null ? null : getPlan(guardada).catch(() => null);

        try {
          const carreras = await pedidoCarreras;
          set({ carreras, cargando: false });

          if (get().idCarrera !== null) return;

          // Si la carrera que el usuario tenía abierta sigue existiendo, se
          // vuelve a ella; si no, a la primera.
          const elegida =
            carreras.find((c) => c.id_carrera === guardada) ?? carreras[0];
          if (!elegida) return;

          // El plan precargado sólo sirve si es el de la carrera elegida: la
          // guardada puede haber dejado de existir.
          const precargado =
            elegida.id_carrera === guardada && pedidoPlan
              ? pedidoPlan.then((r) => r ?? getPlan(elegida.id_carrera))
              : undefined;

          await get().seleccionarCarrera(elegida.id_carrera, precargado);
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

    seleccionarCarrera: async (idCarrera, precargado) => {
      set({ cargando: true, error: null, seleccionada: null });
      try {
        const respuesta = await (precargado ?? getPlan(idCarrera));
        const plan = armarPlan(respuesta);

        // Lo guardado se valida contra el plan recién traído: puede haber
        // cambiado (otra correlativa, otros créditos) desde la última visita.
        // Lo que vino de la nube llega por materia: se adopta en los grupos
        // antes de leer, para que las básicas queden en un solo lugar.
        adoptarBasicas(plan);
        const guardado = leerDeCarrera(plan);
        const { estados, descartadas } = sanearEstados(
          plan,
          guardado.estados,
          guardado.desbloqueadas,
        );

        // Una básica que vino de otra carrera y que este plan no admite no es
        // un dato perdido: sigue aprobada allá. No se anuncia como descarte.
        const propagados = new Set(guardado.propagados);
        const aAvisar = descartadas.filter((c) => !propagados.has(c.idMateria));

        set({
          idCarrera,
          plan,
          estados,
          desbloqueadas: guardado.desbloqueadas,
          descartadas: aAvisar,
          cargando: false,
        });
        guardarCarrera(idCarrera);

        // Lo propagado todavía no estaba guardado como propio de esta carrera,
        // y lo descartado ya no se muestra: en los dos casos hay que grabar.
        if (descartadas.length > 0 || guardado.propagados.length > 0) {
          set({
            sinPersistencia: !guardarDeCarrera(
              plan,
              estados,
              guardado.desbloqueadas,
            ),
          });
          programarEmpuje();
        }
      } catch (error) {
        set({ cargando: false, error: mensajeDe(error) });
      }
    },

    seleccionar: (idMateria) => set({ seleccionada: idMateria }),

    desbloquear: (idMateria, estado) => {
      const { plan, desbloqueadas } = get();
      if (!plan) return;

      // Primero el desbloqueo y después la marca, en ese orden: `marcar` lee
      // el conjunto del store, así que la materia ya le llega exenta.
      set({ desbloqueadas: new Set(desbloqueadas).add(idMateria) });
      get().marcar(idMateria, estado);
    },

    marcar: (idMateria, nuevoEstado) => {
      const { plan, estados, desbloqueadas } = get();
      if (!plan) return;

      // Desmarcar devuelve la materia a las reglas: el desbloqueo era para
      // este estado, no para siempre. Se quita antes de calcular el cambio,
      // así la cascada ya la evalúa como una materia común.
      if (nuevoEstado === null && desbloqueadas.has(idMateria)) {
        const sinEsta = new Set(desbloqueadas);
        sinEsta.delete(idMateria);
        set({ desbloqueadas: sinEsta });
      }

      const cambio = aplicarCambio(
        plan,
        estados,
        idMateria,
        nuevoEstado,
        get().desbloqueadas,
      );

      if (!cambio.ok) {
        // No debería pasar: la UI deshabilita las acciones imposibles. Si
        // pasa, el motivo se muestra en vez de fallar en silencio.
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
      persistir(cambio.estados, estados);
    },

    confirmarCascada: () => {
      const { cascada } = get();
      if (!cascada) return;
      const antes = get().estados;
      set({ estados: cascada.estados, cascada: null, error: null });
      persistir(cascada.estados, antes);
    },

    cancelarCascada: () => set({ cascada: null }),

    reiniciar: () => {
      set({
        estados: {},
        desbloqueadas: new Set(),
        seleccionada: null,
        cascada: null,
        descartadas: [],
      });
      borrarProgreso();
      programarEmpuje();
    },

    descartarAviso: () => set({ descartadas: [] }),

    sincronizar: async () => {
      if (!useSesion.getState().usuario) return;

      set({ sync: "sincronizando", errorSync: null });
      try {
        const nube = await getMisEstados();
        const local = leerTodo();

        if (iguales(local, nube)) {
          set({ sync: "sincronizado" });
          return;
        }

        // Si uno de los dos está vacío no hay nada que perder: se resuelve
        // solo. Preguntar ahí sería una pregunta sin consecuencias.
        if (Object.keys(nube).length === 0) {
          await putMisEstados(local);
          set({ sync: "sincronizado" });
          return;
        }
        if (Object.keys(local).length === 0) {
          guardarTodo(nube);
          refrescarDesdeStorage();
          set({ sync: "sincronizado" });
          return;
        }

        set({ conflicto: { local, nube }, sync: "sincronizando" });
      } catch (error) {
        if (error instanceof ErrorDeApi && error.esSesionVencida) {
          useSesion.getState().cerrar();
          set({ sync: "local", errorSync: "La sesión venció. Volvé a entrar." });
          return;
        }
        set({ sync: "error", errorSync: mensajeDe(error) });
      }
    },

    resolverConflicto: async (opcion) => {
      const conflicto = get().conflicto;
      if (!conflicto) return;

      const elegido =
        opcion === "dispositivo"
          ? conflicto.local
          : opcion === "nube"
            ? conflicto.nube
            : combinarEstados(conflicto.local, conflicto.nube);

      set({ conflicto: null, sync: "sincronizando", errorSync: null });

      // Se guarda primero en el dispositivo: si el push falla, el usuario no
      // pierde lo que acaba de elegir.
      guardarTodo(elegido);
      refrescarDesdeStorage();

      try {
        await putMisEstados(elegido);
        set({ sync: "sincronizado" });
      } catch (error) {
        set({ sync: "error", errorSync: mensajeDe(error) });
      }
    },

    salirDeLaSesion: (borrar) => {
      if (empujeProgramado) {
        clearTimeout(empujeProgramado);
        empujeProgramado = null;
      }
      useSesion.getState().cerrar();

      if (borrar) {
        borrarProgreso();
        set({ estados: {}, desbloqueadas: new Set() });
      }
      set({ sync: "local", errorSync: null, conflicto: null });
    },
  };
});
