/**
 * Los gráficos que el usuario dejó puestos sobre la malla.
 *
 * Van en su propia clave, aparte del progreso: son acomodo de pantalla, no
 * datos. Si se pierden no pasa nada —se vuelven a arrastrar—, así que acá
 * todo lo dudoso se descarta sin avisar.
 *
 * Se indexan por **nombre** de carrera y no por id: las posiciones son del
 * tablero de esa carrera, y el id cambia si se recarga el plan.
 */

import { PREFIJO, borrarCrudo, escribirCrudo, leerCrudo } from "./crudo";

export const VERSION_GRAFICOS = 1;

const CLAVE = `${PREFIJO}:graficos`;

/** Los gráficos que se pueden poner. */
export type TipoGrafico = "torta-progreso" | "aprobadas-por-anio";

export const TIPOS: TipoGrafico[] = ["torta-progreso", "aprobadas-por-anio"];

export interface Grafico {
  /** Único dentro de la carrera; lo usa React Flow como id de nodo. */
  id: string;
  tipo: TipoGrafico;
  /** En coordenadas del tablero, no de la pantalla. */
  x: number;
  y: number;
}

function sanearGrafico(valor: unknown): Grafico | null {
  if (!valor || typeof valor !== "object") return null;
  const dato = valor as Record<string, unknown>;

  if (typeof dato.id !== "string" || !dato.id) return null;
  if (!TIPOS.includes(dato.tipo as TipoGrafico)) return null;
  if (!Number.isFinite(dato.x) || !Number.isFinite(dato.y)) return null;

  return {
    id: dato.id,
    tipo: dato.tipo as TipoGrafico,
    x: Number(dato.x),
    y: Number(dato.y),
  };
}

function leerTodo(): Record<string, Grafico[]> {
  const guardado = leerCrudo(CLAVE);
  if (!guardado || typeof guardado !== "object") return {};

  const dato = guardado as Record<string, unknown>;
  if (dato.version !== VERSION_GRAFICOS) return {};
  if (!dato.porCarrera || typeof dato.porCarrera !== "object") return {};

  const porCarrera: Record<string, Grafico[]> = {};
  for (const [carrera, lista] of Object.entries(
    dato.porCarrera as Record<string, unknown>,
  )) {
    if (!Array.isArray(lista)) continue;
    porCarrera[carrera] = lista
      .map(sanearGrafico)
      .filter((grafico): grafico is Grafico => grafico !== null);
  }
  return porCarrera;
}

export function leerGraficos(carrera: string): Grafico[] {
  return leerTodo()[carrera] ?? [];
}

export function guardarGraficos(carrera: string, graficos: Grafico[]): boolean {
  const porCarrera = leerTodo();
  if (graficos.length === 0) delete porCarrera[carrera];
  else porCarrera[carrera] = graficos;

  if (Object.keys(porCarrera).length === 0) {
    borrarCrudo(CLAVE);
    return true;
  }
  return escribirCrudo(CLAVE, { version: VERSION_GRAFICOS, porCarrera });
}
