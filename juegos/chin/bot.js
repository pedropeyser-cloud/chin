// Rival de práctica para CHIN. Sin reloj propio: decide mirando `ahora` y el estado,
// y la misma situación da la misma decisión (azar reproducible a partir de la semilla de la partida).
// Tiene tiempo de reacción humano y variable, ritmo propio para tirar y reponer cartas, y a veces no ve el CHIN.
// Nunca canta CHIN sin pareja: el juego no lo deja.

import { acciones, numero } from "./motor.js";

// reaccion: ms para ver el CHIN · ritmo: ms entre una carta y la siguiente · mira: ms que tarda en leer una carta nueva
// distraido: chance de no ver el CHIN a tiempo · apunta: chance de armar el CHIN a propósito cuando puede
export const DIFICULTADES = {
  tranquilo:  { reaccion: [850, 1500], ritmo: [900, 1500], mira: [500, 800], repone: [700, 1100], traba: [900, 1600], distraido: 0.12, apunta: 0.3 },
  rapido:     { reaccion: [480, 850],  ritmo: [550, 900],  mira: [300, 500], repone: [420, 700],  traba: [550, 950],  distraido: 0.06, apunta: 0.65 },
  implacable: { reaccion: [290, 440],  ritmo: [340, 560],  mira: [200, 320], repone: [260, 420],  traba: [320, 520],  distraido: 0.02, apunta: 0.95 }
};

function hash(...partes) {
  const txt = partes.join("|");
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const entre = ([a, b], u) => a + (b - a) * u;
const tope = (p) => (p.length ? p[p.length - 1] : null);

/**
 * Qué hace el bot `jugador` en `ahora`: una acción válida o `null` si todavía no le toca.
 * `estado` es el estado completo (la pantalla del bot vive en el anfitrión).
 */
export function bot(estado, jugador, ahora, dificultad = "rapido") {
  const d = DIFICULTADES[dificultad] || DIFICULTADES.rapido;
  const s = estado;
  if (s.fase !== "jugando" || ahora < s.arranca) return null;
  const clave = [s.semilla, jugador, dificultad];

  // 1) CHIN: cuando pasó su tiempo de reacción desde que la pareja apareció (salvo que no la haya visto)
  const c = s.coincidencia;
  if (c) {
    const distraido = hash(...clave, "ve", c.id) < d.distraido;
    const base = entre(d.reaccion, hash(...clave, "rx", c.id));
    const demora = distraido ? base * 2.6 + 700 : base;
    return ahora - c.t >= demora ? { t: "chin", visto: c.id } : null;
  }
  if (s.finPendiente) return null;

  // trabados: toca su mazo marcado después de darse cuenta
  if (s.trabado) {
    if (s.trabado.listos[jugador]) return null;
    return ahora - s.trabado.desde >= entre(d.traba, hash(...clave, "tb", s.seq)) ? { t: "destrabar" } : null;
  }

  // 2) ritmo propio entre una carta y la siguiente, y un rato para leer la mesa cuando cambia lo de arriba
  const n = s.jugadas[jugador];
  if (ahora - s.ultimaT[jugador] < entre(d.ritmo, hash(...clave, "rt", n))) return null;
  const cambio = Math.max(s.arranca, s.ultimaT[1 - jugador]);
  if (ahora - cambio < entre(d.mira, hash(...clave, "mi", s.seq))) return null;

  const todas = acciones(s, jugador, ahora);
  const posibles = todas.filter((a) => a.t === "poner");
  const huecos = todas.filter((a) => a.t === "reponer");
  const juntar = todas.filter((a) => a.t === "juntar");
  if (!posibles.length) {
    // nada para tirar: arrastra una del mazo a un hueco de la fila (lleva su tiempo);
    // sin huecos, apila dos del mismo número para hacer lugar
    if (ahora - s.ultimaT[jugador] < entre(d.repone, hash(...clave, "rp", n))) return null;
    if (huecos.length) return huecos[0];
    if (juntar.length && s.mazos[jugador].length) return juntar[0];
    return null;
  }

  // 3) si puede dejar las dos de arriba con el mismo número, a veces lo hace a propósito (y canta él primero)
  const topes = s.pilas.map(tope);
  const arma = posibles.filter((a) => numero(s.mano[jugador][a.carta]) === numero(topes[1 - a.pila]));
  if (arma.length && hash(...clave, "ap", n) < d.apunta) return arma[0];
  return posibles[Math.floor(hash(...clave, "pl", n) * posibles.length)];
}
