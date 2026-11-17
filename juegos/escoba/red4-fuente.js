// Fuentes de partida por RED para la ESCOBA DE A 4 (2026-11-17). Estrella: el anfitrión tiene el estado completo, es el
// árbitro y hace jugar a los bots de las sillas vacías; cada invitado manda sus jugadas y recibe solo su vista.
// Asientos 0 a 3 en el orden de la ronda (antihoraria): el anfitrión es el 0 y su compañero el 2.
//
// Antes de empezar hay sala de espera: los que entran se sientan en el primer lugar libre (primero de compañero, después
// a la derecha y a la izquierda); el anfitrión puede cambiarlos de silla y elegir qué bot va en cada lugar vacío.
// Si un invitado se va (o se le corta y no vuelve en 15 s), su lugar lo toma un bot y la partida sigue. Si el que se va es
// el anfitrión, se termina para todos. Todo lo que llega de otro navegador se limpia campo por campo antes de usarse.
import { nuevaPartida, aplicar, reloj, vista, idValido } from "./motor.js";
import { bot } from "./bot.js";
import { personaje, charla4 } from "./personajes.js";
import { abrirSalaVarios, entrarSala, codigoNuevo, linkDe } from "../../nucleo/red.js";
import { valido as emoteValido, tope as topeEmote } from "../../nucleo/emotes.js";
import { limpiarEstilo } from "../chin/red-fuente.js";

