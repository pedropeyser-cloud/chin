// Rival de práctica para la escoba. Sin reloj propio: mira `ahora` y el estado, y la misma situación da la misma
// decisión (azar reproducible con el número de jugada). Piensa un rato antes de tirar, como una persona.
//   tranquilo  (Don Tranqui):  levanta lo que ve, a veces se le pasa una jugada y no piensa en lo que deja.
//   rapido     (Rata):         busca escobas, oros y sietes, y trata de no dejarte la escoba servida.
//   implacable (El Relámpago): cuenta las cartas que salieron y calcula cuánto arriesga con lo que deja en la mesa.
import { acciones, valor, numero, palo, mazoCompleto, combinaciones } from "./motor.js";

export const DIFICULTADES = {
  tranquilo:  { piensa: [1500, 2600], despiste: 0.3, riesgo: 0 },
  rapido:     { piensa: [1000, 1800], despiste: 0.06, riesgo: 1 },
  implacable: { piensa: [800, 1400], despiste: 0, riesgo: 2 },
};

function hash(...partes) {
  const txt = partes.join("|");
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const entre = ([a, b], u) => a + (b - a) * u;
const sumaDe = (ids) => ids.reduce((s, c) => s + valor(c), 0);

/** Lo que vale llevarse estas cartas (en décimas de punto, más o menos). */
function botin(cartas) {
  let v = 0;
  for (const c of cartas) {
    v += 0.6;                                   // cartas
    if (palo(c) === "oro") v += 1.2;            // oros
    if (numero(c) === 7) v += 2.6;              // setenta
    else if (numero(c) === 6) v += 1;
    if (c === "7-oro") v += 8;                  // un punto seguro
  }
  return v;
}

// combinaciones C(n, k) como número de punto flotante (n chico)
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
/** Chance de que el rival tenga al menos una de `k` cartas buenas entre `u` que no se vieron, con `h` en la mano. */
const chance = (k, u, h) => (k <= 0 || h <= 0 || u <= 0 ? 0 : 1 - comb(u - k, h) / comb(u, h));

/** Las cartas que este jugador no vio todavía (están en la mano del rival o en el mazo). */
export function noVistas(estado, jugador) {
  const vistas = new Set([...estado.mano[jugador], ...estado.mesa, ...estado.levantadas[0], ...estado.levantadas[1]]);
  return mazoCompleto().filter((c) => !vistas.has(c));
}

/** Cuánto arriesga dejando la mesa `mesa`: escoba del rival y siete de oro servido. */
function riesgo(mesa, ocultas, hRival, nivel) {
  if (!mesa.length || hRival <= 0) return 0;
  let r = 0;
  const total = sumaDe(mesa);
  const faltaEscoba = 15 - total;
  if (faltaEscoba >= 1 && faltaEscoba <= 10) {
    const k = ocultas.filter((c) => valor(c) === faltaEscoba).length;
    const p = nivel >= 2 ? chance(k, ocultas.length, hRival) : (k ? 0.5 : 0);
    r += p * (10 + botin(mesa) * 0.5);
  }
  if (nivel >= 2) {
    // el siete de oro en la mesa: ¿con qué valores se lo lleva el rival?
    if (mesa.includes("7-oro")) {
      const sirven = new Set();
      for (let v = 1; v <= 10; v++) {
        const falsa = v <= 7 ? `${v}-copa` : `${v + 2}-copa`;
        if (combinaciones(mesa, falsa).some((x) => x.includes("7-oro"))) sirven.add(v);
      }
      const k = ocultas.filter((c) => sirven.has(valor(c))).length;
      r += chance(k, ocultas.length, hRival) * 7;
    }
  } else if (nivel === 1 && mesa.includes("7-oro")) r += 3;
  return r;
}

/** Puntaje de una jugada para el que la hace. */
export function puntaje(estado, jugador, a, nivel = 2) {
  const quedan = estado.mesa.filter((c) => !a.levanta.includes(c));
  let p = 0;
  if (a.levanta.length) {
    p += botin([a.carta, ...a.levanta]);
    if (!quedan.length) p += 10;               // escoba
  } else {
    quedan.push(a.carta);
    p -= botin([a.carta]) * 0.35;              // lo que regalo si me la levantan
  }
  if (nivel > 0) {
    const ocultas = noVistas(estado, jugador).filter((c) => c !== a.carta);
    const hRival = estado.mano[1 - jugador].length;
    p -= riesgo(quedan, ocultas, hRival, nivel);
  }
  return p;
}

/** Cuánto tarda en decidir (ms desde que empezó su turno). */
export function demora(estado, jugador, dificultad = "rapido") {
  const d = DIFICULTADES[dificultad] || DIFICULTADES.rapido;
  return entre(d.piensa, hash(estado.rng, estado.seq, jugador, "piensa"));
}

export function elegir(estado, jugador, dificultad = "rapido") {
  const d = DIFICULTADES[dificultad] || DIFICULTADES.rapido;
  const todas = acciones(estado, jugador);
  if (!todas.length) return null;
  if (todas[0].t === "seguir") return todas[0];
  // despistado: tira cualquier carta, levante o no
  if (d.despiste && hash(estado.rng, estado.seq, "despiste") < d.despiste) {
    return todas[Math.floor(hash(estado.rng, estado.seq, "cual") * todas.length)];
  }
  let mejor = null, mejorP = -Infinity;
  for (const a of todas) {
    const p = puntaje(estado, jugador, a, d.riesgo) + hash(estado.rng, estado.seq, a.carta, a.levanta.join()) * 0.01;
    if (p > mejorP) { mejorP = p; mejor = a; }
  }
  return mejor;
}

/** Contrato: la jugada del bot si ya pensó lo suficiente; si no, null. */
export function bot(estado, jugador, ahora, dificultad = "rapido") {
  if (estado.fase === "recuento") {
    if (estado.listos[jugador]) return null;
    return ahora - estado.turnoDesde >= 2500 ? { t: "seguir" } : null;
  }
  if (estado.fase !== "jugando" || estado.turno !== jugador) return null;
  if (ahora - estado.turnoDesde < demora(estado, jugador, dificultad)) return null;
  return elegir(estado, jugador, dificultad);
}
