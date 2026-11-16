// Motor de CHIN (2 jugadores, tiempo real). Módulo ES sin DOM ni reloj propio:
// el tiempo entra como dato (`ahora`, en milisegundos) en cada llamada, así se prueba con semilla y reloj inyectado.
// El estado es un objeto plano serializable a JSON. El anfitrión es el árbitro: procesa las acciones
// en el orden en que le llegan y el que llega primero gana.
//
// Reglas (docs/chin/reglas.md): cada jugador tiene su mazo español de 48 boca abajo y una mano de 5 cartas boca arriba.
// Al empezar cada ronda cada uno da vuelta una carta de su mazo en una de las dos pilas del centro. Sin turnos, cada uno
// tira cartas de su mano sobre cualquier pila si su número es el siguiente o el anterior al de arriba (el 12 y el 1 se
// tocan: sobre un 12 va un 11 o un 1) y repone a mano los huecos de su fila desde el mazo. Si las dos cartas de arriba
// tienen el mismo número (el palo no importa) se canta CHIN: el otro se lleva las dos pilas y se arranca una ronda nueva.
// Si nadie puede tirar ni reponer, el juego marca los mazos: cuando los dos tocan el suyo, va una de cada mazo a cada
// pila al mismo tiempo. Gana el primero que se queda sin cartas.

export const PALOS = ["espada", "basto", "oro", "copa"];
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const CARTAS_POR_JUGADOR = 48;
export const MANO = 5;

export const MENSAJES = {
  no_coincide: "Todavía no tienen el mismo número.",
  rival_movio: "El rival movió antes: ya no son iguales.",
  rival_chin: "El rival cantó CHIN antes.",
  moviste_vos: "Ya moviste: ya no son iguales.",
  no_arranco: "Todavía no arrancó.",
  no_va: "Esa carta no va ahí: tiene que ser la que sigue o la anterior.",
  sin_carta: "No hay carta en ese lugar.",
  lugar_ocupado: "Ese lugar ya tiene carta.",
  mazo_vacio: "No te quedan cartas en el mazo.",
  otro_numero: "Solo se apilan cartas del mismo número.",
  pila_llena: "En un lugar entran como mucho 4 cartas iguales.",
  no_trabado: "Todavía hay jugadas: no hace falta dar vuelta del mazo.",
  fin: "La partida terminó."
};

// ---------- Azar con semilla (mulberry32) ----------

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

export const mazoCompleto = () => PALOS.flatMap((p) => NUMEROS.map((n) => `${n}-${p}`));
export const idValido = (id) => typeof id === "string" && /^([1-9]|1[0-2])-(espada|basto|oro|copa)$/.test(id);
export const numero = (id) => (id ? parseInt(id, 10) : null);

/** ¿`carta` se puede tirar sobre `tope`? La que sigue o la anterior, y el 12 con el 1. */
export function encaja(carta, tope) {
  if (!carta) return false;
  if (!tope) return true;
  const d = Math.abs(numero(carta) - numero(tope));
  return d === 1 || d === 11;
}
/** Mismo número, sin importar el palo. */
export const mismoNumero = (a, b) => a !== null && b !== null && numero(a) === numero(b);

// ---------- Estado ----------

const otro = (j) => 1 - j;
const tope = (pila) => (pila.length ? pila[pila.length - 1] : null);
// Cartas del mismo número se pueden apilar en un solo lugar de la fila: `mano[j][i]` es la de arriba (la que se juega)
// y `debajo[j][i]` las que quedan abajo, todas del mismo número. Se tiran de a una.
const enMano = (s, j) => s.mano[j].filter(Boolean).length + s.debajo[j].reduce((n, d) => n + d.length, 0);
/** Saca la carta de arriba del lugar `i` y sube la que estaba debajo (si hay). */
function sacarDeFila(s, j, i) {
  const c = s.mano[j][i];
  s.mano[j][i] = s.debajo[j][i].length ? s.debajo[j][i].pop() : null;
  return c;
}
/** Como mucho 4 cartas en un lugar de la fila: las que hay de cada número en un mazo (decisión de Pedro). */
export const TOPE_PILA = 4;
const enLugar = (s, j, i) => (s.mano[j][i] ? 1 : 0) + s.debajo[j][i].length;
/** ¿Se puede apilar el lugar `i` de `j` arriba del lugar `k`? (mismo número y sin pasar el tope) */
const sePuedeJuntar = (s, j, i, k) => i !== k && s.mano[j][i] && mismoNumero(s.mano[j][i], s.mano[j][k])
  && enLugar(s, j, i) + enLugar(s, j, k) <= TOPE_PILA;
