/** Iconos del panel de gráficos. */

interface Props {
  className?: string;
}

/** Un anillo con una porción marcada. */
export function IconoTorta({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.35"
      />
      {/* Un cuarto del anillo, arrancando arriba. */}
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="8.6 25.9"
        strokeDashoffset="0"
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

/** Tres barras de distinta altura. */
export function IconoBarras({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="2" y="9" width="3" height="5" rx="1" opacity="0.4" />
        <rect x="6.5" y="4" width="3" height="10" rx="1" />
        <rect x="11" y="7" width="3" height="7" rx="1" opacity="0.4" />
      </g>
    </svg>
  );
}

/** Dos pistas con su relleno: un medidor. */
export function IconoMedidor({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="2" y="3.5" width="12" height="3" rx="1.5" opacity="0.3" />
        <rect x="2" y="3.5" width="8.5" height="3" rx="1.5" />
        <rect x="2" y="9.5" width="12" height="3" rx="1.5" opacity="0.3" />
        <rect x="2" y="9.5" width="4.5" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

/** Barras horizontales partidas: una por año, cada una con sus tramos. */
export function IconoApiladas({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="2" y="3" width="7" height="2.6" rx="1.3" />
        <rect x="10" y="3" width="4" height="2.6" rx="1.3" opacity="0.35" />
        <rect x="2" y="6.7" width="4.5" height="2.6" rx="1.3" />
        <rect x="7.5" y="6.7" width="6.5" height="2.6" rx="1.3" opacity="0.35" />
        <rect x="2" y="10.4" width="2.5" height="2.6" rx="1.3" />
        <rect x="5.5" y="10.4" width="8.5" height="2.6" rx="1.3" opacity="0.35" />
      </g>
    </svg>
  );
}
