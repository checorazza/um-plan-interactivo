import { useEffect, useState } from "react";

/** Ancho a partir del cual la malla usa columnas por año. */
const ANCHO_ANGOSTO = "(max-width: 720px)";

/** `true` en pantallas angostas, donde los años se apilan en filas. */
export function useEsAngosto(): boolean {
  const [esAngosto, setEsAngosto] = useState(
    () => window.matchMedia(ANCHO_ANGOSTO).matches,
  );

  useEffect(() => {
    const consulta = window.matchMedia(ANCHO_ANGOSTO);
    const alCambiar = (evento: MediaQueryListEvent) => setEsAngosto(evento.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  return esAngosto;
}