/** ¿`j` tiene dos lugares que pueda juntar para liberar uno? */
const puedeJuntar = (s, j) => s.mano[j].some((_, i) => s.mano[j].some((_, k) => sePuedeJuntar(s, j, i, k)));
export const cartasDe = (s, j) => s.mazos[j].length + enMano(s, j);
const sinCartas = (s, j) => cartasDe(s, j) === 0;

/**
 * @param {{nombres?: string[], semilla?: number, ahora?: number, cuenta?: number, pausaRonda?: number,
 *          ventanaFinal?: number, mazos?: string[][]}} opts
 * `cuenta`: ms de cuenta regresiva antes de la primera ronda. `pausaRonda`: ms entre un CHIN y la ronda siguiente.
 * `ventanaFinal`: ms que el rival tiene para cantar CHIN si la última carta de alguien deja CHIN en la mesa.
 * `mazos`: solo para pruebas (mazos armados a mano, la primera carta es la de arriba).
 */
export function nuevaPartida({ nombres = ["Jugador 1", "Jugador 2"], semilla, ahora = 0, cuenta = 3000, pausaRonda = 2000,
  ventanaFinal = 1500, mazos } = {}) {
  const sem = Number.isFinite(semilla) ? semilla >>> 0 : Math.floor(Math.random() * 4294967296);
  const s = {
    juego: "chin", semilla: sem, rng: sem, nombres: [...nombres],
    seq: 0, fase: "jugando", ganador: null, ronda: 0,
    arranca: ahora + cuenta, pausaRonda, ventanaFinal,
    mazos: [[], []], mano: [Array(MANO).fill(null), Array(MANO).fill(null)], pilas: [[], []],
    debajo: [Array.from({ length: MANO }, () => []), Array.from({ length: MANO }, () => [])],
    coincidencia: null,   // { id, t, cartas } mientras las dos de arriba tienen el mismo número; id = seq en que se formó
    cerro: null,          // por qué dejó de haber coincidencia: { id, por, como: "movio"|"chin" }
    finPendiente: null,   // { jugador, hasta }: se quedó sin cartas pero dejó CHIN en la mesa
    trabado: null,        // { desde, listos: [bool, bool] }: nadie puede tirar ni reponer; cuando los dos tocan el mazo, va una de cada uno
    ultimaT: [ahora, ahora], jugadas: [0, 0],
    chins: [0, 0], llevadas: [0, 0],
    ultimo: null
  };
  s.mazos = mazos ? mazos.map((m) => [...m]) : [mezclar(s, mazoCompleto()), mezclar(s, mazoCompleto())];
  const ev = [];
  iniciarRonda(s, ahora, cuenta, ev);
  s.ultimo = null;
  return s;
}

function rellenar(s, j) {
  for (let i = 0; i < MANO; i++) if (s.mano[j][i] === null && s.mazos[j].length) s.mano[j][i] = s.mazos[j].shift();
}

/** Carta que `j` da vuelta al centro: de su mazo; si no tiene, del mazo del rival (se la da el otro). */
function cartaAlCentro(s, j) {
  if (s.mazos[j].length) return s.mazos[j].shift();
  if (s.mazos[otro(j)].length) return s.mazos[otro(j)].shift();
  return null;
}

/** Cada uno completa su mano a 5 y da vuelta una carta del mazo en una pila. Se juega desde `ahora + espera`. */
function iniciarRonda(s, ahora, espera, ev) {
  s.ronda++;
  rellenar(s, 0); rellenar(s, 1);
  const cartas = [cartaAlCentro(s, 0), cartaAlCentro(s, 1)];
  // sin mazos en ningún lado: cada uno pone la primera carta de su mano (pasa poco, pero la ronda tiene que arrancar)
  for (const j of [0, 1]) {
    if (cartas[j] !== null) continue;
    const i = s.mano[j].findIndex(Boolean);
    if (i >= 0) cartas[j] = sacarDeFila(s, j, i);
  }
  cartas.forEach((c, j) => { if (c !== null) s.pilas[j].push(c); });
  s.arranca = ahora + espera;
  s.coincidencia = null; s.cerro = null; s.trabado = null;
  ev.push({ t: "ronda", n: s.ronda, cartas, arranca: s.arranca });
  actualizarCoincidencia(s, s.arranca, ev, null);
  actualizarTrabado(s, ahora);
}

