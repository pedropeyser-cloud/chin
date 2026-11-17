// Fuentes de partida por RED para la canasta (misma interfaz que local.js; copiada de la escoba). Es por turnos: no hace
// falta compensar la demora como en CHIN. El anfitrión tiene el estado completo y es el árbitro; el invitado manda jugadas y recibe su vista.
// Todo lo que llega del otro navegador se limpia campo por campo antes de usarse.
import { nuevaPartida, aplicar, reloj, vista, idValido } from "./motor.js";
import { abrirSala, entrarSala, codigoNuevo, linkDe } from "../../nucleo/red.js";
import { valido as emoteValido, tope as topeEmote } from "../../nucleo/emotes.js";
import { limpiarEstilo } from "../chin/red-fuente.js";

const ahora = () => performance.now();
const limpiarNombre = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) || "Rival";
const idOk = (x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);

const juegosLimpios = (a, maxJ = 8, maxC = 30) => (Array.isArray(a) ? a.slice(0, maxJ).filter((g) => Array.isArray(g) && g.length <= maxC && g.every(idValido)).map((g) => [...g]) : null);
function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  switch (a.t) {
    case "seguir": case "robar": return { t: a.t };
    case "tirar": return idValido(a.carta) ? { t: "tirar", carta: a.carta } : null;
    case "agregar": return Number.isInteger(a.rango) && a.rango >= 1 && a.rango <= 13 && Array.isArray(a.cartas) && a.cartas.length && a.cartas.length <= 30 && a.cartas.every(idValido) ? { t: "agregar", rango: a.rango, cartas: [...a.cartas] } : null;
    case "bajar": { const j = juegosLimpios(a.juegos); return j && j.length ? { t: "bajar", juegos: j } : null; }
    case "pozo":
      if (Number.isInteger(a.a) && a.a >= 1 && a.a <= 13) return { t: "pozo", a: a.a };
      if (Array.isArray(a.con) && a.con.length === 2 && a.con.every(idValido)) {
        const j = a.juegos === undefined ? undefined : juegosLimpios(a.juegos);
        if (j === null) return null;
        return j ? { t: "pozo", con: [...a.con], juegos: j } : { t: "pozo", con: [...a.con] };
      }
      return null;
    default: return null;
  }
}

