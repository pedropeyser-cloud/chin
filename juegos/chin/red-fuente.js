// Fuentes de partida por RED para CHIN (misma interfaz que local.js, ver docs/contrato-juego.md):
//   { yo, nombres, ahora(), vista(), enviar(accion) → rechazo|null|Promise, suscribir(fn(vista, eventos)) → baja,
//     jugadores() → [{ nombre, estilo, id }], emote(k), suscribirEmote(fn(k, jugador)) → baja,
//     suscribirConexion(fn("conectado"|"cortado")) → baja, revancha(), destruir() }
//
// Justicia de la red: el anfitrión aplica las acciones en el orden en que le llegan. Las del invitado ya viajaron
// medio ping, así que las del anfitrión esperan ese mismo medio ping (tope 150 ms) antes de aplicarse. Con eso un CHIN
// cantado primero por el invitado no se pierde por la demora de la red. La latencia se mide con pings.

import { nuevaPartida, aplicar, reloj, vista } from "./motor.js";
import { abrirSala, entrarSala, codigoNuevo, linkDe } from "../../nucleo/red.js";
import { valido as emoteValido, tope as topeEmote } from "../../nucleo/emotes.js";

export const TOPE_COMPENSACION_MS = 150;
const ahora = () => performance.now();

const limpiarNombre = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) || "Rival";
const ESTILO_OK = { cara: (x) => Number.isInteger(x) && x >= 0 && x < 6, dorso: (x) => typeof x === "string" && /^[a-z]{2,12}$/.test(x), pano: (x) => typeof x === "string" && /^[a-z]{2,12}$/.test(x) };
/** Solo pasan las claves conocidas con valores chicos y de forma esperada: lo que manda el otro navegador no es de fiar. */
export function limpiarEstilo(e) {
  const out = {};
  if (e && typeof e === "object") for (const k of Object.keys(ESTILO_OK)) if (k in e && ESTILO_OK[k](e[k])) out[k] = e[k];
  return out;
}
const idOk = (x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);

function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "poner" && (a.pila === 0 || a.pila === 1) && Number.isInteger(a.carta) && a.carta >= 0 && a.carta < 5) return { t: "poner", carta: a.carta, pila: a.pila };
  if (a.t === "reponer" && Number.isInteger(a.carta) && a.carta >= 0 && a.carta < 5) return { t: "reponer", carta: a.carta };
  if (a.t === "destrabar") return { t: "destrabar" };
  if (a.t === "juntar" && [a.desde, a.hacia].every((x) => Number.isInteger(x) && x >= 0 && x < 5) && a.desde !== a.hacia) return { t: "juntar", desde: a.desde, hacia: a.hacia };
  if (a.t === "chin") return { t: "chin", visto: Number.isInteger(a.visto) ? a.visto : null };
  return null;
}


