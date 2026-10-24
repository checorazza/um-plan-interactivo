/**
 * Exportar e importar el progreso como un archivo JSON.
 *
 * Lo que viaja es el progreso entero: los estados, las materias
 * desbloqueadas a mano, las fechas de regularidad y de aprobación, las
 * básicas compartidas y —esto es lo importante— las **claves naturales**.
 *
 * Sin las claves, el archivo sólo serviría en la misma base de datos: los
 * ids de materia cambian cada vez que se recarga un plan, y en otra máquina
 * son otros. Con ellas, cada estado lleva su "carrera|código" al lado y el
 * progreso se reconstruye solo al abrir la carrera.
 *
 * Viajan también las preferencias y los gráficos del tablero, que son cómo
 * se ve la app. Son opcionales: un archivo de la versión 1 sólo traía el
 * progreso y se sigue aceptando.
 */

import {
  type GraficosPorCarrera,
  VERSION_GRAFICOS,
  escribirTodosLosGraficos,
  interpretarGraficos,
  leerTodosLosGraficos,
} from "./graficos";
import {
  type Contenido,
  VERSION,
  escribirContenido,
  interpretar,
} from "./local";
import {
  type Preferencias,
  VERSION_PREFERENCIAS,
  guardarPreferencias,
  interpretarPreferencias,
  leerPreferencias,
} from "./preferencias";

/**
 * Versión del archivo, aparte de la del storage que lleva adentro.
 *
 * - 1: sólo el progreso.
 * - 2: se agregan las preferencias y los gráficos del tablero.
 */
export const VERSION_RESPALDO = 2;

/** Las que se saben leer. La 1 no traía aspecto y se adopta igual. */
const ACEPTADAS = [1, VERSION_RESPALDO];

const APLICACION = "um-plan-interactivo";

export interface Respaldo {
  aplicacion: string;
  version: number;
  exportadoEn: string;
  /** El progreso tal cual se guarda, con su propia versión. */
  progreso: Record<string, unknown>;
  /** El aspecto: tema, colores y opciones. Desde la versión 2. */
  preferencias?: Record<string, unknown>;
  /** Los gráficos del tablero, por carrera. Desde la versión 2. */
  graficos?: Record<string, unknown>;
}

/** Todo lo que un archivo puede traer, ya saneado. */
export interface Importado {
  contenido: Contenido;
  preferencias: Preferencias | null;
  graficos: GraficosPorCarrera | null;
}

/** Un vistazo de lo que trae un archivo, para mostrarlo antes de aplicarlo. */
export interface Resumen {
  aprobadas: number;
  regulares: number;
  desbloqueadas: number;
  fechas: number;
  /** Si el archivo trae el aspecto guardado. */
  preferencias: boolean;
  /** Cuántos gráficos puestos trae, sumando todas las carreras. */
  graficos: number;
  exportadoEn: string | null;
}

export function resumirContenido(
  { contenido, preferencias, graficos }: Importado,
  exportadoEn: string | null = null,
): Resumen {
  // Las básicas van aparte y **no** están duplicadas en `estados`: su
  // estado vive sólo en el mapa por código, porque se comparte entre
  // carreras. Si no se contaran, el progreso de alguien que sólo marcó
  // materias comunes se vería vacío y la importación lo rechazaría.
  const estados = [
    ...Object.values(contenido.estados),
    ...Object.values(contenido.basicas),
  ];
  return {
    aprobadas: estados.filter((estado) => estado === "aprobada").length,
    regulares: estados.filter((estado) => estado === "regular").length,
    desbloqueadas: contenido.desbloqueadas.size,
    fechas:
      Object.keys(contenido.vencimientos).length +
      Object.keys(contenido.aprobaciones).length,
    preferencias: preferencias !== null,
    graficos: Object.values(graficos ?? {}).reduce(
      (suma, lista) => suma + lista.length,
      0,
    ),
    exportadoEn,
  };
}

/** Lo que hay en este dispositivo, listo para escribir a un archivo. */
export function armarRespaldo(contenido: Contenido): Respaldo {
  return {
    aplicacion: APLICACION,
    version: VERSION_RESPALDO,
    exportadoEn: new Date().toISOString(),
    preferencias: {
      version: VERSION_PREFERENCIAS,
      ...leerPreferencias(),
    },
    graficos: {
      version: VERSION_GRAFICOS,
      porCarrera: leerTodosLosGraficos(),
    },
    progreso: {
      version: VERSION,
      estados: contenido.estados,
      claves: contenido.claves,
      basicas: contenido.basicas,
      // Un `Set` no sobrevive a `JSON.stringify`.
      desbloqueadas: [...contenido.desbloqueadas].sort((a, b) => a - b),
      vencimientos: contenido.vencimientos,
      aprobaciones: contenido.aprobaciones,
    },
  };
}

/** Cómo se llama el archivo que se descarga. */
export function nombreDeArchivo(ahora: Date = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `plan-interactivo-${ahora.getFullYear()}-${mes}-${dia}.json`;
}

export type Lectura =
  | ({ ok: true; resumen: Resumen } & Importado)
  | { ok: false; motivo: string };

/**
 * Lee un archivo exportado.
 *
 * Todo lo que entra se pasa por el mismo filtro que lo guardado: el archivo
 * lo pudo haber editado cualquiera. Un archivo sin nada marcado se rechaza
 * con un motivo en vez de pisar el progreso con la nada, que es el error que
 * más caro sale deshacer.
 */
export function leerRespaldo(texto: string): Lectura {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: "El archivo no es un JSON válido." };
  }

  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return { ok: false, motivo: "El archivo no tiene la forma esperada." };
  }

  const dato = valor as Partial<Respaldo>;
  if (dato.aplicacion !== APLICACION) {
    return { ok: false, motivo: "Ese archivo no es un respaldo de esta app." };
  }
  if (typeof dato.version !== "number" || !ACEPTADAS.includes(dato.version)) {
    return {
      ok: false,
      motivo: `El archivo es de otra versión (${String(dato.version)}).`,
    };
  }

  const importado: Importado = {
    contenido: interpretar(dato.progreso),
    // Un archivo sin aspecto no es un archivo con el aspecto por defecto:
    // sería pisarle los colores a quien importa un respaldo viejo.
    preferencias: dato.preferencias
      ? interpretarPreferencias(dato.preferencias)
      : null,
    // `interpretarGraficos` espera el envoltorio entero —con su versión—,
    // no el mapa de adentro, que es lo que `armarRespaldo` escribe acá.
    graficos: dato.graficos ? interpretarGraficos(dato.graficos) : null,
  };
  const resumen = resumirContenido(
    importado,
    typeof dato.exportadoEn === "string" ? dato.exportadoEn : null,
  );

  if (resumen.aprobadas + resumen.regulares === 0) {
    return {
      ok: false,
      motivo: "El archivo no tiene ninguna materia marcada.",
    };
  }

  return { ok: true, ...importado, resumen };
}

/**
 * Pisa lo de este dispositivo con lo del archivo.
 *
 * Lo que el archivo no traiga se deja como está: un respaldo viejo, sin
 * aspecto, no tiene por qué devolverle los colores al original.
 */
export function aplicarRespaldo({
  contenido,
  preferencias,
  graficos,
}: Importado): boolean {
  let ok = escribirContenido(contenido);
  if (preferencias) ok = guardarPreferencias(preferencias) && ok;
  if (graficos) ok = escribirTodosLosGraficos(graficos) && ok;
  return ok;
}
