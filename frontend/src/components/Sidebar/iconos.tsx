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
