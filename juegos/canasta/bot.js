// Rival de práctica para la canasta. Sin reloj propio: mira `ahora` y el estado, y la misma situación da la misma
// decisión (azar reproducible con el número de jugada). Cada jugada que piensa la prueba contra el motor antes de
// elegirla, así nunca intenta algo que no vale.
//   tranquilo  (Don Tranqui):  levanta el pozo solo si es grande, no completa canastas con libres, tira sin mirar al rival.
//   rapido     (Rata):         levanta el pozo siempre que puede, completa canastas y no te tira lo que juntás.
//   implacable (El Relámpago): además mira lo que ya pasó por el pozo para elegir qué tirar.
import { aplicar, rango, esLibre, esNegro3, valor, sumar, minimo, congelado, pozoTapado, canastas, CANASTA } from "./motor.js";

export const DIFICULTADES = {
  tranquilo:  { piensa: [1600, 2800], sigue: [700, 1200], pozoMin: 4, libreAlPozo: false, completa: false, cuida: 0, despiste: 0.25 },
  rapido:     { piensa: [1000, 1800], sigue: [450, 800], pozoMin: 1, libreAlPozo: true, completa: true, cuida: 1, despiste: 0.04 },
  implacable: { piensa: [800, 1400], sigue: [350, 650], pozoMin: 1, libreAlPozo: true, completa: true, cuida: 2, despiste: 0 },
};

