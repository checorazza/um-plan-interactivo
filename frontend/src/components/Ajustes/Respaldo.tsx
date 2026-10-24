/**
 * Exportar e importar el progreso.
 *
 * Importar pisa todo, así que no se aplica de una: primero se lee el
 * archivo, se muestra qué trae y recién con la confirmación se escribe. Un
 * archivo equivocado aplicado sin aviso es de las pocas cosas de esta app
 * que no se pueden deshacer.
 */

import { useRef, useState } from "react";

import {
  type Lectura,
  armarRespaldo,
  aplicarRespaldo,
  leerRespaldo,
  nombreDeArchivo,
} from "../../storage/respaldo";
import { useGraficos } from "../../store/useGraficos";
import { useMalla } from "../../store/useMalla";
import { usePreferencias } from "../../store/usePreferencias";

export function Respaldo() {
  const paraExportar = useMalla((s) => s.paraExportar);
  const importar = useMalla((s) => s.importar);
  const reemplazarPreferencias = usePreferencias((s) => s.reemplazar);
  const recargarGraficos = useGraficos((s) => s.recargar);

  const archivo = useRef<HTMLInputElement>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [listo, setListo] = useState(false);

  const exportar = () => {
    const respaldo = armarRespaldo(paraExportar());
    const blob = new Blob([JSON.stringify(respaldo, null, 2)], {
      type: "application/json",
    });

    // La descarga se dispara con un enlace de mentira: no hay otra forma de
    // darle un nombre al archivo.
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreDeArchivo();
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const alElegirArchivo = async (archivos: FileList | null) => {
    const elegido = archivos?.[0];
    if (!elegido) return;
    setListo(false);
    try {
      setLectura(leerRespaldo(await elegido.text()));
    } catch {
      setLectura({ ok: false, motivo: "No se pudo leer el archivo." });
    }
  };

  const confirmar = () => {
    if (!lectura?.ok) return;

    // Primero el storage, de una sola vez, y después los stores: si no, cada
    // uno iría escribiendo encima de lo que escribió el anterior.
    aplicarRespaldo(lectura);
    importar();
    if (lectura.preferencias) reemplazarPreferencias(lectura.preferencias);
    if (lectura.graficos) recargarGraficos();

    setLectura(null);
    setListo(true);
  };

  return (
    <section className="personalizar__grupo">
      <h3>Tus datos</h3>

      <div className="respaldo__botones">
        <button type="button" className="boton" onClick={exportar}>
          Exportar
        </button>
        <button
          type="button"
          className="boton"
          onClick={() => archivo.current?.click()}
        >
          Importar
        </button>
      </div>

      <input
        ref={archivo}
        type="file"
        accept="application/json,.json"
        className="visualmente-oculto"
        onChange={(evento) => {
          void alElegirArchivo(evento.target.files);
          // Se limpia para que elegir el mismo archivo otra vez vuelva a
          // disparar el `change`.
          evento.target.value = "";
        }}
      />

      {lectura && !lectura.ok && (
        <p className="respaldo__error" role="alert">
          {lectura.motivo}
        </p>
      )}

      {lectura?.ok && (
        <div className="respaldo__confirmar" role="alert">
          <p>
            El archivo trae <strong>{lectura.resumen.aprobadas}</strong>{" "}
            aprobadas y <strong>{lectura.resumen.regulares}</strong> regulares
            {lectura.resumen.desbloqueadas > 0 &&
              `, ${lectura.resumen.desbloqueadas} desbloqueadas a mano`}
            {lectura.resumen.fechas > 0 && `, ${lectura.resumen.fechas} fechas`}
            {lectura.resumen.preferencias && ", tus colores"}
            {lectura.resumen.graficos > 0 &&
              ` y ${lectura.resumen.graficos} ${
                lectura.resumen.graficos === 1 ? "gráfico" : "gráficos"
              }`}
            . <strong>Reemplaza lo que tengas ahora.</strong>
          </p>
          <div className="respaldo__botones">
            <button
              type="button"
              className="boton"
              onClick={() => setLectura(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="boton boton--primario"
              onClick={confirmar}
            >
              Importar
            </button>
          </div>
        </div>
      )}

      {listo && <p className="respaldo__listo">Progreso importado.</p>}

      <p className="respaldo__nota">
        El archivo lleva las materias marcadas, las desbloqueadas a mano, las
        fechas, los colores y los gráficos del tablero.
      </p>
    </section>
  );
}
