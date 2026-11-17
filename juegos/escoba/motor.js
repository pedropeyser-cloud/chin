// Motor de la ESCOBA DE 15 (2 jugadores, por turnos). Módulo ES sin DOM ni reloj propio: el tiempo entra como dato
// (`ahora`, en ms) y el estado es un objeto plano serializable a JSON. El anfitrión es el árbitro.
//
// Reglas (docs/escoba/reglas.md): mazo español de 40 (sin 8 ni 9). Valen 1 a 7 lo que dicen, la sota 8, el caballo 9
// y el rey 10. Se reparten 3 a cada uno y 4 a la mesa; si las 4 de la mesa suman 15 (o 30), se las lleva el que
// reparte y cuentan como escoba (o dos). Empieza el que no reparte. En su turno, cada uno tira una carta: si con
// cartas de la mesa suma 15, se las lleva (no está obligado); si deja la mesa vacía, es escoba. Cuando se acaban las
// manos se reparten 3 más; al final del mazo, lo que queda en la mesa se lo lleva el último que levantó (no es escoba).
// Puntos de cada mano: 1 por escoba, 1 al que tiene más cartas, 1 al que tiene más oros, 1 por el siete de oro y
// 1 por la setenta (más sietes; si empatan, más seises). Empate en cartas, oros o setenta: no lo cobra nadie.
// Se juega a 15: si los dos llegan en la misma mano gana el que tiene más; si empatan, se juega otra mano.
// El que reparte se va alternando.
// SOPLO: si uno tira sin levantar, el que sigue puede soplar hasta que haga su jugada: toca la carta que se tiró y las
// de la mesa que sumaban 15 con ella, y se las lleva (no es escoba). Si no suman 15 no pasa nada: ni castigo ni aviso,
// y el motor tampoco dice si había soplo (la vista solo muestra que la ventana está abierta, que es público).
// Si la última carta de la mano se tira sin levantar, hay `ventanaFinal` ms para soplar antes del recuento.
//
// DE A 4 (`jugadores: 4`, agregado el 2026-11-17): dos parejas enfrentadas. Los asientos van de 0 a 3 en el orden de la
// ronda (antihoraria: después del 0 juega el 1, que está a su derecha); pareja = asiento % 2 (0 y 2 contra 1 y 3).
// Mismas reglas contando todo por pareja: `levantadas`, `escobas`, `puntos`, `recuento` y `ganador` son por pareja;
// `mano`, `listos`, `turno`, `reparte` y `ultimoLevanto` son por asiento. Reparte rotando a la derecha y empieza el de su
// derecha. La escoba de mesa es para la pareja del que reparte. Pueden soplar los dos rivales del que tiró, hasta que
// juega el que sigue. Con 2 jugadores, asiento = pareja y todo queda como antes.

export const PALOS = ["oro", "copa", "espada", "basto"];
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];   // 10 = sota, 11 = caballo, 12 = rey (ids iguales a las del truco)
export const META = 15;
export const MANO = 3;
export const VENTANA_FINAL = 5000;

export const MENSAJES = {
  no_es_tu_turno: "Todavía no es tu turno.",
  no_suma: "Con esas no suma 15.",
  no_esta: "Esa carta ya no está.",
  no_jugando: "La mano terminó: esperá el recuento.",
  ya_listo: "Ya estás listo: esperando al otro.",
  fin: "La partida terminó.",
  soplo_no: "",              // soplo que no suma: no se avisa nada (que se dé cuenta la persona)
  no_soplo: "",
};

// ---------- cartas ----------
export const mazoCompleto = () => PALOS.flatMap((p) => NUMEROS.map((n) => `${n}-${p}`));
export const numero = (id) => Number(id.split("-")[0]);
export const palo = (id) => id.split("-")[1];
/** Lo que vale para sumar 15: 1 a 7 lo que dicen; sota 8, caballo 9, rey 10. */
export const valor = (id) => { const n = numero(id); return n <= 7 ? n : n - 2; };
export const idValido = (id) => typeof id === "string" && /^([1-7]|1[0-2])-(oro|copa|espada|basto)$/.test(id);
const suma = (ids) => ids.reduce((s, c) => s + valor(c), 0);

