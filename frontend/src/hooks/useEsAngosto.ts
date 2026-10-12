import { useEffect, useState } from "react";

/** El mismo ancho que el `@media` del panel. */
const ANCHO_ANGOSTO = "(max-width: 720px)";

/**
 * `true` en pantallas angostas.
 *
 * La malla se acomoda igual en todas: lo único que cambia es lo que no entra
 * sin estorbar, como el minimapa.
 */
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
