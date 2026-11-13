// Fuente de partida LOCAL de CHIN: el motor, el bot y el reloj viven en este navegador.
// La pantalla (mesa.js) solo conoce esta interfaz, así que en la tanda de red se cambia por una fuente de PeerJS:
//   { yo, ahora(), vista(), enviar(accion) → rechazo|null, suscribir(fn(vista, eventos)) → baja, revancha(), destruir() }

import { nuevaPartida, aplicar, reloj, vista } from "./motor.js";
import { bot } from "./bot.js";
import { respuestaBot, valido as emoteValido } from "../../nucleo/emotes.js";

export const NOMBRES_BOT = { tranquilo: "Don Tranqui", rapido: "Rata", implacable: "El Relámpago" };

export function crearLocal({ dificultad = "rapido", nombre = "Vos", estilo = {}, cuenta = 3000 } = {}) {
  const ahora = () => performance.now();
  const nombres = [nombre, NOMBRES_BOT[dificultad] || "Bot"];
  const subs = new Set(), subsE = new Set();
  const estilosBot = { tranquilo: { cara: 3 }, rapido: { cara: 4 }, implacable: { cara: 5 } };
  let estado = null;
  let timer = null;
  let botPausado = false;   // solo para pruebas

  const emitir = (ev) => { const v = vista(estado, 0); subs.forEach((f) => f(v, ev)); };
  const nueva = () => { estado = nuevaPartida({ nombres, ahora: ahora(), cuenta }); };

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

  return {
    yo: 0, nombres, dificultad, esLocal: true,
    ahora,
    vista: () => vista(estado, 0),
    enviar(accion) {
      try {
        const r = aplicar(estado, 0, accion, ahora());
        if (r.rechazo) return r.rechazo;
        estado = r.estado;
        emitir(r.eventos);
      } catch { /* acción que no corresponde (p. ej. dar vuelta con una carta ya dada vuelta): se ignora */ }
      return null;
    },
    suscribir(fn) { subs.add(fn); return () => subs.delete(fn); },
    jugadores: () => [{ nombre, estilo, id: null }, { nombre: nombres[1], estilo: estilosBot[dificultad] || {}, id: null }],
    emote(k) {
      if (!emoteValido(k)) return;
      const r = respuestaBot(k);
      if (r) setTimeout(() => subsE.forEach((f) => f(r, 1)), 700 + Math.random() * 900);
    },
    suscribirEmote(fn) { subsE.add(fn); return () => subsE.delete(fn); },
    suscribirConexion() { return () => {}; },
    latencia: () => 0,
    pausarBot(v) { botPausado = !!v; },   // solo para pruebas
    _armar(e) { estado = e; emitir([{ t: "revancha" }]); },   // solo para pruebas: cambia el estado entero
    revancha() { nueva(); emitir([{ t: "revancha" }]); },
    destruir() { clearInterval(timer); subs.clear(); subsE.clear(); },
  };
}