/** Lo que `j` puede hacer ahora. Con `ahora` también mira si ya arrancó. */
export function acciones(s, j, ahora = Infinity) {
  if (s.fase !== "jugando" || ahora < s.arranca) return [];
  const out = [];
  if (!s.finPendiente) {
    s.mano[j].forEach((c, i) => {
      for (const p of [0, 1]) if (encaja(c, tope(s.pilas[p]))) out.push({ t: "poner", carta: i, pila: p });
      if (c === null && s.mazos[j].length) out.push({ t: "reponer", carta: i });
      s.mano[j].forEach((_, k) => { if (sePuedeJuntar(s, j, i, k)) out.push({ t: "juntar", desde: i, hacia: k }); });
    });
  }
  if (s.trabado && !s.trabado.listos[j]) out.push({ t: "destrabar" });
  if (s.coincidencia) out.push({ t: "chin", visto: s.coincidencia.id });
  return out;
}

/**
 * ¿Alguno de los dos tiene una carta que vaya en alguna pila, un hueco que pueda llenar del mazo,
 * o dos del mismo número que pueda juntar para hacer lugar (si le quedan cartas en el mazo)?
 */
export function hayJugada(s) {
  const topes = s.pilas.map(tope);
  return [0, 1].some((j) => s.mano[j].some((c) => encaja(c, topes[0]) || encaja(c, topes[1])
    || (c === null && s.mazos[j].length > 0))
    || (s.mazos[j].length > 0 && puedeJuntar(s, j)));
}

function rechazo(s, motivo) {
  return { estado: s, eventos: [], rechazo: { motivo, mensaje: MENSAJES[motivo] } };
}

function actualizarCoincidencia(s, ahora, ev, jugador) {
  const a = tope(s.pilas[0]);
  const b = tope(s.pilas[1]);
  const habia = s.coincidencia;
  if (mismoNumero(a, b)) {
    s.coincidencia = { id: s.seq, t: ahora, cartas: [a, b] };
    s.cerro = null;
    ev.push({ t: "coincidencia", id: s.seq, carta: a });
  } else if (habia) {
    s.coincidencia = null;
    s.cerro = { id: habia.id, por: jugador, como: "movio" };
    ev.push({ t: "se_rompio", id: habia.id, por: jugador });
  }
}

function actualizarTrabado(s, ahora) {
  if (s.fase !== "jugando" || s.coincidencia || s.finPendiente || hayJugada(s)) { s.trabado = null; return; }
  if (!s.trabado) s.trabado = { desde: Math.max(ahora, s.arranca), listos: [false, false] };
}

function terminar(s, j, ev) {
  s.finPendiente = null; s.trabado = null;
  s.fase = "fin";
  s.ganador = j;
  ev.push({ t: "fin", ganador: j });
}

function revisarFin(s, ahora, ev) {
  if (s.fase !== "jugando") return;
  for (const j of [0, 1]) {
    if (!sinCartas(s, j)) continue;
    if (s.coincidencia) {
      if (!s.finPendiente) s.finPendiente = { jugador: j, hasta: ahora + s.ventanaFinal };
    } else terminar(s, j, ev);
    return;
  }
  s.finPendiente = null;
}

/**
 * Aplica una acción. No muta el estado recibido.
 * Acciones: { t: "poner", carta: 0..4 (lugar en la fila), pila: 0|1 } · { t: "reponer", carta: 0..4 } (una del mazo a ese hueco)
 * · { t: "juntar", desde, hacia } (apilo dos del mismo número en un lugar) · { t: "destrabar" } (toqué el mazo marcado) · { t: "chin", visto: id de la pareja que viste }.
 * Devuelve { estado, eventos } o { estado, eventos: [], rechazo: { motivo, mensaje } } si la acción llegó tarde
 * o no corresponde (carrera perdida, carta que no va…). Tira Error solo ante acciones mal formadas.
 */
