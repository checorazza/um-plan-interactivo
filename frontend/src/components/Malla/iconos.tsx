/** Iconos de las acciones sobre una materia. Heredan el color del botón. */

interface Props {
  className?: string;
}

/** Círculo mitad lleno: la materia está cursada pero no rendida. */
export function IconoRegular({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
    </svg>
  );
}

/** Tilde: la materia está aprobada. */
export function IconoAprobada({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 8.5 6.5 12 13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Candado: la materia está bloqueada. */
export function IconoCandado({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.75 7V5a3.25 3.25 0 0 1 6.5 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Candado abierto: desbloquear una materia a mano. */
export function IconoCandadoAbierto({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      {/* El arco mira para el otro lado que el del candado cerrado: es la
          misma forma, abierta. */}
      <path
        d="M4.75 7V5a3.25 3.25 0 0 1 6.5 0v.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="7"
        width="10"
        height="7"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Calendario: la fecha de vencimiento de una regularidad. */
export function IconoCalendario({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2.25" y="3.5" width="11.5" height="10" rx="1.5" />
        <path d="M2.25 6.75h11.5M5.5 2v3M10.5 2v3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
