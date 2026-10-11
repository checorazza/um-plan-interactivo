/**
 * El selector de color de la app.
 *
 * Reemplaza al `<input type="color">` nativo, que abre el diálogo del sistema
 * operativo: distinto en cada máquina, imposible de estilar y fuera de la
 * página.
 *
 * El estado interno es HSV y no hexa. En hexa el tono se pierde: al arrastrar
 * el puntero hasta el negro o hasta el gris, el color deja de tener tono, y
 * al volver a subir el puntero saltaría a otro lado. Guardando el tono aparte
 * la rueda se queda donde el usuario la dejó.
 */

import { useEffect, useRef, useState } from "react";

import {
  FORMATOS,
  type Formato,
  type Hsv,
  formatear,
  hexAHsv,
  hsvAHex,
  parsear,
} from "./color";

const NOMBRE_FORMATO: Record<Formato, string> = {
  hex: "Hex",
  rgb: "RGB",
  hsl: "HSL",
};

/** Cuánto se mueve el puntero con una flecha del teclado. */
const PASO = 0.02;
const PASO_TONO = 3;

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

interface Props {
  /** El color que se está viendo, siempre `#rrggbb`. */
  valor: string;
  onChange: (hex: string) => void;
  onCerrar: () => void;
  /** Para los `aria-label` de los controles: "Aprobada", "Fondo"… */
  etiqueta: string;
}

