// Fuentes de partida por RED para la escoba (misma interfaz que local.js). Es por turnos: no hace falta compensar la
// demora como en CHIN. El anfitrión tiene el estado completo y es el árbitro; el invitado manda jugadas y recibe su vista.
// Todo lo que llega del otro navegador se limpia campo por campo antes de usarse.
import { nuevaPartida, aplicar, reloj, vista, idValido } from "./motor.js";
import { abrirSala, entrarSala, codigoNuevo, linkDe } from "../../nucleo/red.js";
import { valido as emoteValido, tope as topeEmote } from "../../nucleo/emotes.js";
import { limpiarEstilo } from "../chin/red-fuente.js";

const ahora = () => performance.now();
const limpiarNombre = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) || "Rival";
const idOk = (x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);

function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "seguir") return { t: "seguir" };
  if (a.t === "soplar" && Array.isArray(a.cartas) && a.cartas.length <= 12 && a.cartas.every(idValido)) return { t: "soplar", cartas: [...a.cartas] };
  if (a.t === "jugar" && idValido(a.carta) && Array.isArray(a.levanta) && a.levanta.length <= 12 && a.levanta.every(idValido)) return { t: "jugar", carta: a.carta, levanta: [...a.levanta] };
  return null;
}

// ---------- lo que llega del anfitrión ----------
const ent = (x, max = 1000) => (Number.isInteger(x) && x >= 0 && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const lado = (x) => (x === 0 || x === 1 ? x : null);
const cartas = (a, max = 40) => (Array.isArray(a) ? a.slice(0, max).filter(idValido) : []);
const par = (a, f) => [f(a?.[0]), f(a?.[1])];
function recuentoLimpio(r) {
  if (!r || typeof r !== "object") return null;
  const g = r.gana || {};
  return {
    escobas: par(r.escobas, (x) => ent(x, 40)), cartas: par(r.cartas, (x) => ent(x, 40)), oros: par(r.oros, (x) => ent(x, 10)),
    sietes: par(r.sietes, (x) => ent(x, 4)), seises: par(r.seises, (x) => ent(x, 4)),
    gana: { cartas: lado(g.cartas), oros: lado(g.oros), siete: lado(g.siete), setenta: lado(g.setenta) },
    total: par(r.total, (x) => ent(x, 50)), antes: par(r.antes, (x) => ent(x, 999)), despues: par(r.despues, (x) => ent(x, 999)), mano: ent(r.mano, 999),
  };
}
export function vistaLimpia(v) {
  return {
    juego: "escoba", yo: 1, nombres: ["", ""],
    fase: ["jugando", "ultima", "recuento", "fin"].includes(v.fase) ? v.fase : "jugando",
    ganador: lado(v.ganador), meta: ent(v.meta, 99) || 15,
    puntos: par(v.puntos, (x) => ent(x, 999)), manoN: ent(v.manoN, 999), reparte: lado(v.reparte) ?? 0,
    turno: lado(v.turno) ?? 0, turnoDesde: num(v.turnoDesde),
    mesa: cartas(v.mesa), mano: cartas(v.mano, 3), enMano: par(v.enMano, (x) => ent(x, 3)), mazo: ent(v.mazo, 40),
    levantadas: par(v.levantadas, (x) => ent(x, 40)), escobas: par(v.escobas, (a) => cartas(a, 30)),
    recuento: recuentoLimpio(v.recuento), listos: par(v.listos, (x) => x === true), recuentoHasta: v.recuentoHasta === null ? null : num(v.recuentoHasta),
    historial: Array.isArray(v.historial) ? v.historial.slice(0, 60).map((h) => ({ mano: ent(h?.mano, 999), total: par(h?.total, (x) => ent(x, 50)), puntos: par(h?.puntos, (x) => ent(x, 999)) })) : [],
    ultimo: v.ultimo && typeof v.ultimo === "object" && idValido(v.ultimo.carta) ? { jugador: lado(v.ultimo.jugador) ?? 0, carta: v.ultimo.carta, levanta: cartas(v.ultimo.levanta, 12), escoba: v.ultimo.escoba === true } : null,
    soplo: v.soplo && typeof v.soplo === "object" && idValido(v.soplo.carta) ? { carta: v.soplo.carta } : null,
    cierreHasta: v.cierreHasta === null || v.cierreHasta === undefined ? null : num(v.cierreHasta),
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    switch (e.t) {
      case "jugada": if (idValido(e.carta)) out.push({ t: "jugada", jugador: lado(e.jugador) ?? 0, carta: e.carta, levanta: cartas(e.levanta, 12), escoba: e.escoba === true }); break;
      case "soplo": out.push({ t: "soplo", jugador: lado(e.jugador) ?? 0, de: lado(e.de) ?? 0, cartas: cartas(e.cartas, 12) }); break;
      case "ultima": out.push({ t: "ultima", hasta: num(e.hasta) }); break;
      case "repartir": out.push({ t: "repartir", quedan: ent(e.quedan, 40) }); break;
      case "reparto": out.push({ t: "reparto", mano: ent(e.mano, 999), reparte: lado(e.reparte) ?? 0, mesa: cartas(e.mesa, 4), escobasMesa: ent(e.escobasMesa, 2) }); break;
      case "barrida": out.push({ t: "barrida", jugador: lado(e.jugador) ?? 0, cartas: cartas(e.cartas) }); break;
      case "recuento": out.push({ t: "recuento", recuento: recuentoLimpio(e.recuento) }); break;
      case "listo": out.push({ t: "listo", jugador: lado(e.jugador) ?? 0 }); break;
      case "fin": out.push({ t: "fin", ganador: lado(e.ganador) ?? 0 }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: lado(e.jugador) ?? 0 }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: lado(e.jugador) ?? 0 }); break;
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
    conexion(e) { subsC.forEach((f) => f(e)); },
  };
}