// ---------- lo que llega del anfitrión ----------
const ent = (x, max = 1000) => (Number.isInteger(x) && x >= 0 && x <= max ? x : 0);
const sig = (x, max = 99999) => (Number.isInteger(x) && Math.abs(x) <= max ? x : 0);   // puntos: pueden ser negativos
const num = (x) => (Number.isFinite(x) ? x : 0);
const lado = (x) => (x === 0 || x === 1 ? x : null);
const cartas = (a, max = 108) => (Array.isArray(a) ? a.slice(0, max).filter(idValido) : []);
const par = (a, f) => [f(a?.[0]), f(a?.[1])];
const id = (x) => (idValido(x) ? x : null);
const juegosVista = (a) => (Array.isArray(a) ? a.slice(0, 14).map((g) => ({ rango: ent(g?.rango, 13), cartas: cartas(g?.cartas, 30) })).filter((g) => g.cartas.length) : []);
function cuentaLimpia(c) {
  c = c && typeof c === "object" ? c : {};
  return { cartas: sig(c.cartas), puras: ent(c.puras, 20), impuras: ent(c.impuras, 20), rojos: sig(c.rojos), nRojos: ent(c.nRojos, 4), cierre: ent(c.cierre, 100), mano: sig(c.mano), total: sig(c.total) };
}
function recuentoLimpio(r) {
  if (!r || typeof r !== "object") return null;
  return { jugadores: par(r.jugadores, cuentaLimpia), cerro: lado(r.cerro), antes: par(r.antes, sig), despues: par(r.despues, sig), mano: ent(r.mano, 999) };
}
export function vistaLimpia(v) {
  const p = v.pozo && typeof v.pozo === "object" ? v.pozo : {};
  return {
    juego: "canasta", yo: 1, nombres: ["", ""],
    fase: ["robar", "jugar", "recuento", "fin"].includes(v.fase) ? v.fase : "robar",
    ganador: lado(v.ganador), meta: ent(v.meta, 99999) || 5000,
    puntos: par(v.puntos, sig), minimos: par(v.minimos, (x) => ent(x, 150)), bajo: par(v.bajo, (x) => x === true),
    manoN: ent(v.manoN, 999), reparte: lado(v.reparte) ?? 0,
    turno: lado(v.turno) ?? 0, turnoDesde: num(v.turnoDesde), accionDesde: num(v.accionDesde),
    mano: cartas(v.mano), robadas: cartas(v.robadas, 108), enMano: par(v.enMano, (x) => ent(x, 108)), mazo: ent(v.mazo, 108),
    pozo: { tope: id(p.tope), n: ent(p.n, 108), congelado: p.congelado === true, tapado: p.tapado === true, libres: cartas(p.libres, 4) },
    juegos: par(v.juegos, juegosVista), rojos: par(v.rojos, (a) => cartas(a, 4)),
    recuento: recuentoLimpio(v.recuento), listos: par(v.listos, (x) => x === true), recuentoHasta: v.recuentoHasta === null ? null : num(v.recuentoHasta),
    historial: Array.isArray(v.historial) ? v.historial.slice(0, 60).map((h) => ({ mano: ent(h?.mano, 999), total: par(h?.total, sig), puntos: par(h?.puntos, sig), cerro: lado(h?.cerro) })) : [],
    ultimo: v.ultimo && typeof v.ultimo === "object" ? { jugador: lado(v.ultimo.jugador) ?? 0, t: ["robar", "pozo", "bajar", "agregar", "tirar"].includes(v.ultimo.t) ? v.ultimo.t : "robar", carta: id(v.ultimo.carta), tope: id(v.ultimo.tope), n: ent(v.ultimo.n, 108) } : null,
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 30) : []) {
    if (!e || typeof e !== "object") continue;
    const j = lado(e.jugador) ?? 0;
    switch (e.t) {
      case "reparto": out.push({ t: "reparto", mano: ent(e.mano, 999), reparte: lado(e.reparte) ?? 0, rojos: par(e.rojos, (a) => cartas(a, 4)), pozo: cartas(e.pozo, 20) }); break;
      case "rojo": if (idValido(e.carta)) out.push({ t: "rojo", jugador: j, carta: e.carta }); break;
      case "robo": out.push({ t: "robo", jugador: j, n: ent(e.n, 2), quedan: ent(e.quedan, 108) }); break;
      case "pozo": if (idValido(e.tope)) out.push({ t: "pozo", jugador: j, tope: e.tope, n: ent(e.n, 108), con: cartas(e.con, 2), juegos: juegosLimpios(e.juegos) || [], a: Number.isInteger(e.a) ? ent(e.a, 13) : null }); break;
      case "bajar": out.push({ t: "bajar", jugador: j, juegos: juegosLimpios(e.juegos) || [] }); break;
      case "agregar": out.push({ t: "agregar", jugador: j, rango: ent(e.rango, 13), cartas: cartas(e.cartas, 30) }); break;
      case "canasta": out.push({ t: "canasta", jugador: j, rango: ent(e.rango, 13), pura: e.pura === true }); break;
      case "tirar": if (idValido(e.carta)) out.push({ t: "tirar", jugador: j, carta: e.carta, congela: e.congela === true }); break;
      case "cierre": out.push({ t: "cierre", jugador: j }); break;
      case "mazo_vacio": out.push({ t: "mazo_vacio" }); break;
      case "recuento": out.push({ t: "recuento", recuento: recuentoLimpio(e.recuento) }); break;
      case "listo": out.push({ t: "listo", jugador: j }); break;
      case "fin": out.push({ t: "fin", ganador: j }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
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
export function crearAnfitrion(yo, { meta = 5000 } = {}) {
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
    codigo, link: linkDe(codigo, "canasta"), fuente, rival,
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
