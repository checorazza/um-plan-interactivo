/**
 * El menú del click derecho sobre una materia bloqueada.
 *
 * Sólo aparece ahí: sobre una materia disponible no hay nada que ofrecer, y
 * el menú del navegador queda anulado en toda la malla igual (ver `Malla`).
 */

import { useEffect, useRef } from "react";

import { IconoCandadoAbierto } from "./iconos";

/** Cuánto se separa el menú del borde de la ventana. */
const MARGEN = 8;
const ANCHO = 190;
const ALTO = 44;

export interface Posicion {
  idMateria: number;
  nombre: string;
  x: number;
  y: number;
}

interface Props {
  menu: Posicion;
  onDesbloquear: () => void;
  onCerrar: () => void;
}

export function MenuMateria({ menu, onDesbloquear, onCerrar }: Props) {
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

  // Que no se salga de la ventana al abrirlo contra el borde.
  const x = Math.min(menu.x, window.innerWidth - ANCHO - MARGEN);
  const y = Math.min(menu.y, window.innerHeight - ALTO - MARGEN);

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
    </div>
  );
}