const ahora = () => performance.now();
const azar = (a) => a[Math.floor(Math.random() * a.length)];
const limpiarNombre = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) || "Jugador";
const idOk = (x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);
const claveOk = (x) => (typeof x === "string" && /^[a-z0-9]{8,24}$/.test(x) ? x : null);
export const DIFS = ["tranquilo", "rapido", "implacable"];
const difOk = (x) => (DIFS.includes(x) ? x : "rapido");
/** El orden en que se ocupan las sillas libres: compañero, derecha, izquierda. */
const ORDEN_SILLAS = [2, 1, 3];
export const link4 = (codigo) => `${linkDe(codigo, "escoba")}&n=4`;

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
const asiento = (x) => (Number.isInteger(x) && x >= 0 && x <= 3 ? x : null);
const cartas = (a, max = 40) => (Array.isArray(a) ? a.slice(0, max).filter(idValido) : []);
const par = (a, f) => [f(a?.[0]), f(a?.[1])];
const cuatro = (a, f) => [0, 1, 2, 3].map((k) => f(a?.[k]));
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
export function vistaLimpia4(v, yo) {
  return {
    juego: "escoba", n: 4, yo, nombres: ["", "", "", ""],
    fase: ["jugando", "ultima", "recuento", "fin"].includes(v.fase) ? v.fase : "jugando",
    ganador: lado(v.ganador), meta: ent(v.meta, 99) || 15,
    puntos: par(v.puntos, (x) => ent(x, 999)), manoN: ent(v.manoN, 999), reparte: asiento(v.reparte) ?? 0,
    turno: asiento(v.turno) ?? 0, turnoDesde: num(v.turnoDesde),
    mesa: cartas(v.mesa), mano: cartas(v.mano, 3), enMano: cuatro(v.enMano, (x) => ent(x, 3)), mazo: ent(v.mazo, 40),
    levantadas: par(v.levantadas, (x) => ent(x, 40)), escobas: par(v.escobas, (a) => cartas(a, 30)),
    recuento: recuentoLimpio(v.recuento), listos: cuatro(v.listos, (x) => x === true), recuentoHasta: v.recuentoHasta === null ? null : num(v.recuentoHasta),
    historial: Array.isArray(v.historial) ? v.historial.slice(0, 60).map((h) => ({ mano: ent(h?.mano, 999), total: par(h?.total, (x) => ent(x, 50)), puntos: par(h?.puntos, (x) => ent(x, 999)) })) : [],
    ultimo: v.ultimo && typeof v.ultimo === "object" && idValido(v.ultimo.carta) ? { jugador: asiento(v.ultimo.jugador) ?? 0, carta: v.ultimo.carta, levanta: cartas(v.ultimo.levanta, 12), escoba: v.ultimo.escoba === true } : null,
    soplo: v.soplo && typeof v.soplo === "object" && idValido(v.soplo.carta) ? { carta: v.soplo.carta } : null,
    cierreHasta: v.cierreHasta === null || v.cierreHasta === undefined ? null : num(v.cierreHasta),
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios4(ev) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador) ?? 0;
    switch (e.t) {
      case "jugada": if (idValido(e.carta)) out.push({ t: "jugada", jugador: j, carta: e.carta, levanta: cartas(e.levanta, 12), escoba: e.escoba === true }); break;
      case "soplo": out.push({ t: "soplo", jugador: j, de: asiento(e.de) ?? 0, cartas: cartas(e.cartas, 12) }); break;
      case "ultima": out.push({ t: "ultima", hasta: num(e.hasta) }); break;
      case "repartir": out.push({ t: "repartir", quedan: ent(e.quedan, 40) }); break;
      case "reparto": out.push({ t: "reparto", mano: ent(e.mano, 999), reparte: asiento(e.reparte) ?? 0, mesa: cartas(e.mesa, 4), escobasMesa: ent(e.escobasMesa, 2) }); break;
      case "barrida": out.push({ t: "barrida", jugador: j, cartas: cartas(e.cartas) }); break;
      case "recuento": out.push({ t: "recuento", recuento: recuentoLimpio(e.recuento) }); break;
      case "listo": out.push({ t: "listo", jugador: j }); break;
      case "fin": out.push({ t: "fin", ganador: lado(e.ganador) ?? 0 }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}
const jugLimpio = (x) => ({ nombre: limpiarNombre(x?.nombre), estilo: limpiarEstilo(x?.estilo), id: idOk(x?.id), bot: DIFS.includes(x?.bot) ? x.bot : undefined });
/** La sala de espera que manda el anfitrión: quién está en cada silla. */
export function salaLimpia(s) {
  const sillas = [0, 1, 2, 3].map((k) => {
    const x = s?.sillas?.[k] || {};
    return { tipo: ["anfitrion", "persona", "bot"].includes(x.tipo) ? x.tipo : "bot", nombre: limpiarNombre(x.nombre), bot: DIFS.includes(x.bot) ? x.bot : null };
  });
  return { sillas, tuya: asiento(s?.tuya) };
}

function base() {
  const subs = new Set(), subsE = new Set(), subsC = new Set(), subsD = new Set();
  return {
    subs, subsE, subsC, subsD,
    suscribir(fn) { subs.add(fn); return () => subs.delete(fn); },
    suscribirEmote(fn) { subsE.add(fn); return () => subsE.delete(fn); },
    suscribirConexion(fn) { subsC.add(fn); return () => subsC.delete(fn); },
    suscribirDicho(fn) { subsD.add(fn); return () => subsD.delete(fn); },
    conexion(e) { subsC.forEach((f) => f(e)); },
  };
}

/**
 * Anfitrión de a 4. Devuelve { codigo, link, fuente, sillas(), mover(a, b), cambiarBot(asiento), alAbrir, alSala, alError,
 * empezar(), cerrar() }. `sillas()` = [{ tipo: "anfitrion"|"persona"|"bot", nombre, bot }].
 */
export function crearAnfitrion4(yo, { meta = 15 } = {}) {
  const b = base();
  const codigo = codigoNuevo();
  const yoLimpio = { nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) };
  // cada silla: { tipo, cid?, clave?, nombre, estilo, id, bot }
  const sillas = [
    { tipo: "anfitrion", ...yoLimpio },
    { tipo: "bot", bot: "rapido" }, { tipo: "bot", bot: "implacable" }, { tipo: "bot", bot: "tranquilo" },
  ];
  const datosBot = (s) => { const pj = personaje(s.bot); s.nombre = pj.nombre; s.estilo = { cara: pj.cara }; s.id = null; };
  sillas.slice(1).forEach(datosBot);
  const porCid = new Map();                 // cid → asiento (o null si todavía no dijo hola)
  const pings = new Map(), cortes = new Map();
  let estado = null, timer = null, abierta = false, empezada = false, ultimoDicho = 0;
  const quieren = [false, false, false, false];
  const topeE = topeEmote();
  const aviso = { sala: null, error: null, abrio: null };

  const esBot = (j) => sillas[j].tipo === "bot";
  const jug = () => sillas.map((s) => ({ nombre: s.nombre, estilo: s.estilo || {}, id: s.id || null, ...(s.tipo === "bot" ? { bot: s.bot } : {}) }));
  const nombres = () => sillas.map((s) => s.nombre);
  const salaPara = (j) => ({ t: "sala", sillas: sillas.map((s) => ({ tipo: s.tipo, nombre: s.nombre, bot: s.tipo === "bot" ? s.bot : null })), tuya: j });
  function avisarSala() {
    sillas.forEach((s, j) => { if (s.tipo === "persona" && s.cid) sala.enviar(s.cid, salaPara(j)); });
    aviso.sala?.();
  }
  const mandarA = (j, ev) => { const s = sillas[j]; if (s.tipo === "persona" && s.cid) sala.enviar(s.cid, { t: "vista", v: vista(estado, j), ev, jug: jug(), yo: j, th: ahora() }); };
  function emitir(ev) {
    b.subs.forEach((f) => f(vista(estado, 0), ev));
    for (let j = 1; j < 4; j++) mandarA(j, ev);
    comentar(ev);
  }
  function decir(j, momento, chance = 1) {
    if (Math.random() > chance) return;
    const t = ahora(), final = momento.endsWith("gana") || momento.endsWith("pierde");
    if (!final && t - ultimoDicho < 4000) return;
    ultimoDicho = t;
    const txt = azar(personaje(sillas[j].bot).frases[momento] || []);
    if (txt) setTimeout(() => dicho(j, txt), 700 + Math.random() * 500 + (final && j > 1 ? 1600 : 0));
  }
  function dicho(j, txt) { b.subsD.forEach((f) => f(txt, j)); sala.todos({ t: "dicho", j, txt }); }
  function comentar(ev) { for (const c of charla4(ev, esBot)) if (esBot(c.j)) decir(c.j, c.momento, c.chance); }
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
    estado = nuevaPartida({ jugadores: 4, nombres: nombres(), ahora: ahora(), meta });
    inicial = estado.eventosIniciales || [];
    quieren.fill(false);
  }
  function quiereRevancha(j) {
    if (!estado || estado.fase !== "fin") return;
    quieren[j] = true;
    if (sillas.every((s, k) => s.tipo === "bot" || quieren[k])) { nueva(); emitir([{ t: "revancha" }, ...inicial]); }
    else emitir([{ t: "quiere_revancha", jugador: j }]);
  }
  /** Un invitado se fue: en la sala de espera se libera la silla; con la partida empezada, juega un bot por él. */
  function liberar(j, seFue = true) {
    const s = sillas[j];
    if (s.tipo !== "persona") return;
    const nombreAntes = s.nombre;
    const dif = DIFS.find((d) => !sillas.some((x) => x.tipo === "bot" && x.bot === d)) || "rapido";
    Object.assign(s, { tipo: "bot", bot: dif, cid: null, clave: null });
    datosBot(s);
    if (!empezada) { avisarSala(); return; }
    estado.nombres[j] = s.nombre;
    quieren[j] = false;
    emitir([]);
    if (seFue) dicho(j, `${nombreAntes} se fue: juego yo en su lugar.`);
    if (estado.fase === "fin" && quieren.some(Boolean)) quiereRevancha(quieren.findIndex(Boolean));
  }

  /** Se cerró (o dejó de latir) la conexión de un invitado. */
  function seCorto(cid) {
    const j = porCid.get(cid);
    porCid.delete(cid); pings.delete(cid);
    if (j === null || j === undefined || sillas[j].cid !== cid) return;
    sillas[j].cid = null;
    if (!empezada) { liberar(j, false); return; }
    // se cortó: le doy 15 s para volver (vuelve con la misma clave) antes de poner un bot
    clearTimeout(cortes.get(j));
    cortes.set(j, setTimeout(() => { if (sillas[j].tipo === "persona" && !sillas[j].cid) liberar(j); }, 15000));
  }

  const sala = abrirSalaVarios(codigo, 3, {
    alAbrir: () => { abierta = true; aviso.abrio?.(); },
    alEntrar: (cid) => { porCid.set(cid, null); pings.set(cid, ahora()); },
    alSalir: (cid) => seCorto(cid),
    alError: (e) => aviso.error?.(e),
    alMensaje: (cid, m) => {
      const j = porCid.get(cid);
      switch (m.t) {
        case "hola": {
          if (j !== null && j !== undefined) return;
          const clave = claveOk(m.clave);
          const datos = { nombre: limpiarNombre(m.nombre), estilo: limpiarEstilo(m.estilo), id: idOk(m.id) };
          // vuelve alguien que se había cortado: a su silla
          let k = clave ? sillas.findIndex((s) => s.tipo === "persona" && s.clave === clave) : -1;
          if (k >= 0) { clearTimeout(cortes.get(k)); sillas[k].cid = cid; }
          else {
            if (empezada) { sala.enviar(cid, { t: "empezada" }); setTimeout(() => sala.cortar(cid), 300); return; }
            k = ORDEN_SILLAS.find((x) => sillas[x].tipo === "bot");
            if (k === undefined) { sala.enviar(cid, { t: "lleno" }); setTimeout(() => sala.cortar(cid), 300); return; }
            Object.assign(sillas[k], { tipo: "persona", cid, clave, bot: null, ...datos });
          }
          porCid.set(cid, k);
          if (empezada) { estado.nombres[k] = sillas[k].nombre; mandarA(k, [{ t: "revancha" }]); emitir([]); b.conexion("conectado"); }
          else avisarSala();
          break;
        }
        case "ping":
          pings.set(cid, ahora());
          sala.enviar(cid, { t: "pong", t0: m.t0, th: ahora() });
          break;
        case "accion": {
          if (!estado || j === null || j === undefined) return;
          const a = accionLimpia(m.a);
          sala.enviar(cid, { t: "resp", n: m.n, r: a ? aplicarReal(j, a) : { motivo: "mal", mensaje: "Esa jugada no se puede." } });
          break;
        }
        case "revancha": if (j !== null && j !== undefined) quiereRevancha(j); break;
        case "no_revancha":
          if (!estado || estado.fase !== "fin" || j === null || j === undefined) return;
          quieren.fill(false);
          emitir([{ t: "no_revancha", jugador: j }]);
          break;
        case "emote":
          if (j === null || j === undefined || !emoteValido(m.k) || !topeE(j)) return;
          b.subsE.forEach((f) => f(m.k, j));
          sala.todos({ t: "emote", k: m.k, j }, cid);
          break;
        case "me_voy":
          if (j === null || j === undefined) return;
          porCid.delete(cid); sillas[j].cid = null;
          liberar(j);
          sala.cortar(cid);
          break;
        default:
      }
    },
  });

  const fuente = {
    yo: 0, esLocal: false, esAnfitrion: true, ahora, formato: 1,
    get nombres() { return estado ? estado.nombres : nombres(); },
    get inicial() { return inicial; },
    vista: () => vista(estado, 0),
    jugadores: jug,
    enviar: (accion) => aplicarReal(0, accion),
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion, suscribirDicho: b.suscribirDicho,
    emote(k) { if (emoteValido(k)) sala.todos({ t: "emote", k, j: 0 }); },
    revancha() { quiereRevancha(0); },
    declinar() {
      if (!estado || estado.fase !== "fin") return;
      quieren.fill(false);
      emitir([{ t: "no_revancha", jugador: 0 }]);
    },
    irse() { try { sala.todos({ t: "me_voy" }); } catch { /* ya no hay canal */ } },
    latencia: () => 0,
    _estado: () => estado,   // pruebas
    destruir() { clearInterval(timer); cortes.forEach((t) => clearTimeout(t)); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); b.subsD.clear(); },
  };

  return {
    codigo, link: link4(codigo), fuente,
    sillas: () => sillas.map((s) => ({ tipo: s.tipo, nombre: s.nombre, bot: s.tipo === "bot" ? s.bot : null })),
    personas: () => sillas.filter((s) => s.tipo === "persona").length,
    /** Cambia de lugar lo que hay en las sillas a y b (1 a 3; el anfitrión se queda en la 0). */
    mover(a, c) {
      if (empezada || ![1, 2, 3].includes(a) || ![1, 2, 3].includes(c) || a === c) return;
      [sillas[a], sillas[c]] = [sillas[c], sillas[a]];
      for (const [cid, k] of porCid) { if (k === a) porCid.set(cid, c); else if (k === c) porCid.set(cid, a); }
      avisarSala();
    },
    /** El bot de una silla vacía pasa al siguiente personaje. */
    cambiarBot(j) {
      if (empezada || !sillas[j] || sillas[j].tipo !== "bot") return;
      sillas[j].bot = DIFS[(DIFS.indexOf(sillas[j].bot) + 1) % DIFS.length];
      datosBot(sillas[j]);
      avisarSala();
    },
    alAbrir(fn) { aviso.abrio = fn; if (abierta) fn(); },
    alSala(fn) { aviso.sala = fn; },
    alError(fn) { aviso.error = fn; },
    empezar() {
      if (empezada) return;
      empezada = true;
      nueva();
      timer = setInterval(() => {
        if (!estado) return;
        const t = ahora();
        if (estado.fase !== "fin") {
          for (let j = 1; j < 4; j++) {
            if (!esBot(j)) continue;
            const a = bot(estado, j, t, sillas[j].bot);
            if (!a) continue;
            const r = aplicar(estado, j, a, t);
            if (!r.rechazo) { estado = r.estado; emitir(r.eventos); break; }
          }
        }
        const rr = reloj(estado, t);
        if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); }
        // invitados que dejaron de latir: se los da por cortados (la conexión todavía no se cerró)
        for (const [cid, t0] of pings) {
          const j = porCid.get(cid);
          if (j !== null && j !== undefined && t - t0 > 9000 && sillas[j].cid === cid) { seCorto(cid); sala.cortar(cid); }
        }
      }, 60);
      for (let j = 1; j < 4; j++) mandarA(j, [{ t: "revancha" }, ...inicial]);
      setTimeout(() => { const j = [1, 2, 3].find((k) => esBot(k) && !esBot((k + 2) % 4)); if (j) decir(j, "socio_empieza", 0.8); }, 900);
    },
    cerrar: fuente.destruir,
  };
}