// ---------- azar con semilla (mulberry32) ----------
function azar(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function mezclar(s, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(azar(s) * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

/** Todas las formas de levantar con `carta` en esta mesa: listas de ids de la mesa que suman 15 con ella. */
export function combinaciones(mesa, carta) {
  const falta = 15 - valor(carta);
  const out = [];
  const n = mesa.length;
  const vals = mesa.map(valor);
  const ir = (i, resto, elegidas) => {
    if (resto === 0 && elegidas.length) { out.push(elegidas.map((k) => mesa[k])); return; }
    if (resto <= 0 || i >= n) return;
    for (let k = i; k < n; k++) if (vals[k] <= resto) { elegidas.push(k); ir(k + 1, resto - vals[k], elegidas); elegidas.pop(); }
  };
  if (falta > 0) ir(0, falta, []);
  return out;
}

const copiar = (e) => JSON.parse(JSON.stringify(e));

// ---------- partida ----------
/**
 * @param {{ nombres?: string[], semilla?: number, ahora?: number, meta?: number, reparte?: 0|1, pausaRecuento?: number, mazo?: string[] }} o
 * `mazo` (solo pruebas): el orden exacto del mazo (se reparte desde el principio).
 */
export function nuevaPartida({ nombres, jugadores = 2, semilla, ahora = 0, meta = META, reparte, pausaRecuento = 20000, ventanaFinal = VENTANA_FINAL, mazo } = {}) {
  const n = jugadores === 4 ? 4 : 2;
  const s = {
    juego: "escoba", n,
    nombres: nombres ? [...nombres] : n === 4 ? ["Vos", "Derecha", "Compañero", "Izquierda"] : ["Vos", "Rival"],
    rng: (Number.isFinite(semilla) ? semilla : Math.floor(Math.random() * 2 ** 31)) >>> 0,
    meta, pausaRecuento, ventanaFinal,
    soplo: null,            // { de, para, carta }: la ventana para soplar la última carta tirada sin levantar
    cierreHasta: null,      // fase "ultima": hasta cuándo se puede soplar la última tirada de la mano
    puntos: [0, 0],
    manoN: 0,
    reparte: 0,
    fase: "jugando",
    ganador: null,
    mazo: [], mesa: [], mano: vacias(n), levantadas: [[], []], escobas: [[], []],
    turno: 0, turnoDesde: ahora, ultimoLevanto: null,
    recuento: null, listos: Array(n).fill(false), recuentoHasta: null,
    historial: [],          // un resumen por mano: lo que ganó cada uno
    ultimo: null, seq: 0, mazoFijo: mazo ? [...mazo] : null,
  };
  // de a 2 se sigue sorteando igual que antes (mismas semillas, mismos repartos)
  s.reparte = Number.isInteger(reparte) && reparte >= 0 && reparte < n ? reparte : n === 2 ? (azar(s) < 0.5 ? 0 : 1) : Math.floor(azar(s) * n);
  const ev = [];
  empezarMano(s, ahora, ev, true);
  s.eventosIniciales = ev;
  return s;
}

const vacias = (n) => Array.from({ length: n }, () => []);
/** Cuántos juegan (los estados viejos no lo guardaban: eran de a 2). */
export const jugadoresDe = (s) => s.n || 2;
/** La pareja de un asiento: de a 2 es el mismo asiento; de a 4, 0 y 2 contra 1 y 3. */
export const pareja = (j) => j % 2;
const siguiente = (s, j) => (j + 1) % jugadoresDe(s);

function repartirManos(s) {
  const n = jugadoresDe(s);
  // de a una, empezando por el de la derecha del que reparte (de a 2 queda como antes: el otro y después el que reparte)
  for (let k = 0; k < MANO; k++) for (let i = 1; i <= n; i++) { const j = (s.reparte + i) % n; if (s.mazo.length) s.mano[j].push(s.mazo.shift()); }
}

function empezarMano(s, ahora, ev, primera = false) {
  const n = jugadoresDe(s);
  if (!primera) s.reparte = siguiente(s, s.reparte);
  s.manoN++;
  s.mazo = s.mazoFijo && s.manoN === 1 ? [...s.mazoFijo] : mezclar(s, mazoCompleto());
  s.mesa = []; s.mano = vacias(n); s.levantadas = [[], []]; s.escobas = [[], []];
  s.ultimoLevanto = null; s.recuento = null; s.listos = Array(n).fill(false); s.recuentoHasta = null; s.fase = "jugando";
  s.soplo = null; s.cierreHasta = null;
  repartirManos(s);
  for (let k = 0; k < 4; k++) s.mesa.push(s.mazo.shift());
  // la mesa suma 15 o 30: se la lleva el que reparte, como escoba (o dos)
  const total = suma(s.mesa);
  let escobasMesa = 0;
  if (total === 15 || total === 30) {
    escobasMesa = total / 15;
    const j = s.reparte, p = pareja(j);
    s.levantadas[p].push(...s.mesa);
    for (let k = 0; k < escobasMesa; k++) s.escobas[p].push(s.mesa[k]);
    s.ultimoLevanto = j;
    s.mesaInicial = [...s.mesa];
    s.mesa = [];
  } else s.mesaInicial = [...s.mesa];
  s.turno = siguiente(s, s.reparte);
  s.turnoDesde = ahora;
  ev.push({ t: "reparto", mano: s.manoN, reparte: s.reparte, mesa: [...s.mesaInicial], escobasMesa });
}

/** Lo que gana cada uno en la mano que terminó. */
export function contarMano(s) {
  const L = s.levantadas;
  const cuenta = (f) => [L[0].filter(f).length, L[1].filter(f).length];
  const quien = ([a, b]) => (a > b ? 0 : b > a ? 1 : null);
  const cartas = [L[0].length, L[1].length];
  const oros = cuenta((c) => palo(c) === "oro");
  const sietes = cuenta((c) => numero(c) === 7);
  const seises = cuenta((c) => numero(c) === 6);
  const siete = L[0].includes("7-oro") ? 0 : L[1].includes("7-oro") ? 1 : null;
  const setenta = quien(sietes) ?? quien(seises);
  const escobas = [s.escobas[0].length, s.escobas[1].length];
  const r = {
    escobas, cartas, oros, sietes, seises,
    gana: { cartas: quien(cartas), oros: quien(oros), siete, setenta },
  };
  r.total = [0, 1].map((j) => escobas[j] + ["cartas", "oros", "siete", "setenta"].filter((k) => r.gana[k] === j).length);
  return r;
}

function cerrarMano(s, ahora, ev) {
  s.soplo = null; s.cierreHasta = null;
  // lo que queda en la mesa: para el último que levantó (no es escoba)
  if (s.mesa.length) {
    const j = s.ultimoLevanto ?? s.reparte;
    ev.push({ t: "barrida", jugador: j, cartas: [...s.mesa] });
    s.levantadas[pareja(j)].push(...s.mesa);
    s.mesa = [];
  }
  const r = contarMano(s);
  const antes = [...s.puntos];
  s.puntos = [s.puntos[0] + r.total[0], s.puntos[1] + r.total[1]];
  r.antes = antes; r.despues = [...s.puntos]; r.mano = s.manoN;
  s.recuento = r;
  s.historial.push({ mano: s.manoN, total: r.total, puntos: [...s.puntos] });
  ev.push({ t: "recuento", recuento: r });
  const [a, b] = s.puntos;
  if ((a >= s.meta || b >= s.meta) && a !== b) {
    s.fase = "fin";
    s.ganador = a > b ? 0 : 1;
    ev.push({ t: "fin", ganador: s.ganador });
  } else {
    s.fase = "recuento";
    s.listos = Array(jugadoresDe(s)).fill(false);
    s.recuentoHasta = ahora + s.pausaRecuento;
  }
}

function rechazo(motivo) { return { motivo, mensaje: MENSAJES[motivo] }; }

/**
 * Acciones: `{ t: "jugar", carta: id, levanta: [ids de la mesa] }` (levanta vacío = tirar sin levantar)
 *           `{ t: "seguir" }` (en el recuento: listo para la mano que viene)
 */
export function aplicar(estado, jugador, accion, ahora = 0) {
  if (!Number.isInteger(jugador) || jugador < 0 || jugador >= jugadoresDe(estado)) throw new Error("jugador inválido");
  if (!accion || typeof accion !== "object") throw new Error("acción inválida");
  if (estado.fase === "fin") return { estado, eventos: [], rechazo: rechazo("fin") };
  const s = copiar(estado);
  delete s.eventosIniciales;
  const ev = [];

  if (accion.t === "seguir") {
    if (s.fase !== "recuento") return { estado, eventos: [], rechazo: rechazo("no_jugando") };
    if (s.listos[jugador]) return { estado, eventos: [], rechazo: rechazo("ya_listo") };
    s.listos[jugador] = true;
    ev.push({ t: "listo", jugador });
    if (s.listos.every(Boolean)) empezarMano(s, ahora, ev);
    s.seq++;
    return { estado: s, eventos: ev };
  }

  if (accion.t === "soplar") {
    if (!Array.isArray(accion.cartas) || accion.cartas.length > 12 || accion.cartas.some((c) => !idValido(c))) throw new Error("soplo mal formado");
    if (new Set(accion.cartas).size !== accion.cartas.length) throw new Error("carta repetida");
    const sp = s.soplo;
    if (!puedeSoplar(s, jugador)) return { estado, eventos: [], rechazo: rechazo("no_soplo") };
    if (!accion.cartas.includes(sp.carta) || accion.cartas.length < 2 || accion.cartas.some((c) => !s.mesa.includes(c)) || suma(accion.cartas) !== 15) {
      return { estado, eventos: [], rechazo: rechazo("soplo_no") };
    }
    s.mesa = s.mesa.filter((c) => !accion.cartas.includes(c));
    s.levantadas[pareja(jugador)].push(...accion.cartas);
    s.ultimoLevanto = jugador;
    s.soplo = null;
    ev.push({ t: "soplo", jugador, de: sp.de, cartas: [...accion.cartas] });
    if (s.fase === "ultima") cerrarMano(s, ahora, ev);
    else s.turnoDesde = ahora;     // el que sopló sigue con su turno: vuelve a pensar
    s.seq++;
    return { estado: s, eventos: ev };
  }

  if (accion.t !== "jugar") throw new Error("acción desconocida");
  if (!idValido(accion.carta) || !Array.isArray(accion.levanta) || accion.levanta.some((c) => !idValido(c))) throw new Error("jugada mal formada");
  if (new Set(accion.levanta).size !== accion.levanta.length) throw new Error("carta repetida");
  if (s.fase !== "jugando") return { estado, eventos: [], rechazo: rechazo("no_jugando") };
  if (s.turno !== jugador) return { estado, eventos: [], rechazo: rechazo("no_es_tu_turno") };
  const enMano = s.mano[jugador].indexOf(accion.carta);
  if (enMano < 0 || accion.levanta.some((c) => !s.mesa.includes(c))) return { estado, eventos: [], rechazo: rechazo("no_esta") };
  if (accion.levanta.length && valor(accion.carta) + suma(accion.levanta) !== 15) return { estado, eventos: [], rechazo: rechazo("no_suma") };

  s.mano[jugador].splice(enMano, 1);
  s.soplo = null;                  // el que podía soplar ya jugó: se cerró la ventana
  let escoba = false;
  if (accion.levanta.length) {
    s.mesa = s.mesa.filter((c) => !accion.levanta.includes(c));
    s.levantadas[pareja(jugador)].push(accion.carta, ...accion.levanta);
    s.ultimoLevanto = jugador;
    if (!s.mesa.length) { escoba = true; s.escobas[pareja(jugador)].push(accion.carta); }
  } else {
    s.mesa.push(accion.carta);
    // `para`: el que sigue (le toca jugar y es rival); de a 4 también puede soplar el otro rival
    s.soplo = { de: jugador, para: siguiente(s, jugador), carta: accion.carta };
  }
  s.ultimo = { jugador, carta: accion.carta, levanta: [...accion.levanta], escoba };
  ev.push({ t: "jugada", jugador, carta: accion.carta, levanta: [...accion.levanta], escoba });

  s.turno = siguiente(s, jugador);
  s.turnoDesde = ahora;
  if (s.mano.every((m) => !m.length)) {
    if (s.mazo.length) {
      repartirManos(s);
      s.turno = siguiente(s, s.reparte);
      ev.push({ t: "repartir", quedan: s.mazo.length });
    } else if (s.soplo) {
      // la última de la mano se tiró sin levantar: un rato para soplarla antes del recuento (siempre, haya o no soplo)
      s.fase = "ultima";
      s.turno = s.soplo.para;
      s.cierreHasta = ahora + s.ventanaFinal;
      ev.push({ t: "ultima", hasta: s.cierreHasta });
    } else cerrarMano(s, ahora, ev);
  }
  s.seq++;
  return { estado: s, eventos: ev };
}

/** Cierra el recuento si nadie tocó «Seguir» a tiempo. */
export function reloj(estado, ahora) {
  if (estado.fase === "ultima") {
    if (estado.cierreHasta === null || ahora < estado.cierreHasta) return { estado, eventos: [] };
    const s = copiar(estado);
    delete s.eventosIniciales;
    const ev = [];
    cerrarMano(s, ahora, ev);
    s.seq++;
    return { estado: s, eventos: ev };
  }
  if (estado.fase !== "recuento" || estado.recuentoHasta === null || ahora < estado.recuentoHasta) return { estado, eventos: [] };
  const s = copiar(estado);
  delete s.eventosIniciales;
  const ev = [];
  empezarMano(s, ahora, ev);
  s.seq++;
  return { estado: s, eventos: ev };
}

/** Si `jugador` puede soplar ahora: hay ventana abierta y es rival del que tiró (de a 2, el otro). */
export function puedeSoplar(estado, jugador) {
  const sp = estado.soplo;
  return !!sp && pareja(sp.de) !== pareja(jugador) && (estado.fase === "jugando" || estado.fase === "ultima");
}

/** Las formas de soplar que tiene `jugador` ahora (solo para el bot y las pruebas: la pantalla no lo muestra). */
export function soplos(estado, jugador) {
  const sp = estado.soplo;
  if (!puedeSoplar(estado, jugador)) return [];
  return combinaciones(estado.mesa.filter((c) => c !== sp.carta), sp.carta).map((x) => [sp.carta, ...x]);
}

/** Las jugadas posibles de `jugador`: cada carta con cada forma de levantar, y tirarla sin levantar. */
export function acciones(estado, jugador) {
  if (estado.fase === "recuento") return estado.listos[jugador] ? [] : [{ t: "seguir" }];
  if (estado.fase !== "jugando" || estado.turno !== jugador) return [];
  const out = [];
  for (const carta of estado.mano[jugador]) {
    for (const levanta of combinaciones(estado.mesa, carta)) out.push({ t: "jugar", carta, levanta });
    out.push({ t: "jugar", carta, levanta: [] });
  }
  return out;
}

/** Lo que ve `jugador`: sin las manos de los otros ni el orden del mazo. Las levantadas van boca abajo (solo cuántas). */
export function vista(estado, jugador) {
  return {
    juego: "escoba", n: jugadoresDe(estado), yo: jugador, nombres: [...estado.nombres],
    fase: estado.fase, ganador: estado.ganador, meta: estado.meta,
    puntos: [...estado.puntos], manoN: estado.manoN, reparte: estado.reparte,
    turno: estado.turno, turnoDesde: estado.turnoDesde,
    mesa: [...estado.mesa],
    mano: [...estado.mano[jugador]],
    enMano: estado.mano.map((m) => m.length),
    mazo: estado.mazo.length,
    levantadas: [estado.levantadas[0].length, estado.levantadas[1].length],
    escobas: [[...estado.escobas[0]], [...estado.escobas[1]]],
    recuento: estado.recuento ? copiar(estado.recuento) : null,
    listos: [...estado.listos], recuentoHasta: estado.recuentoHasta,
    historial: copiar(estado.historial),
    ultimo: estado.ultimo ? copiar(estado.ultimo) : null,
    // la ventana para soplar es pública (se vio que tiró sin levantar); si había soplo, no se dice
    soplo: puedeSoplar(estado, jugador) ? { carta: estado.soplo.carta } : null,
    cierreHasta: estado.cierreHasta ?? null,
    seq: estado.seq,
  };
}

export const juego = {
  id: "escoba", nombre: "Escoba de 15", jugadores: [2, 4],
  nuevaPartida, aplicar, vista, acciones, reloj,
};
