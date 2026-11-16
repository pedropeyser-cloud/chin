// Fuente de partida LOCAL de CHIN: el motor, el bot y el reloj viven en este navegador.
// La pantalla (mesa.js) solo conoce esta interfaz, así que en la tanda de red se cambia por una fuente de PeerJS:
//   { yo, ahora(), vista(), enviar(accion) → rechazo|null, suscribir(fn(vista, eventos)) → baja, revancha(), destruir() }
// Además: `formato` (1 = partida suelta, 3 = al mejor de 3), `suscribirDicho(fn(texto, jugador))` (lo que dice el bot)
// y el evento extra `carrera {ganador, margen}` (por cuántos ms se ganó un CHIN, cuando se sabe).

import { nuevaPartida, aplicar, reloj, vista } from "./motor.js";
import { bot, demoraChin } from "./bot.js";
import { personaje, PERSONAJES } from "./personajes.js";
import { respuestaBot, valido as emoteValido } from "../../nucleo/emotes.js";

export const NOMBRES_BOT = Object.fromEntries(Object.entries(PERSONAJES).map(([k, p]) => [k, p.nombre]));
const azar = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * @param {object} o
 * `semilla`: reparto fijo para la primera partida (desafío del día); las revanchas son al azar.
 * `inicial(ahora) → estado`: estado armado a mano (tutorial). `callado`: el bot no habla. `pausado`: el bot no juega.
 */
export function crearLocal({ dificultad = "rapido", nombre = "Vos", estilo = {}, cuenta = 3000, semilla, inicial, formato = 1, callado = false, pausado = false } = {}) {
  const ahora = () => performance.now();
  const pj = personaje(dificultad);
  const nombres = [nombre, pj.nombre];
  const subs = new Set(), subsE = new Set(), subsD = new Set();
  let estado = null;
  let timer = null;
  let botPausado = !!pausado;
  let primera = true, ultimoDicho = 0, eraTrabado = false;

  // el bot habla de a ratos: nunca dos frases seguidas en menos de 3,5 s, y no en cada CHIN
  function decir(momento, chance = 1) {
    if (callado || Math.random() > chance) return;
    const t = ahora();
    if (momento !== "gana" && momento !== "pierde" && t - ultimoDicho < 3500) return;
    ultimoDicho = t;
    const txt = azar(pj.frases[momento] || []);
    if (txt) setTimeout(() => subsD.forEach((f) => f(txt, 1)), 350 + Math.random() * 450);
  }
  function comentar(ev) {
    for (const e of ev) {
      if (e.t === "chin") decir(e.jugador === 1 ? "gana_chin" : "pierde_chin", e.jugador === 1 ? 0.6 : 0.45);
      else if (e.t === "fin") decir(e.ganador === 1 ? "gana" : "pierde");
      else if (e.t === "revancha") setTimeout(() => decir("empieza", 0.8), 600);
    }
    const tr = !!estado.trabado;
    if (tr && !eraTrabado) decir("trabado", 0.5);
    eraTrabado = tr;
  }

  const emitir = (ev) => { const v = vista(estado, 0); subs.forEach((f) => f(v, ev)); comentar(ev); };
  const nueva = () => {
    estado = primera && inicial ? inicial(ahora()) : nuevaPartida({ nombres, ahora: ahora(), cuenta, semilla: primera ? semilla : undefined });
    primera = false;
    eraTrabado = false;
  };

  function pulso() {
    if (estado.fase !== "jugando") return;
    const t = ahora();
    const a = botPausado ? null : bot(estado, 1, t, dificultad);
    if (a) {
      const r = aplicar(estado, 1, a, t);
      if (!r.rechazo) { estado = r.estado; emitir(r.eventos); }
    }
    const rr = reloj(estado, t);
    if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
  }

  nueva();
  timer = setInterval(pulso, 20);
  setTimeout(() => decir("empieza"), 900);

  return {
    yo: 0, nombres, dificultad, esLocal: true, formato: formato === 3 ? 3 : 1,
    ahora,
    vista: () => vista(estado, 0),
    enviar(accion) {
      try {
        const t = ahora();
        // por cuánto le gano al bot: lo que él habría tardado en cantar esta pareja
        const suya = accion.t === "chin" && estado.coincidencia && !botPausado ? demoraChin(estado, 1, dificultad) : null;
        const r = aplicar(estado, 0, accion, t);
        if (r.rechazo) {
          if (r.rechazo.tarde !== undefined && r.rechazo.tarde <= 1500) subs.forEach((f) => f(vista(estado, 0), [{ t: "carrera", ganador: 1, margen: r.rechazo.tarde }]));
          return r.rechazo;
        }
        estado = r.estado;
        const ev = [...r.eventos];
        const chin = ev.find((e) => e.t === "chin");
        if (chin && suya !== null && suya - chin.reaccion > 0 && suya - chin.reaccion < 4000) ev.push({ t: "carrera", ganador: 0, margen: suya - chin.reaccion });
        emitir(ev);
      } catch { /* acción que no corresponde (p. ej. dar vuelta con una carta ya dada vuelta): se ignora */ }
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
    pausarBot(v) { botPausado = !!v; },   // pruebas y tutorial
    _armar(e) { estado = e; emitir([{ t: "revancha" }]); },   // solo para pruebas: cambia el estado entero
    /** Tutorial: el rival juega una acción armada (sin pasar por el bot). */
    jugarRival(accion) {
      const r = aplicar(estado, 1, accion, ahora());
      if (!r.rechazo) { estado = r.estado; emitir(r.eventos); }
      return r.rechazo || null;
    },
    revancha() { nueva(); emitir([{ t: "revancha" }]); },
    declinar() {},
    destruir() { clearInterval(timer); subs.clear(); subsE.clear(); subsD.clear(); },
  };
}