// ---------- lo que llega del anfitrión no es de fiar: se reconstruye campo por campo ----------
const ent = (x, max = 1000) => (Number.isInteger(x) && x >= 0 && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const lado = (x) => (x === 0 || x === 1 ? x : 0);
const cartaOk = (c) => (typeof c === "string" && /^([1-9]|1[0-2])-(espada|basto|oro|copa)$/.test(c) ? c : null);
const par = (a, f) => [f(a?.[0]), f(a?.[1])];
const manoOk = (m) => Array.from({ length: 5 }, (_, i) => cartaOk(Array.isArray(m) ? m[i] : null));
/** Vista del anfitrión → vista con solo los campos y tipos que la pantalla espera. */
export function vistaLimpia(v) {
  const pilas = [0, 1].map((i) => ({ tope: cartaOk(v.pilas?.[i]?.tope), n: ent(v.pilas?.[i]?.n, 400) }));
  const c = v.coincidencia;
  return {
    juego: "chin", yo: 1, nombres: ["", ""],
    fase: v.fase === "fin" ? "fin" : "jugando", ronda: ent(v.ronda, 1e6),
    ganador: v.ganador === 0 || v.ganador === 1 ? v.ganador : null,
    arranca: num(v.arranca), ventanaFinal: num(v.ventanaFinal),
    cartas: par(v.cartas, (x) => ent(x, 400)), enMazo: par(v.enMazo, (x) => ent(x, 400)),
    mano: par(v.mano, manoOk), pilas,
    apiladas: par(v.apiladas, (f) => Array.from({ length: 5 }, (_, i) => ent(Array.isArray(f) ? f[i] : 0, 48))),
    coincidencia: c && Number.isInteger(c.id) ? { id: c.id, t: num(c.t), carta: cartaOk(c.carta) } : null,
    finPendiente: v.finPendiente && typeof v.finPendiente === "object" ? { jugador: lado(v.finPendiente.jugador), hasta: num(v.finPendiente.hasta) } : null,
    trabado: v.trabado && typeof v.trabado === "object" ? { desde: num(v.trabado.desde), listos: par(v.trabado.listos, (x) => x === true) } : null,
    chins: par(v.chins, (x) => ent(x, 400)), llevadas: par(v.llevadas, (x) => ent(x, 4000)),
    ultimo: null, seq: ent(v.seq, 1e9), acciones: [],
  };
}
/** Eventos: solo los tipos conocidos y con campos del tipo esperado. */
export function eventosLimpios(ev) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    switch (e.t) {
      case "poner": out.push({ t: "poner", jugador: lado(e.jugador), carta: cartaOk(e.carta), pila: lado(e.pila), lugar: ent(e.lugar, 4), sube: cartaOk(e.sube) }); break;
      case "juntar": out.push({ t: "juntar", jugador: lado(e.jugador), desde: ent(e.desde, 4), hacia: ent(e.hacia, 4), carta: cartaOk(e.carta), n: ent(e.n, 48) }); break;
      case "reponer": out.push({ t: "reponer", jugador: lado(e.jugador), carta: cartaOk(e.carta), lugar: ent(e.lugar, 4) }); break;
      case "listo": out.push({ t: "listo", jugador: lado(e.jugador) }); break;
      case "ronda": out.push({ t: "ronda", n: ent(e.n, 1e6), cartas: par(e.cartas, cartaOk), arranca: num(e.arranca) }); break;
      case "destrabe": out.push({ t: "destrabe", cartas: par(e.cartas, cartaOk), como: ["mazo", "mezcla", "mano"].includes(e.como) ? e.como : "mazo", topes: par(e.topes, cartaOk) }); break;
      case "coincidencia": out.push({ t: "coincidencia", id: ent(e.id, 1e9), carta: cartaOk(e.carta) }); break;
      case "se_rompio": out.push({ t: "se_rompio", id: ent(e.id, 1e9), por: lado(e.por) }); break;
      case "chin": out.push({ t: "chin", jugador: lado(e.jugador), perdedor: lado(e.perdedor), reaccion: Math.max(0, Math.min(60000, num(e.reaccion))) }); break;
      case "fin": out.push({ t: "fin", ganador: lado(e.ganador) }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: lado(e.jugador) }); break;
      default:
    }
  }
  return out;
}

function base() {
  const subs = new Set(), subsE = new Set(), subsC = new Set();
  return {
    subs, subsE, subsC,
    suscribir(fn) { subs.add(fn); return () => subs.delete(fn); },
    suscribirEmote(fn) { subsE.add(fn); return () => subsE.delete(fn); },
    suscribirConexion(fn) { subsC.add(fn); return () => subsC.delete(fn); },
    conexion(estado) { subsC.forEach((f) => f(estado)); },
  };
}

/**
 * Anfitrión. `yo` = { nombre, estilo, id }. Devuelve { codigo, link, fuente, alEntrar(fn), empezar(), cerrar() }.
 * La partida no existe hasta `empezar()` (cuando entró el invitado).
 */
