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