function hash(...partes) {
  const txt = partes.join("|");
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const entre = ([a, b], u) => a + (b - a) * u;

/** Naturales por número (sin libres). */
function porRango(cartas) {
  const m = new Map();
  for (const c of cartas) if (!esLibre(c)) { const r = rango(c); if (!m.has(r)) m.set(r, []); m.get(r).push(c); }
  return m;
}
const libresDe = (cartas) => cartas.filter(esLibre).sort((a, b) => valor(a) - valor(b));

/** Juegos nuevos posibles con la mano: tríos naturales y, si se pide, pares con una libre. */
function armar(mano, excluir, conPares) {
  const g = porRango(mano), libres = libresDe(mano), out = [];
  for (const [r, nat] of g) if (r !== 3 && !excluir.has(r) && nat.length >= 3) out.push([...nat]);
  if (conPares) for (const [r, nat] of g) if (r !== 3 && !excluir.has(r) && nat.length === 2 && libres.length) out.push([...nat, libres.shift()]);
  return out;
}

/** Combinaciones de juegos para llegar a `falta` puntos: primero sin gastar libres, después con. */
function paraElMinimo(mano, falta, excluir) {
  const out = [];
  for (const conPares of [false, true]) {
    const orden = armar(mano, excluir, conPares).sort((a, b) => sumar(b) - sumar(a));
    if (falta <= 0) { out.push([]); out.push(orden); continue; }
    let acc = [], t = 0;
    for (const g of orden) { acc.push(g); t += sumar(g); if (t >= falta) { out.push([...acc]); break; } }
    if (sumar(orden.flat()) >= falta) out.push(orden);
  }
  return out;
}

/** Las jugadas que le gustan, de la que más a la que menos. El motor decide cuáles valen. */
function candidatos(estado, j, d) {
  const mano = estado.mano[j], mios = estado.juegos[j], misR = new Set(mios.map((g) => g.rango)), out = [];
  if (estado.fase === "robar") {
    const pozo = estado.pozo;
    const mira = d.despiste === 0 || hash(estado.rng, estado.seq, "mira") > d.despiste;
    if (mira && !pozoTapado(pozo) && pozo.length >= d.pozoMin) {
      const tope = pozo.at(-1), r = rango(tope), frio = congelado(pozo);
      if (!frio && misR.has(r)) out.push({ t: "pozo", a: r });
      const nat = mano.filter((c) => !esLibre(c) && rango(c) === r), libres = libresDe(mano);
      let con = null;
      if (nat.length >= 2) con = nat.slice(0, 2);
      else if (!frio && nat.length === 1 && libres.length && d.libreAlPozo && pozo.length >= 3) con = [nat[0], libres[0]];
      if (con) {
        if (estado.bajo[j]) out.push({ t: "pozo", con });
        else {
          const resto = mano.filter((c) => !con.includes(c));
          const falta = minimo(estado.puntos[j]) - sumar([tope, ...con]);
          for (const juegos of paraElMinimo(resto, falta, new Set([r]))) out.push({ t: "pozo", con, juegos });
        }
      }
    }
    out.push({ t: "robar" });
    return out;
  }
  // jugar
  if (!estado.bajo[j]) {
    for (const juegos of paraElMinimo(mano, minimo(estado.puntos[j]), new Set())) if (juegos.length) out.push({ t: "bajar", juegos });
    out.push({ t: "tirar", carta: descarte(estado, j, d) });
    return out;
  }
  const cierra = canastas(mios) >= 2;
  const g = porRango(mano);
  for (const m of mios) if (g.has(m.rango)) out.push({ t: "agregar", rango: m.rango, cartas: g.get(m.rango) });
  const nuevos = armar(mano, misR, false);
  if (nuevos.length) out.push({ t: "bajar", juegos: nuevos });
  if (d.completa || cierra) {
    const libres = libresDe(mano);
    for (const m of mios) {
      const n = m.cartas.length, lib = m.cartas.filter(esLibre).length;
      if (n >= CANASTA || !libres.length) continue;
      const faltan = CANASTA - n;
      if (faltan <= libres.length && faltan <= 2) out.push({ t: "agregar", rango: m.rango, cartas: libres.slice(0, faltan) });
      else if (cierra && lib < 3) out.push({ t: "agregar", rango: m.rango, cartas: [libres[0]] });
    }
  }
  if (cierra) {
    const pares = armar(mano, misR, true).filter((x) => x.some(esLibre));
    if (pares.length) out.push({ t: "bajar", juegos: pares });
    const negros = mano.filter(esNegro3);
    if (negros.length >= 3) out.push({ t: "bajar", juegos: [negros] });
  }
  out.push({ t: "tirar", carta: descarte(estado, j, d) });
  return out;
}

/** La carta que menos le sirve y menos le regala al rival. */
export function descarte(estado, j, d = DIFICULTADES.rapido) {
  const mano = estado.mano[j];
  if (mano.length === 1) return mano[0];
  const rivalR = new Set(estado.juegos[1 - j].map((g) => g.rango)), misR = new Set(estado.juegos[j].map((g) => g.rango));
  const frio = congelado(estado.pozo), g = porRango(mano);
  const enPozo = new Map();
  for (const c of estado.pozo) enPozo.set(rango(c), (enPozo.get(rango(c)) || 0) + 1);
  const nota = (c) => {
    if (esLibre(c)) return 1000 + valor(c);
    if (esNegro3(c)) return -100;
    const r = rango(c);
    let s = (g.get(r)?.length || 0) * 10 + (misR.has(r) ? 30 : 0) - valor(c) / 10;
    if (d.cuida >= 1 && !frio && rivalR.has(r)) s += 40;          // le serviría para levantar el pozo
    if (d.cuida >= 2) s -= (enPozo.get(r) || 0) * 4;                // ya pasaron por el pozo: nadie las junta
    return s;
  };
  const orden = [...mano].sort((a, b) => nota(a) - nota(b) || (a < b ? -1 : 1));
  if (d.despiste && hash(estado.rng, estado.seq, "tira") < d.despiste) {
    const comunes = orden.filter((c) => !esLibre(c));
    if (comunes.length) return comunes[Math.floor(hash(estado.rng, estado.seq, "cual") * Math.min(3, comunes.length))];
  }
  return orden[0];
}

export function elegir(estado, jugador, dificultad = "rapido") {
  const d = DIFICULTADES[dificultad] || DIFICULTADES.rapido;
  if (estado.fase === "recuento") return estado.listos[jugador] ? null : { t: "seguir" };
  if (estado.turno !== jugador || (estado.fase !== "robar" && estado.fase !== "jugar")) return null;
  for (const a of candidatos(estado, jugador, d)) {
    try { if (!aplicar(estado, jugador, a, 0).rechazo) return a; } catch { /* no vale: la que sigue */ }
  }
  return estado.fase === "robar" ? { t: "robar" } : { t: "tirar", carta: estado.mano[jugador][0] };
}

/** Cuánto tarda en decidir (ms desde su última jugada o desde que empezó el turno). */
export function demora(estado, jugador, dificultad = "rapido") {
  const d = DIFICULTADES[dificultad] || DIFICULTADES.rapido;
  return entre(estado.fase === "robar" ? d.piensa : d.sigue, hash(estado.rng, estado.seq, jugador, "piensa"));
}

/** Contrato: la jugada del bot si ya pensó lo suficiente; si no, null. */
export function bot(estado, jugador, ahora, dificultad = "rapido") {
  if (estado.fase === "recuento") {
    if (estado.listos[jugador]) return null;
    return ahora - estado.turnoDesde >= 2500 ? { t: "seguir" } : null;
  }
  if (estado.turno !== jugador || (estado.fase !== "robar" && estado.fase !== "jugar")) return null;
  if (ahora - estado.accionDesde < demora(estado, jugador, dificultad)) return null;
  return elegir(estado, jugador, dificultad);
}