export function crearAnfitrion(yo, { cuenta = 3000 } = {}) {
  const b = base();
  const codigo = codigoNuevo();
  let estado = null, conectado = false, owd = 0, timer = null, abierta = false;
  const rival = { nombre: "Rival", estilo: {}, id: null };
  const quieren = [false, false];
  const topeE = topeEmote();
  let aviso = { entro: null, error: null, abrio: null };
  let ultimoPing = 0, cortadoAviso = false;

  const jug = () => [{ nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) }, { ...rival }];
  const mandar = (ev) => sala.enviar({ t: "vista", v: vista(estado, 1), ev, jug: jug(), th: ahora() });
  const emitir = (ev) => { b.subs.forEach((f) => f(vista(estado, 0), ev)); if (conectado) mandar(ev); };

  function aplicarReal(j, accion) {
    try {
      const r = aplicar(estado, j, accion, ahora());
      if (r.rechazo) return r.rechazo;
      estado = r.estado;
      emitir(r.eventos);
    } catch { /* acción que no corresponde: se ignora */ }
    return null;
  }
  function nueva() {
    estado = nuevaPartida({ nombres: [limpiarNombre(yo.nombre), rival.nombre], ahora: ahora(), cuenta });
    quieren[0] = quieren[1] = false;
  }

  const sala = abrirSala(codigo, {
    alAbrir: () => { abierta = true; aviso.abrio?.(); },
    alEntrar: () => { conectado = true; ultimoPing = ahora(); cortadoAviso = false; aviso.entro?.(); b.conexion("conectado"); if (estado) mandar([{ t: "revancha" }]); },
    alSalir: () => { conectado = false; b.conexion("cortado"); },
    alError: (e) => aviso.error?.(e),
    alMensaje: (m) => {
      switch (m.t) {
        case "hola":
          rival.nombre = limpiarNombre(m.nombre); rival.estilo = limpiarEstilo(m.estilo); rival.id = idOk(m.id);
          if (estado) { estado.nombres[1] = rival.nombre; mandar([]); }
          break;
        case "ping":
          ultimoPing = ahora();
          if (cortadoAviso) { cortadoAviso = false; b.conexion("conectado"); }
          if (Number.isFinite(m.rtt) && m.rtt >= 0) owd = Math.min(5000, m.rtt) / 2;
          sala.enviar({ t: "pong", t0: m.t0, th: ahora() });
          break;
        case "accion": {
          if (!estado) return;
          const a = accionLimpia(m.a);
          const r = a ? aplicarReal(1, a) : null;
          sala.enviar({ t: "resp", n: m.n, r });
          break;
        }
        case "revancha":
          if (!estado || estado.fase !== "fin") return;
          quieren[1] = true;
          if (quieren[0]) { nueva(); emitir([{ t: "revancha" }]); } else emitir([{ t: "quiere_revancha", jugador: 1 }]);
          break;
        case "emote":
          if (emoteValido(m.k) && topeE(1)) { b.subsE.forEach((f) => f(m.k, 1)); }
          break;
        default:
      }
    },
  });

  const fuente = {
    yo: 0, esLocal: false, esAnfitrion: true, ahora,
    get nombres() { return estado ? estado.nombres : [limpiarNombre(yo.nombre), rival.nombre]; },
    vista: () => vista(estado, 0),
    jugadores: jug,
    enviar(accion) {
      const demora = Math.min(owd, TOPE_COMPENSACION_MS);
      if (demora < 4) return aplicarReal(0, accion);
      return new Promise((res) => setTimeout(() => res(aplicarReal(0, accion)), demora));
    },
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() {
      if (!estado || estado.fase !== "fin") return;
      quieren[0] = true;
      if (quieren[1]) { nueva(); emitir([{ t: "revancha" }]); } else emitir([{ t: "quiere_revancha", jugador: 0 }]);
    },
    /** Lo que mide el anfitrión: ida del invitado en ms (para mostrarlo con honestidad). */
    latencia: () => Math.round(owd),
    destruir() { clearInterval(timer); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); },
  };

  return {
    codigo, link: linkDe(codigo), fuente, rival,
    alAbrir(fn) { aviso.abrio = fn; if (abierta) fn(); },
    alEntrar(fn) { aviso.entro = fn; },
    alError(fn) { aviso.error = fn; },
    empezar() {
      nueva();
      timer = setInterval(() => {
        if (conectado && !cortadoAviso && ahora() - ultimoPing > 7000) { cortadoAviso = true; b.conexion("cortado"); }   // el invitado dejó de dar señales
        if (!estado) return;
        const rr = reloj(estado, ahora());
        if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
      }, 20);
      mandar([{ t: "revancha" }]);
    },
    cerrar: fuente.destruir,
  };
}