/** Anfitrión. Devuelve { codigo, link, fuente, alAbrir, alEntrar, alError, empezar(), cerrar() }. */
export function crearAnfitrion(yo, { meta = 15 } = {}) {
  const b = base();
  const codigo = codigoNuevo();
  let estado = null, conectado = false, timer = null, abierta = false, ultimoPing = 0, cortadoAviso = false, owd = 0;
  const rival = { nombre: "Rival", estilo: {}, id: null };
  const quieren = [false, false];
  const topeE = topeEmote();
  const aviso = { entro: null, error: null, abrio: null };

  const jug = () => [{ nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) }, { ...rival }];
  const mandar = (ev) => sala.enviar({ t: "vista", v: vista(estado, 1), ev, jug: jug(), th: ahora() });
  const emitir = (ev) => { b.subs.forEach((f) => f(vista(estado, 0), ev)); if (conectado) mandar(ev); };
  function aplicarReal(j, accion) {
    try {
      const r = aplicar(estado, j, accion, ahora());
      if (r.rechazo) return { motivo: r.rechazo.motivo, mensaje: r.rechazo.mensaje };
      estado = r.estado;
      emitir(r.eventos);
    } catch { return { motivo: "mal", mensaje: "Esa jugada no se puede." }; }
    return null;
  }
  let inicial = [];
  function nueva() {
    estado = nuevaPartida({ nombres: [limpiarNombre(yo.nombre), rival.nombre], ahora: ahora(), meta });
    inicial = estado.eventosIniciales || [];
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
          sala.enviar({ t: "resp", n: m.n, r: a ? aplicarReal(1, a) : { motivo: "mal", mensaje: "Esa jugada no se puede." } });
          break;
        }
        case "revancha":
          if (!estado || estado.fase !== "fin") return;
          quieren[1] = true;
          if (quieren[0]) { nueva(); emitir([{ t: "revancha" }, ...inicial]); } else emitir([{ t: "quiere_revancha", jugador: 1 }]);
          break;
        case "no_revancha":
          if (!estado || estado.fase !== "fin") return;
          quieren[0] = quieren[1] = false;
          emitir([{ t: "no_revancha", jugador: 1 }]);
          break;
        case "emote":
          if (emoteValido(m.k) && topeE(1)) b.subsE.forEach((f) => f(m.k, 1));
          break;
        case "me_voy":
          conectado = false; quieren[0] = quieren[1] = false; b.conexion("se_fue");
          break;
        default:
      }
    },
  });

  const fuente = {
    yo: 0, esLocal: false, esAnfitrion: true, ahora, formato: 1,
    get nombres() { return estado ? estado.nombres : [limpiarNombre(yo.nombre), rival.nombre]; },
    get inicial() { return inicial; },
    vista: () => vista(estado, 0),
    jugadores: jug,
    enviar: (accion) => aplicarReal(0, accion),
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() {
      if (!estado || estado.fase !== "fin") return;
      quieren[0] = true;
      if (quieren[1]) { nueva(); emitir([{ t: "revancha" }, ...inicial]); } else emitir([{ t: "quiere_revancha", jugador: 0 }]);
    },
    declinar() {
      if (!estado || estado.fase !== "fin") return;
      quieren[0] = quieren[1] = false;
      emitir([{ t: "no_revancha", jugador: 0 }]);
    },
    irse() { try { sala.enviar({ t: "me_voy" }); } catch { /* ya no hay canal */ } },
    latencia: () => Math.round(owd),
    _estado: () => estado,   // pruebas
    destruir() { clearInterval(timer); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); },
  };

  return {
    codigo, link: linkDe(codigo, "escoba"), fuente, rival,
    alAbrir(fn) { aviso.abrio = fn; if (abierta) fn(); },
    alEntrar(fn) { aviso.entro = fn; },
    alError(fn) { aviso.error = fn; },
    empezar() {
      nueva();
      timer = setInterval(() => {
        if (conectado && !cortadoAviso && ahora() - ultimoPing > 7000) { cortadoAviso = true; b.conexion("cortado"); }
        if (!estado) return;
        const rr = reloj(estado, ahora());
        if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
      }, 250);
      mandar([{ t: "revancha" }, ...inicial]);
    },
    cerrar: fuente.destruir,
  };
}

