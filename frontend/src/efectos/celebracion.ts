/**
 * El festejo al aprobar una materia: confeti y un sonidito.
 *
 * Las dos cosas se hacen a mano, sin dependencias: el confeti es un canvas
 * encima de todo y el sonido son tres notas sintetizadas con Web Audio. Una
 * librería de confeti pesa más que esto, y un archivo de audio habría que
 * versionarlo y descargarlo.
 *
 * Nada de esto puede romper la app: si falla el canvas o el navegador no deja
 * sonar, la materia se marca igual.
 */

/** Cuántas partículas salen por festejo. */
const PARTICULAS = 90;
/** Cuánto vive cada una, en segundos. */
const VIDA = 1.9;
/** Aceleración hacia abajo, en px/s². */
const GRAVEDAD = 1400;
/** Rozamiento del aire por segundo: sin esto cruzan la pantalla de largo. */
const ROCE = 0.86;

/** Los colores salen del tema, así el festejo combina con la app. */
const VARIABLES_COLOR = [
  "--aprobada-borde",
  "--regular-borde",
  "--acento",
  "--peligro",
];
const COLORES_RESPALDO = ["#1f9254", "#d9a400", "#2a5bd7", "#c22f3d"];

export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  velocidadGiro: number;
  ancho: number;
  alto: number;
  color: string;
  vida: number;
}

/**
 * Dos chorros, uno desde cada costado, apuntando al centro y hacia arriba.
 *
 * Desde abajo se lee mejor que una lluvia desde arriba: sube, frena y cae,
 * que es lo que hace el confeti de verdad.
 */
export function crearParticulas(
  ancho: number,
  alto: number,
  colores: string[],
  azar: () => number = Math.random,
): Particula[] {
  const particulas: Particula[] = [];

  for (let i = 0; i < PARTICULAS; i += 1) {
    const desdeIzquierda = i % 2 === 0;
    // Hacia adentro y hacia arriba, con bastante dispersión.
    const angulo = (desdeIzquierda ? -60 : -120) + (azar() - 0.5) * 55;
    const radianes = (angulo * Math.PI) / 180;
    const rapidez = 900 + azar() * 700;

    particulas.push({
      x: desdeIzquierda ? 0 : ancho,
      y: alto * (0.78 + azar() * 0.12),
      // El ángulo ya apunta hacia adentro en los dos casos: -60° va arriba y
      // a la derecha, -120° arriba y a la izquierda.
      vx: Math.cos(radianes) * rapidez,
      vy: Math.sin(radianes) * rapidez,
      giro: azar() * Math.PI * 2,
      velocidadGiro: (azar() - 0.5) * 18,
      ancho: 6 + azar() * 5,
      alto: 3 + azar() * 6,
      color: colores[Math.floor(azar() * colores.length)] ?? COLORES_RESPALDO[0]!,
      vida: VIDA * (0.7 + azar() * 0.3),
    });
  }

  return particulas;
}

/** Mueve una partícula `dt` segundos. Devuelve `false` cuando ya murió. */
export function avanzar(particula: Particula, dt: number): boolean {
  particula.vida -= dt;
  if (particula.vida <= 0) return false;

  const frenado = ROCE ** dt;
  particula.vx *= frenado;
  particula.vy = particula.vy * frenado + GRAVEDAD * dt;
  particula.x += particula.vx * dt;
  particula.y += particula.vy * dt;
  particula.giro += particula.velocidadGiro * dt;

  return true;
}

/** Lo que queda de vida, de 1 a 0, para desvanecerlas al final. */
export function opacidad(particula: Particula): number {
  return Math.min(1, Math.max(0, particula.vida / 0.45));
}

function colores(): string[] {
  if (typeof document === "undefined") return COLORES_RESPALDO;
  const estilo = getComputedStyle(document.documentElement);
  const leidos = VARIABLES_COLOR.map((variable) =>
    estilo.getPropertyValue(variable).trim(),
  ).filter(Boolean);
  return leidos.length > 0 ? leidos : COLORES_RESPALDO;
}

