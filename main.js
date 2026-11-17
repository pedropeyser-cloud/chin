// Arranque de la plataforma: lobby (Jugar / Pulpería / Vos) y los juegos del catálogo (nucleo/registro.js).
// Todo el estado de cuenta vive en nucleo/nube.js; cada juego se abre con su propio flujo (juegos/<id>/flujo.js).
import "./nucleo/vigia.js";
import "./nucleo/sin-red.js";
import * as nube from "./nucleo/nube.js";
import { montarLobby } from "./nucleo/lobby.js";
import { juegoPorId } from "./nucleo/registro.js";
import { estiloParaMesa, formaDe } from "./nucleo/catalogo.js";

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
let desmontarLobby = null, juegoAbierto = null;

/** Quién soy para las mesas: el perfil si hay, o un invitado. */
function yo(enRed = false) {
  const p = nube.miPerfil();
  if (!p) return { nombre: enRed ? "Jugador" : "Vos", estilo: {}, id: null };
  return { nombre: p.usuario, estilo: { ...estiloParaMesa(p), cara: formaDe(p) }, id: p.id };
}

/** Al terminar una partida con un amigo: el anfitrión la propone y cada uno la confirma (queda en el historial cuando
 *  confirmaron los dos; los juegos de la plataforma no dan gloria). `juego` y `restantes` los pone cada juego (CHIN por defecto). */
async function alFin({ v, fuente, codigo, n, juego = "chin", restantes }) {
  const p = nube.miPerfil();
  if (!p || fuente.esLocal) return;
  const ids = fuente.jugadores().map((j) => j.id);
  if (ids[fuente.yo] !== p.id || v.ganador === null) return;
  // de a 4 (escoba en parejas): se anotan las personas con cuenta, cada una con su pareja (asiento % 2); hace falta al
  // menos una de cada lado. Los bots y los que entran sin cuenta no se anotan.
  const de4 = ids.length === 4;
  const jugadores = de4 ? ids.map((x, a) => (x ? { id: x, lado: a % 2 } : null)).filter(Boolean) : [{ id: ids[0], lado: 0 }, { id: ids[1], lado: 1 }];
  if (jugadores.some((j) => !j.id) || new Set(jugadores.map((j) => j.id)).size !== jugadores.length) return;
  if (!jugadores.some((j) => j.lado === 0) || !jugadores.some((j) => j.lado === 1)) return;
  const id = `${juego}-${codigo}-${n}`;
  try {
    if (fuente.esAnfitrion) {
      await nube.registrarPartidaJuego({ id, juego, ganador: v.ganador, restantes: restantes ?? v.cartas[1 - v.ganador], jugadores });
    }
    await nube.confirmarPartidaJuego(id, v.ganador);
  } catch (e) { console.warn("no se pudo anotar la partida:", e.message); }
}

const ctx = {
  yo: () => yo(true),
  volver: () => { limpiarJuego(); history.replaceState(null, "", location.pathname); inicio(); },
  alFin,
};
function limpiarJuego() { if (juegoAbierto) { juegoAbierto.cerrar?.(); juegoAbierto = null; } }

function inicio(tab = "jugar") {
  if (desmontarLobby) desmontarLobby();
  desmontarLobby = montarLobby(app, { tab, abrirJuego });
}

async function abrirJuego(id) {
  const j = juegoPorId(id);
  if (!j) return;
  if (j.estado === "enlace") { location.href = j.url; return; }
  if (desmontarLobby) { desmontarLobby(); desmontarLobby = null; }
  juegoAbierto = await j.abrir();
  juegoAbierto.menu(app, { ...ctx, yo: () => yo(false) });
}

async function arrancar() {
  // la sesión de Google vuelve en la URL: esperamos un momento para entrar con el perfil puesto
  await Promise.race([nube.iniciar().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  const sala = params.get("sala");
  if (sala && /^[a-z0-9]{6}$/.test(sala)) {
    const j = juegoPorId(params.get("juego") || "chin");
    if (j?.abrir) { juegoAbierto = await j.abrir(); juegoAbierto.entrar(app, sala, ctx); return; }
  }
  // pruebas en el navegador: ?auto=1 salta el lobby y juega contra el bot (&dif=tranquilo|rapido|implacable);
  // &juego=escoba elige el juego (CHIN por defecto); el tutorial de CHIN solo aparece con &tutorial=1; &semilla=n fija el reparto
  if (params.get("auto")) {
    const j = juegoPorId(params.get("juego") || "chin") || juegoPorId("chin");
    juegoAbierto = await j.abrir();
    const semilla = params.get("semilla") ? Number(params.get("semilla")) : undefined;
    // `n=4&socio=…`: la escoba de a 4 contra bots (socio: tranquilo | rapido | implacable)
    juegoAbierto.contraBot(app, { ...ctx, yo: () => yo(false) }, params.get("dif"), { tutorial: params.get("tutorial") === "1", semilla, jugadores: Number(params.get("n")) || undefined, companero: params.get("socio") || undefined });
    return;
  }
  inicio(params.get("tab") || "jugar");
}
arrancar();