/** Invitado. Devuelve { fuente, alListo(fn), alError(fn) }. */
export function entrarComoInvitado(codigo, yo) {
  const b = base();
  let v = null, offset = 0, rtt = 0, n = 0;
  let jug = [{ nombre: "Anfitrión", estilo: {}, id: null }, { nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) }];
  let nombres = jug.map((x) => x.nombre);
  const pend = new Map();
  let ultimoPong = 0, cortadoAviso = false, vigia = null, pingT = null, listo = null, error = null;
  const topeE = topeEmote();

  const sala = entrarSala(codigo, {
    alConectar: () => {
      sala.enviar({ t: "hola", nombre: yo.nombre, estilo: yo.estilo, id: yo.id });
      const ping = () => sala.enviar({ t: "ping", t0: ahora(), rtt });
      ping();
      clearInterval(pingT); pingT = setInterval(ping, 2500);
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
            jug = m.jug.map((x) => ({ nombre: limpiarNombre(x?.nombre), estilo: limpiarEstilo(x?.estilo), id: idOk(x?.id) }));
            nombres = jug.map((x) => x.nombre);
          }
          v.nombres = nombres;
          if (listo) { const f = listo; listo = null; f(); }
          b.subs.forEach((f) => f(v, eventosLimpios(m.ev)));
          break;
        case "pong": {
          const t1 = ahora();
          ultimoPong = t1;
          if (cortadoAviso) { cortadoAviso = false; b.conexion("conectado"); }
          rtt = Math.max(0, t1 - m.t0);
          if (Number.isFinite(m.th)) offset = m.th + rtt / 2 - t1;
          break;
        }
        case "resp": {
          const r = pend.get(m.n);
          if (r) { pend.delete(m.n); r(m.r && typeof m.r.mensaje === "string" ? { motivo: String(m.r.motivo), mensaje: m.r.mensaje.slice(0, 120) } : null); }
          break;
        }
        case "emote":
          if (emoteValido(m.k) && topeE(0)) b.subsE.forEach((f) => f(m.k, 0));
          break;
        case "lleno": error?.({ type: "lleno" }); break;
        case "me_voy": clearInterval(pingT); clearInterval(vigia); b.conexion("se_fue"); break;
        default:
      }
    },
  });

  const fuente = {
    yo: 1, esLocal: false, esAnfitrion: false, formato: 1, inicial: [],
    ahora: () => ahora() + offset,
    get nombres() { return nombres; },
    vista: () => v,
    jugadores: () => jug,
    enviar(accion) {
      return new Promise((res) => {
        const id = ++n;
        pend.set(id, res);
        sala.enviar({ t: "accion", a: accion, n: id });
        setTimeout(() => { if (pend.delete(id)) res(null); }, 4000);
      });
    },
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() { sala.enviar({ t: "revancha" }); },
    declinar() { sala.enviar({ t: "no_revancha" }); },
    irse() { try { sala.enviar({ t: "me_voy" }); } catch { /* ya no hay canal */ } },
    latencia: () => Math.round(rtt / 2),
    destruir() { clearInterval(pingT); clearInterval(vigia); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); },
  };
  return { fuente, alListo(fn) { if (v) fn(); else listo = fn; }, alError(fn) { error = fn; } };
}
