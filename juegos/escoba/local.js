// Fuente de partida LOCAL de la escoba: el motor y los bots viven en este navegador. Misma interfaz que la de red:
//   { yo, nombres, ahora(), vista(), enviar(accion) → rechazo|null, suscribir(fn(vista, eventos)) → baja,
//     jugadores(), emote(k), suscribirEmote, suscribirDicho, suscribirConexion, latencia(), revancha(), destruir() }
// De a 2: vos contra un bot. De a 4: vos (asiento 0) y tu compañero (asiento 2) contra los otros dos personajes
// (1 a tu derecha, 3 a tu izquierda). La dificultad la da el compañero que elegís: con El Relámpago de socio es fácil.
import { nuevaPartida, aplicar, reloj, vista } from "./motor.js";
import { bot } from "./bot.js";
import { personaje, charla4 } from "./personajes.js";
import { respuestaBot, valido as emoteValido } from "../../nucleo/emotes.js";

const azar = (a) => a[Math.floor(Math.random() * a.length)];
export const DIFICULTADES_4 = ["tranquilo", "rapido", "implacable"];
/** De a 4: los bots de cada asiento según el compañero elegido ([null, derecha, compañero, izquierda]). */
export function asientos4(companero = "implacable") {
  const otros = DIFICULTADES_4.filter((k) => k !== companero);
  return [null, otros[0], companero, otros[1]];
}

/** `meta`: a cuántos puntos (15). `semilla`: reparto fijo (pruebas). `pausado`: los bots no juegan (pruebas). */
export function crearLocal({ dificultad = "rapido", jugadores = 2, companero = "implacable", nombre = "Vos", estilo = {}, meta = 15, semilla, callado = false, pausado = false } = {}) {
  const ahora = () => performance.now();
  const de4 = jugadores === 4;
  const difs = de4 ? asientos4(companero) : [null, dificultad];
  const pjs = difs.map((d) => (d ? personaje(d) : null));
  const nombres = difs.map((d, j) => (j === 0 ? nombre : pjs[j].nombre));
  const subs = new Set(), subsE = new Set(), subsD = new Set();
  let estado = null, botPausado = !!pausado, ultimoDicho = 0;

  function decir(j, momento, chance = 1) {
    if (callado || Math.random() > chance) return;
    const t = ahora();
    const final = momento.endsWith("gana") || momento.endsWith("pierde");
    if (!final && t - ultimoDicho < 4000) return;
    ultimoDicho = t;
    const txt = azar(pjs[j]?.frases[momento] || []);
    if (txt) setTimeout(() => subsD.forEach((f) => f(txt, j)), 700 + Math.random() * 500 + (final && j > 1 ? 1600 : 0));
  }
  function comentar(ev) {
    if (de4) { for (const c of charla4(ev, (j) => j !== 0)) decir(c.j, c.momento, c.chance); return; }
    for (const e of ev) {
      if (e.t === "jugada" && e.escoba) decir(1, e.jugador === 1 ? "escoba" : "escoba_rival", e.jugador === 1 ? 0.7 : 0.5);
      else if (e.t === "jugada" && e.levanta.concat(e.carta).includes("7-oro") && e.levanta.length) decir(1, e.jugador === 1 ? "siete_oro" : "siete_oro_rival", 0.6);
      else if (e.t === "soplo") decir(1, e.jugador === 1 ? "soplo" : "soplado", e.jugador === 1 ? 0.8 : 0.7);
      else if (e.t === "fin") decir(1, e.ganador === 1 ? "gana" : "pierde");
      else if (e.t === "revancha") setTimeout(() => decir(1, "empieza", 0.8), 600);
    }
  }
  const emitir = (ev) => { const v = vista(estado, 0); subs.forEach((f) => f(v, ev)); comentar(ev); };
  const nueva = (sem) => { estado = nuevaPartida({ nombres, jugadores: de4 ? 4 : 2, ahora: ahora(), meta, semilla: sem }); };

  function pulso() {
    if (estado.fase === "fin") return;
    const t = ahora();
    if (!botPausado) {
      for (let j = 1; j < difs.length; j++) {
        const a = bot(estado, j, t, difs[j]);
        if (!a) continue;
        const r = aplicar(estado, j, a, t);
        if (!r.rechazo) { estado = r.estado; emitir(r.eventos); break; }
      }
    }
    const rr = reloj(estado, t);
    if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
  }

  nueva(semilla);
  const inicial = estado.eventosIniciales || [];
  const timer = setInterval(pulso, 60);
  setTimeout(() => (de4 ? decir(2, "socio_empieza") : decir(1, "empieza")), 900);

  return {
    yo: 0, nombres, dificultad, esLocal: true, formato: 1, inicial,
    // la tiza y las jugadas solas: de a 2 contra Don Tranqui; de a 4 en la fácil (El Relámpago de compañero)
    ayuda: de4 ? companero === "implacable" : dificultad === "tranquilo",
    ahora,
    vista: () => vista(estado, 0),
    enviar(accion) {
      try {
        const r = aplicar(estado, 0, accion, ahora());
        if (r.rechazo) return r.rechazo;
        estado = r.estado;
        emitir(r.eventos);
      } catch { return { motivo: "mal", mensaje: "Esa jugada no se puede." }; }
      return null;
    },
    suscribir(fn) { subs.add(fn); return () => subs.delete(fn); },
    jugadores: () => difs.map((d, j) => (j === 0 ? { nombre, estilo, id: null } : { nombre: nombres[j], estilo: { cara: pjs[j].cara }, id: null, bot: d })),
    emote(k) {
      if (!emoteValido(k)) return;
      const r = respuestaBot(k);
      const j = de4 ? azar([1, 2, 3]) : 1;
      if (r) setTimeout(() => subsE.forEach((f) => f(r, j)), 700 + Math.random() * 900);
    },
    suscribirEmote(fn) { subsE.add(fn); return () => subsE.delete(fn); },
    suscribirDicho(fn) { subsD.add(fn); return () => subsD.delete(fn); },
    suscribirConexion() { return () => {}; },
    latencia: () => 0,
    pausarBot(v) { botPausado = !!v; },                         // pruebas
    _armar(e) { estado = e; emitir([{ t: "revancha" }]); },     // pruebas: cambia el estado entero
    _estado: () => estado,                                      // pruebas
    revancha() { nueva(); emitir([{ t: "revancha" }, ...(estado.eventosIniciales || [])]); },
    declinar() {},
    destruir() { clearInterval(timer); subs.clear(); subsE.clear(); subsD.clear(); },
  };
}
