/**
 * La malla: el plan de estudios como un grafo.
 *
 * Los nodos son materias, las aristas van de una correlativa a la materia que
 * destraba. Las posiciones se calculan en `layout.ts` a partir del plan.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useMalla } from "../../store/useMalla";
import { useEsAngosto } from "../../hooks/useEsAngosto";
import { AnioNode, type NodoAnio } from "./AnioNode";
import { MateriaNode, type DatosMateria, type NodoMateria } from "./MateriaNode";
import {
  ALTO_NODO_ANIO,
  ANCHO_NODO,
  altoDeMateria,
  calcularUbicaciones,
} from "./layout";
import "./Malla.css";

const TIPOS_DE_NODO = { materia: MateriaNode, anio: AnioNode };

// `minZoom` evita que en una ventana chica la malla entre entera pero
// ilegible: por debajo de eso se recorta y el usuario la recorre.
const ENCUADRE = { padding: 0.15, maxZoom: 1, minZoom: 0.5 };
/** Margen al encuadrar por ancho, en píxeles de pantalla. */
const MARGEN_APILADO = 16;

/** Color de cada materia en el minimapa, según su estado. */
function colorEnMinimapa(nodo: Node): string {
  if (nodo.type !== "materia") return "var(--superficie-2)";
  const estado = (nodo.data as DatosMateria).estado;
  if (estado === "aprobada") return "var(--aprobada-borde)";
  if (estado === "regular") return "var(--regular-borde)";
  return "var(--sin-estado-borde)";
}

export function Malla() {
  const plan = useMalla((s) => s.plan);
  const estados = useMalla((s) => s.estados);
  const seleccionada = useMalla((s) => s.seleccionada);
  const seleccionar = useMalla((s) => s.seleccionar);
  const esAngosto = useEsAngosto();

  const instancia = useRef<ReactFlowInstance | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  // Si el usuario movió la vista a mano, no se la reacomodamos al redimensionar.
  const usuarioMovio = useRef(false);

  const { nodos, aristas } = useMemo(() => {
    if (!plan) return { nodos: [] as Node[], aristas: [] as Edge[] };

    const ubicaciones = calcularUbicaciones(
      plan,
      esAngosto ? "apilado" : "columnas",
    );

    const nodosAnio: NodoAnio[] = [...plan.anios.values()].map((anio) => ({
      id: `anio-${anio.id_anio}`,
      type: "anio",
      position: ubicaciones.anios.get(anio.id_anio) ?? { x: 0, y: 0 },
      data: { numero: anio.numero, creditosRequeridos: anio.creditos_requeridos },
      // Explícitas para que React Flow no tenga que medirlas: sin esto el
      // minimapa no dibuja los nodos.
      width: ANCHO_NODO,
      height: ALTO_NODO_ANIO,
      draggable: false,
      selectable: false,
      focusable: false,
    }));

    const nodosMateria: NodoMateria[] = [...plan.materias.values()].map(
      (materia) => ({
        id: String(materia.id_materia),
        type: "materia",
        position: ubicaciones.materias.get(materia.id_materia) ?? { x: 0, y: 0 },
        selected: seleccionada === materia.id_materia,
        width: ANCHO_NODO,
        // Explícita y calculada: React Flow necesita el alto antes de
        // pintar, y cada tarjeta mide según su nombre.
        height: altoDeMateria(materia.nombre),
        data: {
          idMateria: materia.id_materia,
          codigo: materia.codigo,
          nombre: materia.nombre,
          creditos: materia.creditos,
          estado: estados[materia.id_materia],
        },
      }),
    );

    const aristas: Edge[] = [];
    for (const materia of plan.materias.values()) {
      for (const idRequisito of materia.correlativas) {
        const requisitoAprobado = estados[idRequisito] === "aprobada";
        const tocaSeleccionada =
          seleccionada === materia.id_materia || seleccionada === idRequisito;

        aristas.push({
          id: `${idRequisito}->${materia.id_materia}`,
          source: String(idRequisito),
          target: String(materia.id_materia),
          className: [
            "arista",
            requisitoAprobado ? "arista--cumplida" : "",
            tocaSeleccionada ? "arista--activa" : "",
          ]
            .filter(Boolean)
            .join(" "),
          animated: tocaSeleccionada && !requisitoAprobado,
        });
      }
    }

    return { nodos: [...nodosAnio, ...nodosMateria], aristas };
  }, [plan, estados, seleccionada, esAngosto]);

  const alClickNodo: NodeMouseHandler = useCallback(
    (_evento, nodo) => {
      if (nodo.type !== "materia") return;
      const id = Number(nodo.id);
      seleccionar(seleccionada === id ? null : id);
    },
    [seleccionada, seleccionar],
  );

  const alClickFondo = useCallback(() => seleccionar(null), [seleccionar]);

  // Escape cierra el menú de acciones.
  useEffect(() => {
    if (seleccionada === null) return;
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") seleccionar(null);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [seleccionada, seleccionar]);

  /**
   * Encuadra la malla.
   *
   * En escritorio entra entera. En el teléfono no: la columna es muy alta y
   * hacerla entrar dejaría los nodos ilegibles, así que se ajusta al ancho y
   * se arranca arriba de todo, para recorrerla scrolleando.
   */
  const encuadrar = useCallback(() => {
    const api = instancia.current;
    const elemento = contenedor.current;
    if (!api || !elemento) return;
    // El contenedor puede medir 0 si todavía no se pintó (pestaña en segundo
    // plano, por ejemplo). Encuadrar con eso da un zoom sin sentido.
    if (elemento.clientWidth === 0) return;

    if (!esAngosto) {
      api.fitView(ENCUADRE);
      return;
    }

    const disponible = elemento.clientWidth - MARGEN_APILADO * 2;
    const zoom = Math.min(1, disponible / ANCHO_NODO);
    api.setViewport({ x: MARGEN_APILADO, y: MARGEN_APILADO, zoom });
  }, [esAngosto]);

  // Al cambiar de carrera (o de orientación) la malla es otra: se reencuadra.
  useEffect(() => {
    usuarioMovio.current = false;
    encuadrar();
  }, [plan, encuadrar]);

  // El contenedor puede cambiar de tamaño sin que cambie la ventana (por
  // ejemplo si se abre un panel al costado), así que se observa el div.
  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;

    const observador = new ResizeObserver(([entrada]) => {
      if (!entrada || entrada.contentRect.width === 0) return;
      if (usuarioMovio.current) return;
      encuadrar();
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [encuadrar]);

  if (!plan) return null;

  return (
    <div className="malla" ref={contenedor}>
      <ReactFlow
        nodes={nodos}
        edges={aristas}
        nodeTypes={TIPOS_DE_NODO}
        onNodeClick={alClickNodo}
        onPaneClick={alClickFondo}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elevateNodesOnSelect
        onInit={(api) => {
          instancia.current = api;
          encuadrar();
        }}
        onMoveStart={(evento) => {
          // `evento` es null cuando el movimiento lo hicimos nosotros.
          if (evento) usuarioMovio.current = true;
        }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        {!esAngosto && (
          <MiniMap
            pannable
            zoomable
            nodeColor={colorEnMinimapa}
            nodeStrokeWidth={3}
            className="malla__minimapa"
          />
        )}
      </ReactFlow>
    </div>
  );
}
