/** Iconos del panel. Heredan el color del texto que los rodea. */

interface Props {
  className?: string;
}

/** Paleta de pintor: abre la personalización. */
export function IconoPaleta({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      focusable="false"
    >
      {/* La silueta hereda el color del texto; los pozos de pintura no, que
          para eso es una paleta. */}
      <path
        d="M8 1.6c3.5 0 6.4 2.5 6.4 5.6 0 1.8-1.4 2.6-2.6 2.6h-1.2c-.8
           0-1.4.6-1.4 1.3 0 .3.1.6.3.8.2.3.3.5.3.8 0 .9-.8 1.5-1.8
           1.5-3.5 0-6.4-2.8-6.4-6.4S4.5 1.6 8 1.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5.1" cy="6" r="1" fill="var(--regular-borde)" />
      <circle cx="7.9" cy="4.5" r="1" fill="var(--peligro)" />
      <circle cx="10.8" cy="5.9" r="1" fill="var(--aprobada-borde)" />
      <circle cx="4.9" cy="9.3" r="1" fill="var(--acento)" />
    </svg>
  );
}

/** Flecha a la izquierda: vuelve al panel principal. */
export function IconoVolver({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9.5 3.5 5 8l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Engranaje: abre los ajustes. */
export function IconoEngranaje({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.4">
        {/* Los dientes cruzan el aro: separados se leen como un sol. */}
        <path d="M12.00 8.00L14.60 8.00M10.83 10.83L12.67 12.67M8.00 12.00L8.00 14.60M5.17 10.83L3.33 12.67M4.00 8.00L1.40 8.00M5.17 5.17L3.33 3.33M8.00 4.00L8.00 1.40M10.83 5.17L12.67 3.33" strokeLinecap="round" />
        <circle cx="8" cy="8" r="4.6" />
        <circle cx="8" cy="8" r="1.9" />
      </g>
    </svg>
  );
}
