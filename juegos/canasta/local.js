// Fuente de partida LOCAL de la canasta: el motor y el bot viven en este navegador. Misma interfaz que la de red:
//   { yo, nombres, ahora(), vista(), enviar(accion) → rechazo|null, suscribir(fn(vista, eventos)) → baja,
//     jugadores(), emote(k), suscribirEmote, suscribirDicho, suscribirConexion, latencia(), revancha(), destruir() }
import { nuevaPartida, aplicar, reloj, vista } from "./motor.js";
import { bot } from "./bot.js";
import { personaje } from "./personajes.js";
import { respuestaBot, valido as emoteValido } from "../../nucleo/emotes.js";

const azar = (a) => a[Math.floor(Math.random() * a.length)];

/** `meta`: a cuántos puntos (5000). `semilla`: reparto fijo (pruebas). `pausado`: el bot no juega (pruebas). */
export function crearLocal({ dificultad = "rapido", nombre = "Vos", estilo = {}, meta = 5000, semilla, callado = false, pausado = false } = {}) {
  const ahora = () => performance.now();
  const pj = personaje(dificultad);
  const nombres = [nombre, pj.nombre];
  const subs = new Set(), subsE = new Set(), subsD = new Set();
  let estado = null, botPausado = !!pausado, ultimoDicho = 0;

  function decir(momento, chance = 1) {
    if (callado || Math.random() > chance) return;
    const t = ahora();
    if (momento !== "gana" && momento !== "pierde" && t - ultimoDicho < 5000) return;
    ultimoDicho = t;
    const txt = azar(pj.frases[momento] || []);
    if (txt) setTimeout(() => subsD.forEach((f) => f(txt, 1)), 700 + Math.random() * 500);
  }
  function comentar(ev) {
    for (const e of ev) {
      if (e.t === "canasta") decir(e.jugador === 1 ? "canasta" : "canasta_rival", e.jugador === 1 ? 0.6 : 0.45);
      else if (e.t === "pozo" && e.n >= 5) decir(e.jugador === 1 ? "pozo" : "pozo_rival", 0.6);
      else if (e.t === "cierre") decir(e.jugador === 1 ? "cierre" : "cierre_rival", 0.9);
      else if (e.t === "fin") decir(e.ganador === 1 ? "gana" : "pierde");
      else if (e.t === "revancha") setTimeout(() => decir("empieza", 0.8), 600);
    }
  }
  const emitir = (ev) => { const v = vista(estado, 0); subs.forEach((f) => f(v, ev)); comentar(ev); };
  const nueva = (sem) => { estado = nuevaPartida({ nombres, ahora: ahora(), meta, semilla: sem }); };

  function pulso() {
    if (estado.fase === "fin") return;
    const t = ahora();
    const a = botPausado ? null : bot(estado, 1, t, dificultad);
    if (a) {
      const r = aplicar(estado, 1, a, t);
      if (!r.rechazo) { estado = r.estado; emitir(r.eventos); }
    }
    const rr = reloj(estado, t);
    if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
  }

  nueva(semilla);
  const inicial = estado.eventosIniciales || [];
  const timer = setInterval(pulso, 60);
  setTimeout(() => decir("empieza"), 900);

  return {
    yo: 0, nombres, dificultad, esLocal: true, formato: 1, inicial,
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
    jugadores: () => [{ nombre, estilo, id: null }, { nombre: nombres[1], estilo: { cara: pj.cara }, id: null }],
    emote(k) {
      if (!emoteValido(k)) return;
      const r = respuestaBot(k);
      if (r) setTimeout(() => subsE.forEach((f) => f(r, 1)), 700 + Math.random() * 900);
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