// --- el canvas ---
//
// Hay uno solo y se reusa: aprobar dos materias seguidas agrega partículas al
// mismo lienzo en vez de apilar canvas encima de canvas.

let lienzo: HTMLCanvasElement | null = null;
let vivas: Particula[] = [];
let cuadro: number | null = null;

function preparar(): CanvasRenderingContext2D | null {
  if (!lienzo) {
    lienzo = document.createElement("canvas");
    lienzo.className = "confeti";
    lienzo.setAttribute("aria-hidden", "true");
    document.body.appendChild(lienzo);
  }

  const densidad = window.devicePixelRatio || 1;
  lienzo.width = window.innerWidth * densidad;
  lienzo.height = window.innerHeight * densidad;

  const contexto = lienzo.getContext("2d");
  if (!contexto) return null;
  contexto.setTransform(densidad, 0, 0, densidad, 0, 0);
  return contexto;
}

function limpiar() {
  if (cuadro !== null) cancelAnimationFrame(cuadro);
  cuadro = null;
  vivas = [];
  lienzo?.remove();
  lienzo = null;
}

function animar(contexto: CanvasRenderingContext2D, anterior: number) {
  cuadro = requestAnimationFrame((ahora) => {
    // Con la pestaña en segundo plano el salto puede ser enorme; se acota
    // para que no teletransporte todo fuera de la pantalla.
    const dt = Math.min((ahora - anterior) / 1000, 0.05);

    contexto.clearRect(0, 0, window.innerWidth, window.innerHeight);
    vivas = vivas.filter((particula) => avanzar(particula, dt));

    for (const particula of vivas) {
      contexto.save();
      contexto.globalAlpha = opacidad(particula);
      contexto.translate(particula.x, particula.y);
      contexto.rotate(particula.giro);
      contexto.fillStyle = particula.color;
      contexto.fillRect(
        -particula.ancho / 2,
        -particula.alto / 2,
        particula.ancho,
        particula.alto,
      );
      contexto.restore();
    }

    if (vivas.length === 0) limpiar();
    else animar(contexto, ahora);
  });
}

function confeti() {
  // Con "menos movimiento" activado, el confeti es justo lo que molesta. El
  // sonido queda, que es el festejo sin la animación.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const contexto = preparar();
  if (!contexto) return;

  vivas = vivas.concat(
    crearParticulas(window.innerWidth, window.innerHeight, colores()),
  );
  if (cuadro === null) animar(contexto, performance.now());
}

// --- el sonido ---

let audio: AudioContext | null = null;

/** Un arpegio corto y agudo: do–mi–sol, en hercios. */
const NOTAS = [523.25, 659.25, 783.99];

function sonido() {
  try {
    const Contexto =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Contexto) return;

    // Se crea al primer festejo y se reusa: un contexto por sonido deja al
    // navegador sin recursos enseguida.
    audio ??= new Contexto();
    // Si el navegador lo suspendió —pasa cuando se crea antes de que el
    // usuario toque nada—, el click que lo trajo acá alcanza para reanudarlo.
    if (audio.state === "suspended") void audio.resume();

    const inicio = audio.currentTime;
    NOTAS.forEach((frecuencia, indice) => {
      if (!audio) return;
      const desde = inicio + indice * 0.075;
      const hasta = desde + 0.28;

      const oscilador = audio.createOscillator();
      oscilador.type = "triangle";
      oscilador.frequency.value = frecuencia;

      const volumen = audio.createGain();
      // Ataque corto y caída suave: una campanita, no un bip.
      volumen.gain.setValueAtTime(0, desde);
      volumen.gain.linearRampToValueAtTime(0.09, desde + 0.012);
      volumen.gain.exponentialRampToValueAtTime(0.0001, hasta);

      oscilador.connect(volumen).connect(audio.destination);
      oscilador.start(desde);
      oscilador.stop(hasta);
    });
  } catch {
    // Sin audio no pasa nada: la materia ya quedó aprobada.
  }
}

/** Festeja una materia aprobada. No hace nada fuera del navegador. */
export function celebrar(): void {
  if (typeof document === "undefined") return;
  try {
    confeti();
  } catch {
    limpiar();
  }
  sonido();
}
