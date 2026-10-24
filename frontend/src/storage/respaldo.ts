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
 * No viajan las preferencias ni los gráficos del tablero: eso es cómo se ve
 * la app, no lo que hiciste en la carrera.
 */

import {
  type Contenido,
  VERSION,
  escribirContenido,
  interpretar,
} from "./local";

/** Versión del archivo, aparte de la del storage que lleva adentro. */
export const VERSION_RESPALDO = 1;

const APLICACION = "um-plan-interactivo";

export interface Respaldo {
  aplicacion: string;
  version: number;
  exportadoEn: string;
  /** El progreso tal cual se guarda, con su propia versión. */
  progreso: Record<string, unknown>;
}

/** Un vistazo de lo que trae un archivo, para mostrarlo antes de aplicarlo. */
export interface Resumen {
  aprobadas: number;
  regulares: number;
  desbloqueadas: number;
  fechas: number;
  exportadoEn: string | null;
}

export function resumirContenido(
  contenido: Contenido,
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
    exportadoEn,
  };
}

/** El progreso de este dispositivo, listo para escribir a un archivo. */
export function armarRespaldo(contenido: Contenido): Respaldo {
  return {
    aplicacion: APLICACION,
    version: VERSION_RESPALDO,
    exportadoEn: new Date().toISOString(),
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
  | { ok: true; contenido: Contenido; resumen: Resumen }
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
  if (dato.version !== VERSION_RESPALDO) {
    return {
      ok: false,
      motivo: `El archivo es de otra versión (${String(dato.version)}).`,
    };
  }

  const contenido = interpretar(dato.progreso);
  const resumen = resumirContenido(
    contenido,
    typeof dato.exportadoEn === "string" ? dato.exportadoEn : null,
  );

  if (resumen.aprobadas + resumen.regulares === 0) {
    return {
      ok: false,
      motivo: "El archivo no tiene ninguna materia marcada.",
    };
  }

  return { ok: true, contenido, resumen };
}

/** Pisa el progreso de este dispositivo con el del archivo. */
export function aplicarRespaldo(contenido: Contenido): boolean {
  return escribirContenido(contenido);
}
