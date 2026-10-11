import { useEffect, useState } from "react";

const OSCURO = "(prefers-color-scheme: dark)";

/**
 * `true` si el sistema está en oscuro.
 *
 * No se usa para elegir los colores —eso lo hace CSS solo— sino para que el
 * panel de personalización vuelva a leer los colores del tema cuando el
 * sistema cambia y la app está en "automático".
 */
export function useOscuroDelSistema(): boolean {
  const [oscuro, setOscuro] = useState(() => window.matchMedia(OSCURO).matches);

  useEffect(() => {
    const consulta = window.matchMedia(OSCURO);
    const alCambiar = (evento: MediaQueryListEvent) => setOscuro(evento.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  return oscuro;
}
