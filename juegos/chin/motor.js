// Motor de CHIN (2 jugadores, tiempo real). Módulo ES sin DOM ni reloj propio:
// el tiempo entra como dato (`ahora`, en milisegundos) en cada llamada, así se prueba con semilla y reloj inyectado.
// El estado es un objeto plano serializable a JSON. El anfitrión es el árbitro: procesa las acciones
// en el orden en que le llegan y el que llega primero gana.
//
// Reglas (docs/chin/reglas.md): cada jugador tiene su propio mazo español completo de 48 cartas (1 a 12 en los
// cuatro palos, sin comodines), boca abajo; por eso puede haber dos «1 de copa» a la vez, uno de cada mazo. Cada uno da vuelta cartas de su mazo y las pone en una de las dos pilas del centro,
// sin turnos y sin pausa. Si las dos cartas de arriba son iguales (mismo número y mismo palo) se puede cantar CHIN:
// gana el que lo canta primero y el otro se lleva las dos pilas. Gana el primero que se queda sin cartas.

export const PALOS = ["espada", "basto", "oro", "copa"];
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const CARTAS_POR_JUGADOR = 48;

export const MENSAJES = {
  no_coincide: "Todavía no son iguales.",
  rival_movio: "El rival movió antes: ya no son iguales.",
  rival_chin: "El rival cantó CHIN antes.",
  moviste_vos: "Ya moviste: ya no son iguales.",
  no_arranco: "Todavía no arrancó.",
  sin_cartas: "No tenés cartas para dar vuelta.",
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

// ---------- Estado ----------

/**
 * @param {{nombres?: string[], semilla?: number, ahora?: number, cuenta?: number, ventanaFinal?: number}} opts
 * `cuenta`: ms de cuenta regresiva antes de que se pueda jugar (los dos arrancan parejos).
 * `ventanaFinal`: ms que el rival tiene para cantar CHIN si la última carta de alguien forma pareja.
 */
export function nuevaPartida({ nombres = ["Jugador 1", "Jugador 2"], semilla, ahora = 0, cuenta = 3000, ventanaFinal = 1500 } = {}) {
  const sem = Number.isFinite(semilla) ? semilla >>> 0 : Math.floor(Math.random() * 4294967296);
  const s = {
    juego: "chin", semilla: sem, rng: sem, nombres: [...nombres],
    seq: 0, fase: "jugando", ganador: null,
    arranca: ahora + cuenta, ventanaFinal,
    mazos: [[], []], mano: [null, null], pilas: [[], []],
    coincidencia: null,   // { id, t, cartas } mientras las dos de arriba son iguales; id = seq en que se formó
    cerro: null,          // por qué dejó de haber coincidencia: { id, por, como: "movio"|"chin" }
    finPendiente: null,   // { jugador, hasta }: se quedó sin cartas pero su última carta formó pareja
    ultimaT: [ahora, ahora], jugadas: [0, 0],
    chins: [0, 0], llevadas: [0, 0],
    ultimo: null
  };
  s.mazos = [mezclar(s, mazoCompleto()), mezclar(s, mazoCompleto())];
  return s;
}

const otro = (j) => 1 - j;
export const cartasDe = (s, j) => s.mazos[j].length + (s.mano[j] ? 1 : 0);
const sinCartas = (s, j) => s.mazos[j].length === 0 && s.mano[j] === null;
const tope = (pila) => (pila.length ? pila[pila.length - 1] : null);
export const mismaCarta = (a, b) => a !== null && b !== null && a === b;

/** Lo que `j` puede hacer ahora. Con `ahora` también mira si ya arrancó. */
export function acciones(s, j, ahora = Infinity) {
  if (s.fase !== "jugando" || ahora < s.arranca) return [];
  const out = [];
  if (!s.finPendiente && cartasDe(s, j) > 0) {
    if (s.mano[j] === null) out.push({ t: "voltear" });
    out.push({ t: "poner", pila: 0 }, { t: "poner", pila: 1 });
  }
  if (s.coincidencia) out.push({ t: "chin", visto: s.coincidencia.id });
  return out;
}

function rechazo(s, motivo) {
  return { estado: s, eventos: [], rechazo: { motivo, mensaje: MENSAJES[motivo] } };
}

function actualizarCoincidencia(s, ahora, ev, jugador) {
  const a = tope(s.pilas[0]);
  const b = tope(s.pilas[1]);
  const habia = s.coincidencia;
  if (a !== null && a === b) {
    s.coincidencia = { id: s.seq, t: ahora, cartas: [a, b] };
    s.cerro = null;
    ev.push({ t: "coincidencia", id: s.seq, carta: a });
  } else if (habia) {
    s.coincidencia = null;
    s.cerro = { id: habia.id, por: jugador, como: "movio" };
    ev.push({ t: "se_rompio", id: habia.id, por: jugador });
  }
}

function revisarFin(s, ahora, ev) {
  if (s.fase !== "jugando") return;
  for (const j of [0, 1]) {
    if (!sinCartas(s, j)) continue;
    if (s.coincidencia) {
      if (!s.finPendiente) s.finPendiente = { jugador: j, hasta: ahora + s.ventanaFinal };
    } else {
      s.finPendiente = null;
      s.fase = "fin";
      s.ganador = j;
      ev.push({ t: "fin", ganador: j });
    }
    return;
  }
  s.finPendiente = null;
}

function darVuelta(s, j, ev) {
  const carta = s.mazos[j].shift();
  s.mano[j] = carta;
  ev.push({ t: "voltear", jugador: j, carta });
}

/**
 * Aplica una acción. No muta el estado recibido.
 * Devuelve { estado, eventos } o { estado, eventos: [], rechazo: { motivo, mensaje } } si la acción llegó tarde
 * o no corresponde (carrera perdida, todavía no arrancó…). Tira Error solo ante acciones mal formadas.
 */
export function aplicar(estado, jugador, accion, ahora = 0) {
  if (!accion || typeof accion.t !== "string") throw new Error("acción inválida");
  if (jugador !== 0 && jugador !== 1) throw new Error(`jugador inválido: ${jugador}`);
  if (estado.fase !== "jugando") return rechazo(estado, "fin");
  if (ahora < estado.arranca) return rechazo(estado, "no_arranco");

  const s = structuredClone(estado);
  const ev = [];

  if (accion.t === "voltear" || accion.t === "poner") {
    if (s.finPendiente || cartasDe(s, jugador) === 0) return rechazo(estado, s.finPendiente ? "fin" : "sin_cartas");
    if (accion.t === "voltear") {
      if (s.mano[jugador] !== null) throw new Error("ya tenés una carta dada vuelta");
      s.seq++;
      darVuelta(s, jugador, ev);
    } else {
      if (accion.pila !== 0 && accion.pila !== 1) throw new Error("pila inválida");
      s.seq++;
      if (s.mano[jugador] === null) darVuelta(s, jugador, ev);   // un solo toque: da vuelta y pone
      const carta = s.mano[jugador];
      s.mano[jugador] = null;
      s.pilas[accion.pila].push(carta);
      ev.push({ t: "poner", jugador, carta, pila: accion.pila });
      actualizarCoincidencia(s, ahora, ev, jugador);
    }
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    revisarFin(s, ahora, ev);
    s.ultimo = ev[ev.length - 1] || s.ultimo;
    return { estado: s, eventos: ev };
  }

  if (accion.t === "chin") {
    const c = s.coincidencia;
    const visto = accion.visto ?? null;
    if (!c) {
      const cerro = s.cerro;
      if (visto !== null && cerro && cerro.id === visto) {
        if (cerro.como === "chin") return rechazo(estado, cerro.por === jugador ? "no_coincide" : "rival_chin");
        return rechazo(estado, cerro.por === jugador ? "moviste_vos" : "rival_movio");
      }
      return rechazo(estado, visto !== null ? "rival_movio" : "no_coincide");
    }
    if (visto !== null && visto !== c.id) return rechazo(estado, "rival_movio");

    // CHIN válido: el otro se lleva las dos pilas (mezcladas, abajo de su mazo)
    s.seq++;
    const perdedor = otro(jugador);
    const llevadas = [...s.pilas[0], ...s.pilas[1]];
    s.mazos[perdedor].push(...mezclar(s, llevadas));
    s.pilas = [[], []];
    s.coincidencia = null;
    s.cerro = { id: c.id, por: jugador, como: "chin" };
    s.chins[jugador]++;
    s.llevadas[perdedor] += llevadas.length;
    s.jugadas[jugador]++;
    s.ultimaT[jugador] = ahora;
    ev.push({
      t: "chin", jugador, perdedor, cartas: llevadas, carta: c.cartas[0],
      reaccion: Math.max(0, ahora - c.t)   // ms desde que apareció la pareja hasta que llegó el CHIN
    });
    revisarFin(s, ahora, ev);
    s.ultimo = ev[0];
    return { estado: s, eventos: ev };
  }

  throw new Error(`acción desconocida: ${accion.t}`);
}

/** Cierra la ventana final: si venció y la pareja sigue ahí, gana el que se quedó sin cartas. */
export function reloj(estado, ahora) {
  if (estado.fase !== "jugando" || !estado.finPendiente || ahora < estado.finPendiente.hasta) {
    return { estado, eventos: [] };
  }
  const s = structuredClone(estado);
  const ev = [];
  const j = s.finPendiente.jugador;
  s.finPendiente = null;
  s.fase = "fin";
  s.ganador = j;
  ev.push({ t: "fin", ganador: j });
  s.ultimo = ev[0];
  return { estado: s, eventos: ev };
}

/** Estado filtrado para `j`: sin el contenido de los mazos. Serializable a JSON. */
export function vista(s, j) {
  return {
    juego: "chin", yo: j, nombres: s.nombres, fase: s.fase, ganador: s.ganador,
    arranca: s.arranca, ventanaFinal: s.ventanaFinal,
    cartas: [cartasDe(s, 0), cartasDe(s, 1)],           // cuántas le quedan a cada uno (mazo + la de la mano)
    enMazo: [s.mazos[0].length, s.mazos[1].length],
    mano: [...s.mano],                                  // la carta dada vuelta de cada uno: la ven los dos
    pilas: s.pilas.map((p) => ({ tope: tope(p), n: p.length })),
    coincidencia: s.coincidencia ? { id: s.coincidencia.id, t: s.coincidencia.t, carta: s.coincidencia.cartas[0] } : null,
    finPendiente: s.finPendiente ? { ...s.finPendiente } : null,
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