export function SelectorColor({ valor, onChange, onCerrar, etiqueta }: Props) {
  const [hsv, setHsv] = useState<Hsv>(() => hexAHsv(valor));
  const [formato, setFormato] = useState<Formato>("hex");
  // Lo que el usuario está tipeando. Mientras escribe, el campo no se pisa
  // con el valor formateado: "f5" no es un color y no tiene por qué volverse
  // uno a mitad de camino.
  const [texto, setTexto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);

  // Si el color cambia desde afuera (restablecer, cambio de tema) la rueda lo
  // sigue, pero conservando el tono cuando el hexa no lo dice. Se ajusta
  // durante el render y no en un efecto: así no hay un paso intermedio en el
  // que la rueda muestre el color viejo.
  const [ultimo, setUltimo] = useState(valor);
  if (valor !== ultimo) {
    setUltimo(valor);
    if (hsvAHex(hsv) !== valor) {
      const nuevo = hexAHsv(valor);
      setHsv({ ...nuevo, h: nuevo.s === 0 ? hsv.h : nuevo.h });
    }
  }

  // Afuera o Escape cierran.
  useEffect(() => {
    const alClick = (evento: MouseEvent) => {
      if (!panel.current?.contains(evento.target as Node)) onCerrar();
    };
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        // Si no, el Escape sigue hasta la malla y deselecciona la materia.
        evento.stopPropagation();
        onCerrar();
      }
    };
    document.addEventListener("mousedown", alClick);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClick);
      document.removeEventListener("keydown", alTecla);
    };
  }, [onCerrar]);

  const aplicar = (siguiente: Hsv) => {
    setHsv(siguiente);
    setTexto(null);
    onChange(hsvAHex(siguiente));
  };

  /** Arrastre sobre el cuadrado o la barra, con el puntero capturado. */
  const arrastrar = (
    elemento: HTMLDivElement | null,
    evento: React.PointerEvent,
    desdePosicion: (x: number, y: number) => Hsv,
  ) => {
    if (!elemento) return;
    elemento.setPointerCapture(evento.pointerId);

    const mover = (cliente: { clientX: number; clientY: number }) => {
      const caja = elemento.getBoundingClientRect();
      aplicar(
        desdePosicion(
          limitar((cliente.clientX - caja.left) / caja.width, 0, 1),
          limitar((cliente.clientY - caja.top) / caja.height, 0, 1),
        ),
      );
    };

    mover(evento);
    const alMover = (e: PointerEvent) => mover(e);
    const alSoltar = () => {
      elemento.removeEventListener("pointermove", alMover);
      elemento.removeEventListener("pointerup", alSoltar);
      elemento.removeEventListener("pointercancel", alSoltar);
    };
    elemento.addEventListener("pointermove", alMover);
    elemento.addEventListener("pointerup", alSoltar);
    elemento.addEventListener("pointercancel", alSoltar);
  };

  const alTeclaArea = (evento: React.KeyboardEvent) => {
    const paso = evento.shiftKey ? PASO * 5 : PASO;
    const mapa: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: limitar(hsv.s - paso, 0, 1) },
      ArrowRight: { s: limitar(hsv.s + paso, 0, 1) },
      ArrowUp: { v: limitar(hsv.v + paso, 0, 1) },
      ArrowDown: { v: limitar(hsv.v - paso, 0, 1) },
    };
    const cambio = mapa[evento.key];
    if (!cambio) return;
    evento.preventDefault();
    aplicar({ ...hsv, ...cambio });
  };

  const alTeclaBarra = (evento: React.KeyboardEvent) => {
    const paso = evento.shiftKey ? PASO_TONO * 5 : PASO_TONO;
    if (evento.key === "ArrowLeft" || evento.key === "ArrowDown") {
      evento.preventDefault();
      aplicar({ ...hsv, h: (hsv.h - paso + 360) % 360 });
    } else if (evento.key === "ArrowRight" || evento.key === "ArrowUp") {
      evento.preventDefault();
      aplicar({ ...hsv, h: (hsv.h + paso) % 360 });
    }
  };

  const alEscribir = (entrada: string) => {
    setTexto(entrada);
    const hex = parsear(entrada);
    if (!hex) return;
    const nuevo = hexAHsv(hex);
    setHsv({ ...nuevo, h: nuevo.s === 0 ? hsv.h : nuevo.h });
    onChange(hex);
  };

  const copiar = () => {
    navigator.clipboard?.writeText(formatear(valor, formato)).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1200);
      },
      () => {
        /* sin portapapeles no hay nada que hacer */
      },
    );
  };

  const tono = hsvAHex({ h: hsv.h, s: 1, v: 1 });
  const porcentoS = Math.round(hsv.s * 100);
  const porcentoV = Math.round(hsv.v * 100);

  return (
    <div
      className="selector"
      ref={panel}
      role="group"
      aria-label={"Color de " + etiqueta}
    >
      <div
        className="selector__area"
        ref={area}
        style={{ backgroundColor: tono }}
        onPointerDown={(evento) =>
          arrastrar(area.current, evento, (x, y) => ({ ...hsv, s: x, v: 1 - y }))
        }
        onKeyDown={alTeclaArea}
        role="slider"
        tabIndex={0}
        aria-label="Saturación y brillo"
        aria-valuetext={"saturación " + porcentoS + "%, brillo " + porcentoV + "%"}
        aria-valuenow={porcentoV}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="selector__puntero"
          style={{
            left: porcentoS + "%",
            top: 100 - porcentoV + "%",
            backgroundColor: valor,
          }}
        />
      </div>

      <div
        className="selector__tono"
        ref={barra}
        onPointerDown={(evento) =>
          arrastrar(barra.current, evento, (x) => ({ ...hsv, h: x * 360 }))
        }
        onKeyDown={alTeclaBarra}
        role="slider"
        tabIndex={0}
        aria-label="Tono"
        aria-valuenow={Math.round(hsv.h)}
        aria-valuemin={0}
        aria-valuemax={360}
      >
        <span
          className="selector__puntero selector__puntero--tono"
          style={{ left: (hsv.h / 360) * 100 + "%", backgroundColor: tono }}
        />
      </div>

      <div className="selector__campos">
        <span className="selector__muestra" style={{ backgroundColor: valor }} />
        {formato === "hex" && <span className="selector__numeral">#</span>}
        <input
          className="selector__texto"
          value={texto ?? formatear(valor, formato)}
          onChange={(evento) => alEscribir(evento.target.value)}
          onBlur={() => setTexto(null)}
          spellCheck={false}
          autoComplete="off"
          aria-label={"Color de " + etiqueta + " en " + NOMBRE_FORMATO[formato]}
        />
        <button
          type="button"
          className="selector__copiar"
          onClick={copiar}
          aria-label="Copiar el color"
          title={copiado ? "Copiado" : "Copiar"}
        >
          {copiado ? "✓" : "⧉"}
        </button>
        <select
          className="selector__formato"
          value={formato}
          onChange={(evento) => {
            setTexto(null);
            setFormato(evento.target.value as Formato);
          }}
          aria-label="Formato del color"
        >
          {FORMATOS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {NOMBRE_FORMATO[opcion]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
