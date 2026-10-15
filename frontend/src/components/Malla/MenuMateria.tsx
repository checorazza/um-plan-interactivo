/**
 * El menú del click derecho sobre una materia.
 *
 * Muestra las opciones que vengan al caso: desbloquear una materia que las
 * reglas no dejan marcar, y la fecha que corresponda a su estado —hasta
 * cuándo vale la regularidad, o cuándo se aprobó—. Sobre una materia
 * disponible y sin marcar no hay nada que ofrecer y no se abre, aunque el
 * menú del navegador queda anulado en toda la malla igual (ver `Malla`).
 */

import { useEffect, useRef } from "react";

import { IconoCalendario, IconoCandadoAbierto } from "./iconos";

/** Cuánto se separa el menú del borde de la ventana. */
const MARGEN = 8;
const ANCHO = 215;
/** Alto de una opción, para no abrirlo contra el borde de abajo. */
const ALTO_OPCION = 36;

export interface Posicion {
  idMateria: number;
  nombre: string;
  x: number;
  y: number;
  /** Está bloqueada y sin marcar: se puede eximir de las reglas. */
  puedeDesbloquearse: boolean;
  /** Está regular: se le puede poner o cambiar el vencimiento. */
  esRegular: boolean;
  /** Está aprobada: se le puede poner o cambiar la fecha de aprobación. */
  esAprobada: boolean;
}

interface Props {
  menu: Posicion;
  onDesbloquear: () => void;
  onFecha: () => void;
  onCerrar: () => void;
}

export function MenuMateria({
  menu,
  onDesbloquear,
  onFecha,
  onCerrar,
}: Props) {
  const elemento = useRef<HTMLDivElement>(null);

  useEffect(() => {
    elemento.current?.focus();

    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        // Si no, el Escape sigue hasta la malla y deselecciona la materia.
        evento.stopPropagation();
        onCerrar();
      }
    };
    // Cualquier click, adentro o afuera, cierra: adentro porque la acción ya
    // se ejecutó, afuera porque es la forma de descartar un menú.
    window.addEventListener("mousedown", onCerrar);
    window.addEventListener("keydown", alTecla);
    // Scrollear o mover la malla dejaría el menú flotando lejos del nodo.
    window.addEventListener("wheel", onCerrar, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onCerrar);
      window.removeEventListener("keydown", alTecla);
      window.removeEventListener("wheel", onCerrar);
    };
  }, [onCerrar]);

  const opciones =
    (menu.puedeDesbloquearse ? 1 : 0) +
    (menu.esRegular || menu.esAprobada ? 1 : 0);

  // Que no se salga de la ventana al abrirlo contra el borde.
  const x = Math.min(menu.x, window.innerWidth - ANCHO - MARGEN);
  const y = Math.min(
    menu.y,
    window.innerHeight - opciones * ALTO_OPCION - MARGEN,
  );

  return (
    <div
      className="menu-materia"
      ref={elemento}
      role="menu"
      aria-label={"Acciones de " + menu.nombre}
      tabIndex={-1}
      style={{ left: Math.max(MARGEN, x), top: Math.max(MARGEN, y) }}
      onMouseDown={(evento) => evento.stopPropagation()}
    >
      {menu.puedeDesbloquearse && (
        <button
          type="button"
          role="menuitem"
          className="menu-materia__opcion"
          onClick={() => {
            onDesbloquear();
            onCerrar();
          }}
        >
          <IconoCandadoAbierto />
          <span>Desbloquear materia</span>
        </button>
      )}

      {(menu.esRegular || menu.esAprobada) && (
        <button
          type="button"
          role="menuitem"
          className="menu-materia__opcion"
          onClick={() => {
            onFecha();
            onCerrar();
          }}
        >
          <IconoCalendario />
          <span>
            {menu.esRegular ? "Fecha de regularidad" : "Fecha de aprobación"}
          </span>
        </button>
      )}
    </div>
  );
}