export function aplicar(estado, jugador, accion, ahora = 0) {
  if (!accion || typeof accion.t !== "string") throw new Error("acción inválida");
  if (jugador !== 0 && jugador !== 1) throw new Error(`jugador inválido: ${jugador}`);
  if (estado.fase !== "jugando") return rechazo(estado, "fin");
  if (ahora < estado.arranca) return rechazo(estado, "no_arranco");

  if (accion.t === "poner") {
    const i = accion.carta, p = accion.pila;
    if (!Number.isInteger(i) || i < 0 || i >= MANO) throw new Error("lugar de la mano inválido");
    if (p !== 0 && p !== 1) throw new Error("pila inválida");
    if (estado.finPendiente) return rechazo(estado, "fin");
    const carta = estado.mano[jugador][i];
    if (!carta) return rechazo(estado, "sin_carta");
    if (!encaja(carta, tope(estado.pilas[p]))) return rechazo(estado, "no_va");

    const s = structuredClone(estado);
    const ev = [];
    s.seq++;
    s.pilas[p].push(carta);
    sacarDeFila(s, jugador, i);
    ev.push({ t: "poner", jugador, carta, pila: p, lugar: i, sube: s.mano[jugador][i] });
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    actualizarCoincidencia(s, ahora, ev, jugador);
    revisarFin(s, ahora, ev);
    actualizarTrabado(s, ahora);
    s.ultimo = ev[ev.length - 1];
    return { estado: s, eventos: ev };
  }

  if (accion.t === "reponer") {
    const i = accion.carta;
    if (!Number.isInteger(i) || i < 0 || i >= MANO) throw new Error("lugar de la mano inválido");
    if (estado.mano[jugador][i] !== null) return rechazo(estado, "lugar_ocupado");
    if (!estado.mazos[jugador].length) return rechazo(estado, "mazo_vacio");
    const s = structuredClone(estado);
    const ev = [];
    s.seq++;
    const carta = s.mazos[jugador].shift();
    s.mano[jugador][i] = carta;
    ev.push({ t: "reponer", jugador, carta, lugar: i });
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    actualizarTrabado(s, ahora);
    s.ultimo = ev[0];
    return { estado: s, eventos: ev };
  }

  if (accion.t === "juntar") {
    const i = accion.desde, k = accion.hacia;
    if (![i, k].every((x) => Number.isInteger(x) && x >= 0 && x < MANO) || i === k) throw new Error("lugares inválidos");
    const a = estado.mano[jugador][i], b = estado.mano[jugador][k];
    if (!a || !b) return rechazo(estado, "sin_carta");
    if (!mismoNumero(a, b)) return rechazo(estado, "otro_numero");
    if (enLugar(estado, jugador, i) + enLugar(estado, jugador, k) > TOPE_PILA) return rechazo(estado, "pila_llena");
    const s = structuredClone(estado);
    const ev = [];
    s.seq++;
    const d = s.debajo[jugador];
    d[k].push(s.mano[jugador][k], ...d[i]);
    s.mano[jugador][k] = a;
    s.mano[jugador][i] = null;
    d[i] = [];
    ev.push({ t: "juntar", jugador, desde: i, hacia: k, carta: a, n: d[k].length + 1 });
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    actualizarTrabado(s, ahora);
    s.ultimo = ev[0];
    return { estado: s, eventos: ev };
  }

  if (accion.t === "destrabar") {
    if (!estado.trabado) return rechazo(estado, "no_trabado");
    if (estado.trabado.listos[jugador]) return { estado, eventos: [] };
    const s = structuredClone(estado);
    const ev = [{ t: "listo", jugador }];
    s.trabado.listos[jugador] = true;
    s.ultimaT[jugador] = ahora;
    if (s.trabado.listos[0] && s.trabado.listos[1]) destrabar(s, ahora, ev);
    s.ultimo = ev[ev.length - 1];
    return { estado: s, eventos: ev };
  }

  if (accion.t === "chin") {
    const c = estado.coincidencia;
    const visto = accion.visto ?? null;
    if (!c) {
      const cerro = estado.cerro;
      if (visto !== null && cerro && cerro.id === visto) {
        if (cerro.como === "chin") return rechazo(estado, cerro.por === jugador ? "no_coincide" : "rival_chin");
        return rechazo(estado, cerro.por === jugador ? "moviste_vos" : "rival_movio");
      }
      return rechazo(estado, visto !== null ? "rival_movio" : "no_coincide");
    }
    if (visto !== null && visto !== c.id) return rechazo(estado, "rival_movio");

    // CHIN válido: el otro se lleva las dos pilas (mezcladas, abajo de su mazo) y arranca otra ronda
    const s = structuredClone(estado);
    const ev = [];
    s.seq++;
    const perdedor = otro(jugador);
    const llevadas = [...s.pilas[0], ...s.pilas[1]];
    s.mazos[perdedor].push(...mezclar(s, llevadas));
    s.pilas = [[], []];
    s.coincidencia = null;
    s.finPendiente = null;
    s.cerro = { id: c.id, por: jugador, como: "chin" };
    s.chins[jugador]++;
    s.llevadas[perdedor] += llevadas.length;
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    ev.push({
      t: "chin", jugador, perdedor, cartas: llevadas, carta: c.cartas[0],
      reaccion: Math.max(0, ahora - c.t)   // ms desde que apareció la pareja hasta que llegó el CHIN
    });
    s.ultimo = ev[0];
    if (sinCartas(s, jugador)) { terminar(s, jugador, ev); return { estado: s, eventos: ev }; }
    iniciarRonda(s, ahora, s.pausaRonda, ev);
    // iniciarRonda limpia `cerro`: lo dejamos apuntando a este CHIN para explicarle al que llegó tarde
    if (!s.coincidencia) s.cerro = { id: c.id, por: jugador, como: "chin" };
    return { estado: s, eventos: ev };
  }

  throw new Error(`acción desconocida: ${accion.t}`);
}

