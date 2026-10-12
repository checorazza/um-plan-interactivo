/**
 * La malla: el plan de estudios como un grafo.
 *
 * Los nodos son materias, las aristas van de una correlativa a la materia que
 * destraba. Las posiciones se calculan en `layout.ts` a partir del plan.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import {
  estadoDeBloqueo,
  puedeAprobar,
  puedeRegularizar,
} from "../../domain/reglas";
import "@xyflow/react/dist/style.css";

import { useMalla } from "../../store/useMalla";
import { usePreferencias } from "../../store/usePreferencias";
import { useEsAngosto } from "../../hooks/useEsAngosto";
import { AnioNode, type NodoAnio } from "./AnioNode";
import {
  ConfirmacionDesbloqueo,
  type Desbloqueo,
} from "./ConfirmacionDesbloqueo";
import { MenuMateria, type Posicion } from "./MenuMateria";
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
// ilegible: por debajo de eso se recorta y el usuario la recorre con el dedo
// o con el mouse. Es lo que hace que el teléfono no necesite otro acomodo.
const ENCUADRE = { padding: 0.15, maxZoom: 1, minZoom: 0.5 };

/** Estable, para no rearmar las aristas cada vez que se ocultan. */
const SIN_ARISTAS: Edge[] = [];

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
  const desbloqueadas = useMalla((s) => s.desbloqueadas);
  const desbloquear = useMalla((s) => s.desbloquear);
  const esAngosto = useEsAngosto();
  const mostrarEnlaces = usePreferencias((s) => s.mostrarEnlaces);
  const ocultarEnlacesAprobados = usePreferencias(
    (s) => s.ocultarEnlacesAprobados,
  );

  // El menú del click derecho y el diálogo que puede abrir. Viven acá y no
  // en el store: no los necesita nadie más, y se pierden al cambiar de
  // carrera, que es lo correcto.
  const [menu, setMenu] = useState<Posicion | null>(null);
  const [desbloqueo, setDesbloqueo] = useState<Desbloqueo | null>(null);

  const instancia = useRef<ReactFlowInstance | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  // Si el usuario movió la vista a mano, no se la reacomodamos al redimensionar.
  const usuarioMovio = useRef(false);

  const { nodos, aristas } = useMemo(() => {
    if (!plan) return { nodos: [] as Node[], aristas: [] as Edge[] };

    const ubicaciones = calcularUbicaciones(plan);

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
          desbloqueada: desbloqueadas.has(materia.id_materia),
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

        // Las dos aprobadas: el enlace ya no dice nada que no digan las
        // tarjetas, y son los que más ensucian a medida que la malla avanza.
        if (
          ocultarEnlacesAprobados &&
          requisitoAprobado &&
          estados[materia.id_materia] === "aprobada"
        ) {
          continue;
        }

        const tocaSeleccionada =
          seleccionada === materia.id_materia || seleccionada === idRequisito;

        aristas.push({
          id: `${idRequisito}->${materia.id_materia}`,
          source: String(idRequisito),
          target: String(materia.id_materia),
          // El color de la arista no depende del estado de la materia: lo
          // elige el usuario y no se mueve. Sólo se resalta la que toca a la
          // materia seleccionada.
          className: ["arista", tocaSeleccionada ? "arista--activa" : ""]
            .filter(Boolean)
            .join(" "),
          animated: tocaSeleccionada && !requisitoAprobado,
        });
      }
    }

    return { nodos: [...nodosAnio, ...nodosMateria], aristas };
  }, [plan, estados, seleccionada, desbloqueadas, ocultarEnlacesAprobados]);

  const alClickNodo: NodeMouseHandler = useCallback(
    (_evento, nodo) => {
      if (nodo.type !== "materia") return;
      const id = Number(nodo.id);
      seleccionar(seleccionada === id ? null : id);
    },
    [seleccionada, seleccionar],
  );

  const alClickFondo = useCallback(() => seleccionar(null), [seleccionar]);

  /**
   * Click derecho sobre un nodo.
   *
   * El menú sólo tiene sentido sobre una materia bloqueada y sin marcar: si
   * ya se puede marcar, no hay nada que desbloquear, y si ya está marcada el
   * camino es el menú de acciones del click común.
   */
  const alClickDerechoNodo: NodeMouseHandler = useCallback(
    (evento, nodo) => {
      if (!plan || nodo.type !== "materia") return;

      const idMateria = Number(nodo.id);
      if (estados[idMateria]) return;
      if (desbloqueadas.has(idMateria)) return;

      const bloqueo = estadoDeBloqueo(plan, estados, idMateria, desbloqueadas);
      if (bloqueo === "disponible") return;

      setMenu({
        idMateria,
        nombre: plan.materias.get(idMateria)?.nombre ?? `#${idMateria}`,
        x: evento.clientX,
        y: evento.clientY,
      });
    },
    [plan, estados, desbloqueadas],
  );

  const abrirDesbloqueo = useCallback(() => {
    if (!plan || !menu) return;
    const bloqueo = estadoDeBloqueo(plan, estados, menu.idMateria, desbloqueadas);
    // El motivo del bloqueo duro es el de créditos; el blando, el de la
    // correlativa que falta, que es lo que devuelve `puedeAprobar`.
    const motivo =
      bloqueo === "bloqueada_por_creditos"
        ? puedeRegularizar(plan, estados, menu.idMateria, desbloqueadas).motivo
        : puedeAprobar(plan, estados, menu.idMateria, desbloqueadas).motivo;

    setDesbloqueo({
      idMateria: menu.idMateria,
      nombre: menu.nombre,
      bloqueo,
      motivo,
    });
  }, [plan, estados, desbloqueadas, menu]);

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
   * Encuadra la malla entera, en cualquier pantalla.
   *
   * En el teléfono no entra a un zoom legible, y está bien: `minZoom` la deja
   * recortada y se recorre arrastrando con el dedo, en cualquier dirección.
   * Antes había un encuadre aparte que la ajustaba al ancho y arrancaba
   * arriba de todo, pensado para una malla apilada en una sola columna.
   */
  const encuadrar = useCallback(() => {
    const api = instancia.current;
    const elemento = contenedor.current;
    if (!api || !elemento) return;
    // El contenedor puede medir 0 si todavía no se pintó (pestaña en segundo
    // plano, por ejemplo). Encuadrar con eso da un zoom sin sentido.
    if (elemento.clientWidth === 0) return;

    api.fitView(ENCUADRE);
  }, []);

  // Al cambiar de carrera la malla es otra: se reencuadra.
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
    <div
      className="malla"
      ref={contenedor}
      // El menú del navegador no sirve para nada acá y tapa el propio.
      onContextMenu={(evento) => evento.preventDefault()}
    >
      <ReactFlow
        nodes={nodos}
        edges={mostrarEnlaces ? aristas : SIN_ARISTAS}
        nodeTypes={TIPOS_DE_NODO}
        onNodeClick={alClickNodo}
        onNodeContextMenu={alClickDerechoNodo}
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
        {/* El minimapa es lo único que cambia con el tamaño: en un teléfono
            taparía un cuarto de la malla, y para recorrerla ya está el
            dedo. */}
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

      {menu && (
        <MenuMateria
          menu={menu}
          onDesbloquear={abrirDesbloqueo}
          onCerrar={() => setMenu(null)}
        />
      )}

      {desbloqueo && (
        <ConfirmacionDesbloqueo
          desbloqueo={desbloqueo}
          onElegir={(estado) => {
            desbloquear(desbloqueo.idMateria, estado);
            setDesbloqueo(null);
          }}
          onCancelar={() => setDesbloqueo(null)}
        />
      )}
    </div>
  );
}
