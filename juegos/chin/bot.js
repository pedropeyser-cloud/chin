// Rival de práctica para CHIN. Sin reloj propio: decide mirando `ahora` y el estado,
// y la misma situación da la misma decisión (azar reproducible a partir de la semilla de la partida).
// Tiene tiempo de reacción humano y variable, ritmo propio para dar vuelta cartas y a veces no ve la pareja.
// Nunca canta CHIN sin pareja: el juego no lo deja.

import { mismaCarta } from "./motor.js";

export const DIFICULTADES = {
  tranquilo:  { reaccion: [850, 1500], ritmo: [650, 1100], distraido: 0.12, tapa: 0.35, apunta: 0.35 },
  rapido:     { reaccion: [480, 850],  ritmo: [420, 700],  distraido: 0.06, tapa: 0.6,  apunta: 0.7 },
  implacable: { reaccion: [290, 440],  ritmo: [300, 460],  distraido: 0.02, tapa: 0.85, apunta: 0.95 }
};

function hash(...partes) {
  const txt = partes.join("|");
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const entre = ([a, b], u) => a + (b - a) * u;

/**
 * Qué hace el bot `jugador` en `ahora`: una acción de `acciones()` o `null` si todavía no le toca.
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
    // el que la formó la vio nacer: reacciona más rápido; el distraído se da cuenta mucho después
    const base = entre(d.reaccion, hash(...clave, "rx", c.id));
    const demora = distraido ? base * 2.6 + 700 : base;
    if (ahora - c.t >= demora) return { t: "chin", visto: c.id };
  }

  if (s.finPendiente) return null;
  const mazo = s.mazos[jugador].length;
  const mano = s.mano[jugador];
  if (mazo === 0 && mano === null) return null;

  // 2) ritmo propio entre una jugada y la siguiente
  const ritmo = entre(d.ritmo, hash(...clave, "rt", s.jugadas[jugador]));
  if (ahora - s.ultimaT[jugador] < ritmo) return null;

  if (mano === null) return { t: "voltear" };

  // 3) elegir pila: si mi carta es igual a una de arriba, la pongo en la otra y armo la pareja (me adelanto);
  //    si el rival tiene dada vuelta una carta igual a una de arriba, tapo esa pila
  const topes = s.pilas.map((p) => (p.length ? p[p.length - 1] : null));
  for (const p of [0, 1]) {
    if (mismaCarta(mano, topes[p]) && hash(...clave, "ap", s.jugadas[jugador]) < d.apunta) {
      return { t: "poner", pila: 1 - p };
    }
  }
  const rival = s.mano[1 - jugador];
  for (const p of [0, 1]) {
    if (mismaCarta(rival, topes[p]) && hash(...clave, "tp", s.jugadas[jugador]) < d.tapa) {
      return { t: "poner", pila: p };
    }
  }
  return { t: "poner", pila: hash(...clave, "pl", s.jugadas[jugador]) < 0.5 ? 0 : 1 };
}