/** Invitado. Devuelve { fuente, alListo(fn), alError(fn) }. `alListo` avisa cuando llegó la primera vista. */
export function entrarComoInvitado(codigo, yo) {
  const b = base();
  let v = null, offset = 0, rtt = 0, n = 0, jug = [{ nombre: "Anfitrión", estilo: {}, id: null }, { nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) }];
  const pend = new Map();
  let ultimoPong = 0, cortadoAviso = false, vigia = null;
  let pingT = null, listo = null, error = null, nombres = [jug[0].nombre, jug[1].nombre];
  const topeE = topeEmote();

  const sala = entrarSala(codigo, {
    alConectar: () => {
      sala.enviar({ t: "hola", nombre: yo.nombre, estilo: yo.estilo, id: yo.id });
      const ping = () => sala.enviar({ t: "ping", t0: ahora(), rtt });
      ping();
      for (let i = 1; i <= 4; i++) setTimeout(ping, i * 250);   // los primeros pings van seguidos para medir rápido
      clearInterval(pingT);
      pingT = setInterval(ping, 2500);
      ultimoPong = ahora();
      clearInterval(vigia);
      vigia = setInterval(() => { if (!cortadoAviso && ahora() - ultimoPong > 7000) { cortadoAviso = true; b.conexion("cortado"); } }, 1000);
      b.conexion("conectado");
    },
    alCortar: () => b.conexion("cortado"),
    alError: (e) => error?.(e),
    alMensaje: (m) => {
      switch (m.t) {
        case "vista":
          if (!m.v || typeof m.v !== "object") return;
          v = vistaLimpia(m.v);
          if (Array.isArray(m.jug) && m.jug.length === 2) {
            jug = m.jug.map((x) => ({ nombre: limpiarNombre(x.nombre), estilo: limpiarEstilo(x.estilo), id: idOk(x.id) }));
            nombres = jug.map((x) => x.nombre);
            v.nombres = nombres;
          }
          if (listo) { const f = listo; listo = null; f(); }
          b.subs.forEach((f) => f(v, eventosLimpios(m.ev)));
          break;
        case "pong": {
          const t1 = ahora();
          ultimoPong = t1;
          if (cortadoAviso) { cortadoAviso = false; b.conexion("conectado"); }
          rtt = Math.max(0, t1 - m.t0);
          offset = m.th + rtt / 2 - t1;   // hora del anfitrión ≈ mi hora + offset
          break;
        }
        case "resp": {
          const r = pend.get(m.n);
          if (r) { pend.delete(m.n); r(m.r && typeof m.r.mensaje === "string" ? { motivo: String(m.r.motivo), mensaje: m.r.mensaje } : null); }
          break;
        }
        case "emote":
          if (emoteValido(m.k) && topeE(0)) b.subsE.forEach((f) => f(m.k, 0));
          break;
        case "lleno": error?.({ type: "lleno" }); break;
        default:
      }
    },
  });

  const fuente = {
    yo: 1, esLocal: false, esAnfitrion: false,
    ahora: () => ahora() + offset,
    get nombres() { return nombres; },
    vista: () => v,
    jugadores: () => jug,
    enviar(accion) {
      return new Promise((res) => {
        const id = ++n;
        pend.set(id, res);
        sala.enviar({ t: "accion", a: accion, n: id });
        setTimeout(() => { if (pend.delete(id)) res(null); }, 2500);
      });
    },
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() { sala.enviar({ t: "revancha" }); },
    latencia: () => Math.round(rtt / 2),
    destruir() { clearInterval(pingT); clearInterval(vigia); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); },
  };

  return { fuente, alListo(fn) { if (v) fn(); else listo = fn; }, alError(fn) { error = fn; } };
}