/** Lo que pasa solo con el tiempo: vence la ventana final y, si el CHIN sigue en la mesa, gana el que se quedó sin cartas. */
export function reloj(estado, ahora) {
  if (estado.fase !== "jugando") return { estado, eventos: [] };
  if (estado.finPendiente && ahora >= estado.finPendiente.hasta) {
    const s = structuredClone(estado);
    const ev = [];
    terminar(s, s.finPendiente.jugador, ev);
    s.ultimo = ev[0];
    return { estado: s, eventos: ev };
  }
  return { estado, eventos: [] };
}

/**
 * Los dos tocaron el mazo: va una carta de cada mazo a cada pila al mismo tiempo (si uno no tiene, se la da el rival;
 * si no hay mazos, se mezcla cada pila y queda otra arriba; si tampoco, cada uno tira la primera de su fila).
 */
function destrabar(s, ahora, ev) {
  {
    s.seq++;
    s.trabado = null;
    const cartas = [cartaAlCentro(s, 0), cartaAlCentro(s, 1)];
    let como = "mazo";
    if (cartas[0] === null && cartas[1] === null) {
      if (s.pilas.some((p) => p.length > 1)) {
        como = "mezcla";
        s.pilas = s.pilas.map((p) => mezclar(s, p));
      } else {
        // ni mazos ni pilas para mezclar: cada uno tira la primera carta de su mano
        como = "mano";
        for (const j of [0, 1]) {
          const i = s.mano[j].findIndex(Boolean);
          if (i >= 0) cartas[j] = sacarDeFila(s, j, i);
        }
      }
    }
    cartas.forEach((c, j) => { if (c !== null) s.pilas[j].push(c); });
    ev.push({ t: "destrabe", cartas, como, topes: s.pilas.map(tope) });
    actualizarCoincidencia(s, ahora, ev, null);
    revisarFin(s, ahora, ev);
    actualizarTrabado(s, ahora);
  }
}

/** Estado filtrado para `j`: sin el contenido de los mazos. Las manos están boca arriba: las ven los dos. */
export function vista(s, j) {
  return {
    juego: "chin", yo: j, nombres: s.nombres, fase: s.fase, ganador: s.ganador, ronda: s.ronda,
    arranca: s.arranca, ventanaFinal: s.ventanaFinal,
    cartas: [cartasDe(s, 0), cartasDe(s, 1)],           // cuántas le quedan a cada uno (mazo + mano)
    enMazo: [s.mazos[0].length, s.mazos[1].length],
    mano: [[...s.mano[0]], [...s.mano[1]]],
    apiladas: s.debajo.map((f) => f.map((d) => d.length)),   // cuántas hay debajo de la de arriba en cada lugar
    pilas: s.pilas.map((p) => ({ tope: tope(p), n: p.length })),
    coincidencia: s.coincidencia ? { id: s.coincidencia.id, t: s.coincidencia.t, carta: s.coincidencia.cartas[0] } : null,
    finPendiente: s.finPendiente ? { ...s.finPendiente } : null,
    trabado: s.trabado ? { desde: s.trabado.desde, listos: [...s.trabado.listos] } : null,
    chins: [...s.chins], llevadas: [...s.llevadas],
    ultimo: s.ultimo, seq: s.seq,
    acciones: acciones(s, j)
  };
}

/** Contrato de plataforma (docs/contrato-juego.md): lo que registro.js necesita de este juego. */
export const juego = {
  id: "chin", nombre: "CHIN", jugadores: [2, 2],
  nuevaPartida, aplicar, vista, acciones, reloj
};