/** Invitado de a 4. Devuelve { fuente, alSala(fn(sala)), alListo(fn), alError(fn) }; `fuente.yo` es su asiento. */
export function entrarComoInvitado4(codigo, yo) {
  const b = base();
  let v = null, offset = 0, rtt = 0, n = 0, miAsiento = null;
  let jug = [0, 1, 2, 3].map(() => ({ nombre: "Jugador", estilo: {}, id: null }));
  let nombres = jug.map((x) => x.nombre);
  const pend = new Map();
  let ultimoPong = 0, cortadoAviso = false, vigia = null, pingT = null, listo = null, error = null, enSala = null;
  const topeE = topeEmote();
  // la clave me devuelve a mi silla si se corta y vuelvo (dura lo que la pestaña)
  let clave = null;
  try { clave = sessionStorage.getItem(`escoba4.${codigo}`); } catch { /* ok */ }
  if (!claveOk(clave)) {
    clave = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
    try { sessionStorage.setItem(`escoba4.${codigo}`, clave); } catch { /* ok */ }
  }

  const sala = entrarSala(codigo, {
    alConectar: () => {
      sala.enviar({ t: "hola", nombre: yo.nombre, estilo: yo.estilo, id: yo.id, clave });
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
        case "sala": enSala?.(salaLimpia(m)); break;
        case "vista": {
          if (!m.v || typeof m.v !== "object") return;
          const a = asiento(m.yo);
          if (a === null || a === 0) return;
          if (miAsiento === null) miAsiento = a;
          if (a !== miAsiento) return;
          v = vistaLimpia4(m.v, miAsiento);
          if (Array.isArray(m.jug) && m.jug.length === 4) { jug = m.jug.map(jugLimpio); nombres = jug.map((x) => x.nombre); }
          v.nombres = nombres;
          if (listo) { const f = listo; listo = null; f(); }
          b.subs.forEach((f) => f(v, eventosLimpios4(m.ev)));
          break;
        }
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
        case "emote": { const j = asiento(m.j); if (j !== null && j !== miAsiento && emoteValido(m.k) && topeE(j)) b.subsE.forEach((f) => f(m.k, j)); break; }
        case "dicho": { const j = asiento(m.j); if (j !== null && typeof m.txt === "string") b.subsD.forEach((f) => f(m.txt.replace(/[\u0000-\u001f<>]/g, "").slice(0, 140), j)); break; }
        case "lleno": error?.({ type: "lleno" }); break;
        case "empezada": error?.({ type: "empezada" }); break;
        case "me_voy": clearInterval(pingT); clearInterval(vigia); b.conexion("se_fue"); break;
        default:
      }
    },
  });

  const fuente = {
    get yo() { return miAsiento ?? 1; },
    esLocal: false, esAnfitrion: false, formato: 1, inicial: [],
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
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion, suscribirDicho: b.suscribirDicho,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() { sala.enviar({ t: "revancha" }); },
    declinar() { sala.enviar({ t: "no_revancha" }); },
    irse() { try { sala.enviar({ t: "me_voy" }); } catch { /* ya no hay canal */ } try { sessionStorage.removeItem(`escoba4.${codigo}`); } catch { /* ok */ } },
    latencia: () => Math.round(rtt / 2),
    destruir() { clearInterval(pingT); clearInterval(vigia); sala.cerrar(); b.subs.clear(); b.subsE.clear(); b.subsC.clear(); b.subsD.clear(); },
  };
  return { fuente, alSala(fn) { enSala = fn; }, alListo(fn) { if (v) fn(); else listo = fn; }, alError(fn) { error = fn; } };
}
