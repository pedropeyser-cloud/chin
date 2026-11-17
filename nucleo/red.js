// Conexión directa entre dos navegadores con PeerJS (copiada de truco/juego/js/red.js, solo 1 contra 1).
// El servidor público gratuito de PeerJS solo presenta a los dos navegadores; después los datos van directo.
// El anfitrión tiene la partida; el invitado manda acciones y recibe vistas. Sin servidor de relevo (TURN):
// en alguna red de celular muy cerrada puede no conectar.
const PREFIJO = "chin-pl-";
const ICE = { config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] } };

export const codigoNuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
export const linkDe = (codigo, juego = "chin") => `${location.origin}${location.pathname}?sala=${codigo}&juego=${juego}`;
export const codigoValido = (c) => typeof c === "string" && /^[a-z0-9]{6}$/.test(c);

/** Anfitrión: abre la sala con el código y avisa cuando entra (o vuelve) el invitado. */
export function abrirSala(codigo, { alAbrir, alEntrar, alMensaje, alSalir, alError }) {
  let peer, conn = null, intentos = 0, cerrado = false;
  const crear = () => {
    peer = new Peer(PREFIJO + codigo, ICE);
    peer.on("open", () => { intentos = 0; alAbrir?.(); });
    peer.on("connection", (c) => {
      c.on("open", () => {
        if (conn && conn.open && conn !== c) { c.send({ t: "lleno" }); setTimeout(() => c.close(), 300); return; }
        conn = c; alEntrar?.();
      });
      c.on("data", (m) => { if (c === conn && m && typeof m === "object") alMensaje?.(m); });
      c.on("close", () => { if (c === conn) { conn = null; alSalir?.(); } });
    });
    peer.on("disconnected", () => { try { if (!cerrado) peer.reconnect(); } catch { /* ok */ } });
    peer.on("error", (e) => {
      // si la pestaña se recargó, el id viejo tarda unos segundos en liberarse
      if (e.type === "unavailable-id" && intentos++ < 8) { peer.destroy(); setTimeout(crear, 2500); return; }
      alError?.(e);
    });
  };
  crear();
  return { enviar: (m) => { if (conn?.open) conn.send(m); }, conectado: () => !!conn?.open, cerrar: () => { cerrado = true; peer.destroy(); } };
}

/** Invitado: se conecta a la sala y reintenta si se corta. */
export function entrarSala(codigo, { alConectar, alMensaje, alCortar, alError }) {
  let peer, conn = null, cerrado = false, timer = null;
  const conectar = () => {
    if (cerrado) return;
    conn = peer.connect(PREFIJO + codigo, { reliable: true });
    conn.on("open", () => alConectar?.());
    conn.on("data", (m) => { if (m && typeof m === "object") alMensaje?.(m); });
    conn.on("close", () => { alCortar?.(); reintentar(); });
  };
  const reintentar = () => { clearTimeout(timer); if (!cerrado) timer = setTimeout(() => (peer.disconnected ? peer.reconnect() : conectar()), 3000); };
  peer = new Peer(ICE);
  peer.on("open", conectar);
  peer.on("disconnected", () => { try { if (!cerrado) peer.reconnect(); } catch { /* ok */ } });
  peer.on("error", (e) => { alError?.(e); if (e.type === "peer-unavailable" || e.type === "network" || e.type === "server-error") reintentar(); });
  return { enviar: (m) => { if (conn?.open) conn.send(m); }, cerrar: () => { cerrado = true; clearTimeout(timer); peer.destroy(); } };
}

/**
 * Anfitrión de una sala de VARIOS (la escoba de a 4, 2026-11-17): estrella con el anfitrión en el centro. Acepta hasta
 * `max` invitados; a cada conexión le da un número (`cid`) y avisa con él. Al que llega con la sala llena le manda
 * `{ t: "lleno" }`. `abrirSala` (de a 2) queda como estaba.
 */
export function abrirSalaVarios(codigo, max, { alAbrir, alEntrar, alMensaje, alSalir, alError }) {
  let peer, intentos = 0, cerrado = false, n = 0;
  const conns = new Map();   // cid → conexión abierta
  const crear = () => {
    peer = new Peer(PREFIJO + codigo, ICE);
    peer.on("open", () => { intentos = 0; alAbrir?.(); });
    peer.on("connection", (c) => {
      let cid = null;
      c.on("open", () => {
        if (conns.size >= max) { c.send({ t: "lleno" }); setTimeout(() => c.close(), 300); return; }
        cid = ++n; conns.set(cid, c); alEntrar?.(cid);
      });
      c.on("data", (m) => { if (cid && conns.get(cid) === c && m && typeof m === "object") alMensaje?.(cid, m); });
      c.on("close", () => { if (cid && conns.get(cid) === c) { conns.delete(cid); alSalir?.(cid); } });
    });
    peer.on("disconnected", () => { try { if (!cerrado) peer.reconnect(); } catch { /* ok */ } });
    peer.on("error", (e) => {
      if (e.type === "unavailable-id" && intentos++ < 8) { peer.destroy(); setTimeout(crear, 2500); return; }
      alError?.(e);
    });
  };
  crear();
  return {
    enviar: (cid, m) => { const c = conns.get(cid); if (c?.open) c.send(m); },
    todos: (m, salvo = null) => { for (const [cid, c] of conns) if (cid !== salvo && c.open) c.send(m); },
    cortar: (cid) => { const c = conns.get(cid); conns.delete(cid); try { c?.close(); } catch { /* ok */ } },
    conectados: () => [...conns.keys()],
    cerrar: () => { cerrado = true; peer.destroy(); },
  };
}
