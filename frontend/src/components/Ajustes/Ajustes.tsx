/**
 * El panel de ajustes: la carrera, el aspecto y el respaldo de los datos.
 *
 * Reemplaza a la vieja lista de referencias y la incluye: cada fila muestra
 * la misma muestra de color que antes, pero ahora se puede cambiar.
 *
 * Las muestras no dibujan el color guardado sino el que se está viendo: si la
 * preferencia es "el del tema", se lee del `:root` con `getComputedStyle`. Es
 * la única forma de que el selector abra en el color correcto sin duplicar
 * acá la paleta de `index.css`, que además cambia con el tema.
 */

import { useState } from "react";

import { useOscuroDelSistema } from "../../hooks/useOscuroDelSistema";
import {
  CLAVES_COLOR,
  type ClaveColor,
  type Tema,
} from "../../storage/preferencias";
import { useMalla } from "../../store/useMalla";
import { usePreferencias } from "../../store/usePreferencias";
import { IconoVolver } from "../Sidebar/iconos";
import { Respaldo } from "./Respaldo";
import { SelectorColor } from "./SelectorColor";
import "./Ajustes.css";

const TEMAS: { valor: Tema; etiqueta: string }[] = [
  { valor: "auto", etiqueta: "Sistema" },
  { valor: "claro", etiqueta: "Claro" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

const ETIQUETAS: Record<ClaveColor, string> = {
  aprobada: "Aprobada",
  regular: "Regular",
  cursando: "Cursando",
  disponible: "Disponible",
  sinCreditos: "Créditos insuficientes",
};

/** La variable de borde de cada referencia: es el color que se elige. */
const VARIABLE: Record<ClaveColor, string> = {
  aprobada: "--aprobada-borde",
  regular: "--regular-borde",
  cursando: "--cursando-borde",
  disponible: "--sin-estado-borde",
  sinCreditos: "--bloqueada-borde",
};

/**
 * Si `getComputedStyle` no sirve (sin DOM, o el token no es un `#rrggbb`), al
 * menos el selector abre en algo razonable.
 */
const RESPALDO = "#808080";

const HEXA = /^#[0-9a-f]{6}$/i;

function colorDelTema(variable: string): string {
  if (typeof document === "undefined") return RESPALDO;
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return HEXA.test(valor) ? valor.toLowerCase() : RESPALDO;
}

/** Cuál de los selectores está abierto. Nunca más de uno a la vez. */
type Abierto = ClaveColor | "fondo" | "enlaces" | null;

interface Props {
  alVolver: () => void;
}

export function Ajustes({ alVolver }: Props) {
  const tema = usePreferencias((s) => s.tema);
  const mostrarEnlaces = usePreferencias((s) => s.mostrarEnlaces);
  const ocultarEnlacesAprobados = usePreferencias(
    (s) => s.ocultarEnlacesAprobados,
  );
  const fondo = usePreferencias((s) => s.fondo);
  const colorEnlaces = usePreferencias((s) => s.colorEnlaces);
  const colores = usePreferencias((s) => s.colores);
  const festejar = usePreferencias((s) => s.festejar);
  const cambiarTema = usePreferencias((s) => s.cambiarTema);
  const cambiarEnlaces = usePreferencias((s) => s.cambiarEnlaces);
  const cambiarEnlacesAprobados = usePreferencias(
    (s) => s.cambiarEnlacesAprobados,
  );
  const cambiarFondo = usePreferencias((s) => s.cambiarFondo);
  const cambiarColorEnlaces = usePreferencias((s) => s.cambiarColorEnlaces);
  const cambiarColor = usePreferencias((s) => s.cambiarColor);
  const cambiarFestejo = usePreferencias((s) => s.cambiarFestejo);
  const restablecer = usePreferencias((s) => s.restablecer);

  const carreras = useMalla((s) => s.carreras);
  const idCarrera = useMalla((s) => s.idCarrera);
  const seleccionarCarrera = useMalla((s) => s.seleccionarCarrera);

  const [abierto, setAbierto] = useState<Abierto>(null);

  // Los colores del tema se vuelven a leer en cada render, que son pocos: uno
  // por cambio de preferencia y uno cuando el sistema cambia de claro a
  // oscuro, que es justo lo que los mueve.
  useOscuroDelSistema();

  const sinCambios =
    tema === "auto" &&
    mostrarEnlaces &&
    !ocultarEnlacesAprobados &&
    festejar &&
    fondo === null &&
    colorEnlaces === null &&
    CLAVES_COLOR.every((clave) => colores[clave] === null);

  const filas: {
    clave: Exclude<Abierto, null>;
    etiqueta: string;
    valor: string | null;
    variable: string;
    cambiar: (color: string | null) => void;
  }[] = [
    {
      clave: "fondo",
      etiqueta: "Fondo",
      valor: fondo,
      variable: "--fondo",
      cambiar: cambiarFondo,
    },
    {
      clave: "enlaces",
      etiqueta: "Enlaces",
      valor: colorEnlaces,
      variable: "--arista",
      cambiar: cambiarColorEnlaces,
    },
    ...CLAVES_COLOR.map((clave) => ({
      clave,
      etiqueta: ETIQUETAS[clave],
      valor: colores[clave],
      variable: VARIABLE[clave],
      cambiar: (color: string | null) => cambiarColor(clave, color),
    })),
  ];

  return (
    <div className="personalizar">
      <header className="personalizar__cabecera">
        <button
          type="button"
          className="personalizar__volver"
          onClick={alVolver}
          aria-label="Volver al panel"
        >
          <IconoVolver />
        </button>
        <h2>Ajustes</h2>
      </header>

      {carreras.length > 1 && (
        <section className="personalizar__grupo">
          <h3 id="ajustes-carrera">Carrera</h3>
          <select
            className="ajustes__carrera"
            aria-labelledby="ajustes-carrera"
            value={idCarrera ?? ""}
            onChange={(evento) => {
              void seleccionarCarrera(Number(evento.target.value));
            }}
          >
            {carreras.map((carrera) => (
              <option key={carrera.id_carrera} value={carrera.id_carrera}>
                {carrera.nombre}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className="personalizar__grupo">
        <h3 id="personalizar-tema">Tema</h3>
        <div
          className="segmentado"
          role="group"
          aria-labelledby="personalizar-tema"
        >
          {TEMAS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              className="segmentado__opcion"
              aria-pressed={tema === opcion.valor}
              onClick={() => cambiarTema(opcion.valor)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section className="personalizar__grupo">
        <h3>Malla</h3>
        <label className="interruptor">
          <input
            type="checkbox"
            checked={mostrarEnlaces}
            onChange={(evento) => cambiarEnlaces(evento.target.checked)}
          />
          <span>Mostrar los enlaces entre materias</span>
        </label>

        {/* Sin enlaces no hay nada que esconder, así que la opción se
            deshabilita en vez de desaparecer: si desapareciera, destildar la
            de arriba movería la lista. */}
        <label className="interruptor interruptor--hijo">
          <input
            type="checkbox"
            checked={ocultarEnlacesAprobados}
            disabled={!mostrarEnlaces}
            onChange={(evento) => cambiarEnlacesAprobados(evento.target.checked)}
          />
          <span>Ocultar los que unen dos materias aprobadas</span>
        </label>

        <label className="interruptor">
          <input
            type="checkbox"
            checked={festejar}
            onChange={(evento) => cambiarFestejo(evento.target.checked)}
          />
          <span>Festejar al aprobar, con confeti y sonido</span>
        </label>
      </section>

      <section className="personalizar__grupo">
        <h3>Colores</h3>
        <ul className="colores">
          {filas.map((fila) => {
            const visible = fila.valor ?? colorDelTema(fila.variable);
            const esteAbierto = abierto === fila.clave;

            return (
              <li className="colores__fila" key={fila.clave}>
                <button
                  type="button"
                  className="colores__muestra"
                  style={{ backgroundColor: visible }}
                  onClick={() => setAbierto(esteAbierto ? null : fila.clave)}
                  aria-expanded={esteAbierto}
                  aria-label={"Cambiar el color de " + fila.etiqueta}
                />
                <button
                  type="button"
                  className="colores__nombre"
                  onClick={() => setAbierto(esteAbierto ? null : fila.clave)}
                  aria-expanded={esteAbierto}
                >
                  {fila.etiqueta}
                </button>

                {fila.valor !== null && (
                  <button
                    type="button"
                    className="colores__restablecer"
                    onClick={() => fila.cambiar(null)}
                    title="Volver al color del tema"
                    aria-label={
                      "Volver " + fila.etiqueta + " al color del tema"
                    }
                  >
                    ↺
                  </button>
                )}

                {esteAbierto && (
                  <SelectorColor
                    valor={visible}
                    etiqueta={fila.etiqueta}
                    onChange={fila.cambiar}
                    onCerrar={() => setAbierto(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Respaldo />

      <footer className="personalizar__pie">
        <button
          type="button"
          className="boton"
          onClick={restablecer}
          disabled={sinCambios}
        >
          Restablecer el aspecto
        </button>
      </footer>
    </div>
  );
}
