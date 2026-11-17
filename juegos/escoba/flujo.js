// Pantallas de la escoba antes y después de la mesa: menú («de a 2» o «de a 4», rival o compañero, invitar), salas de
// espera e ingreso por link (`?sala=…&juego=escoba`, con `&n=4` si es de a 4).
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?({ v, fuente, codigo, n, juego, restantes }) }
import { escoba } from "./index.js";
import { crearAnfitrion, entrarComoInvitado } from "./red-fuente.js";
import { crearAnfitrion4, entrarComoInvitado4 } from "./red4-fuente.js";
import { sonido } from "../../nucleo/sonido.js";
import { pedirPantallaCompleta } from "./mesa.js";
import { PERSONAJES } from "./personajes.js";

const DIFS = ["tranquilo", "rapido", "implacable"].map((k) => ({ k, p: PERSONAJES[k] }));
// de a 4 elegís el compañero: los otros dos son los rivales (con El Relámpago de socio es fácil y hay tiza)
const SOCIOS = [
  { k: "implacable", nivel: "fácil", nota: "rivales: Don Tranqui y Rata · con la tiza" },
  { k: "rapido", nivel: "medio", nota: "rivales: Don Tranqui y El Relámpago" },
  { k: "tranquilo", nivel: "difícil", nota: "rivales: Rata y El Relámpago" },
];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const leer = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };
let dificultad = leer("escoba.dif", "rapido");
let companero = leer("escoba.socio", "implacable");
let modo = leer("escoba.modo", "2") === "4" ? 4 : 2;

let baja = null;
export function cerrar() { if (baja) { baja(); baja = null; } }
/** Lo que va al historial: el ganador (la pareja, de a 4) y los puntos del que perdió. */
const datosFin = (v) => ({ juego: "escoba", restantes: v.puntos[1 - v.ganador] });

export function menu(app, ctx) {
  cerrar();
  app.innerHTML = `
    <main class="inicio juego-menu escoba-menu">
      <h1 class="sello">Escoba</h1>
      <p class="lema">De quince, como en la mesa de la cocina. Levantá cartas que sumen 15 con la tuya y barré la mesa.</p>
      <div class="modo-escoba" role="radiogroup" aria-label="Cuántos juegan">
        <button class="modo" role="radio" data-m="2" aria-checked="${modo === 2}"><b>de a 2</b><small>mano a mano</small></button>
        <button class="modo" role="radio" data-m="4" aria-checked="${modo === 4}"><b>de a 4</b><small>dos parejas</small></button>
      </div>
      <div class="de2" ${modo === 4 ? "hidden" : ""}>
        <div class="grupo">
          <span class="etiqueta">contra el bot</span>
          <div class="dificultades">${DIFS.map((d) => `<button class="dif" data-k="${d.k}" aria-pressed="${d.k === dificultad}"><b>${d.p.nombre}</b><small>${d.k === "tranquilo" ? "con la tiza que suma" : d.k === "rapido" ? "sopla seguido" : "no se le escapa nada"}</small></button>`).join("")}</div>
          <button class="boton primario jugar">Jugar contra el bot</button>
        </div>
        <div class="grupo">
          <span class="etiqueta">con un amigo (queda en el historial si los dos tienen usuario)</span>
          <button class="boton amigo">Invitar a un amigo por link</button>
        </div>
      </div>
      <div class="de4" ${modo === 2 ? "hidden" : ""}>
        <div class="grupo">
          <span class="etiqueta">elegí a tu compañero (los otros dos son los rivales)</span>
          <div class="dificultades">${SOCIOS.map((s) => `<button class="socio" data-k="${s.k}" aria-pressed="${s.k === companero}"><b>${PERSONAJES[s.k].nombre}</b><small>${s.nivel} · ${s.nota}</small></button>`).join("")}</div>
          <button class="boton primario jugar4">Jugar con bots</button>
        </div>
        <div class="grupo">
          <span class="etiqueta">con amigos: los lugares que falten los ocupan bots (al historial va si hay una persona con usuario en cada pareja)</span>
          <button class="boton amigos4">Invitar amigos por link</button>
        </div>
      </div>
      <details class="reglas"><summary>Cómo se juega</summary><ul>
        <li>Mazo español de 40, sin 8 ni 9. Las cartas valen lo que dicen; la sota 8, el caballo 9 y el rey 10.</li>
        <li>Tres cartas para cada uno y cuatro a la mesa. Si las de la mesa suman 15 (o 30), se las lleva el que repartió, como escoba.</li>
        <li>En tu turno marcá las cartas de la mesa que suman 15 con la tuya y soltá tu carta encima (o tocá «Levantar»). La cuenta la hacés vos: soltarla en el paño sin nada marcado es tirarla.</li>
        <li><b>Soplo:</b> si el otro tira sin levantar y había 15, tocá «¡Soplo!», marcá la que tiró y las que sumaban con ella, y te las llevás. Vale hasta que juegue el que sigue. Nadie te avisa si había.</li>
        <li>Contra Don Tranqui hay ayuda: una tiza va sumando y, si hay una sola forma de levantar, se hace sola.</li>
        <li>Si dejás la mesa vacía es escoba: queda cruzada sobre tu montón y vale un punto.</li>
        <li>Al final del mazo, lo que queda en la mesa es para el último que levantó (no es escoba).</li>
        <li>En cada mano suman: cada escoba, más cartas, más oros, el siete de oro y la setenta (más sietes; si empatan, más seises). Se juega a 15.</li>
        <li><b>De a 4:</b> parejas enfrentadas; la ronda va hacia la derecha y el que reparte también rota a la derecha. Todo se cuenta por pareja. Al que tira sin levantar le pueden soplar los dos rivales, hasta que juegue el que sigue; al compañero no se le sopla.</li>
      </ul></details>
      <button class="boton suave volver">← Volver al inicio</button>
    </main>`;
  const elegir = (sel, attr, fn) => app.querySelectorAll(sel).forEach((b) => b.addEventListener("click", () => {
    fn(b.dataset[attr]);
    app.querySelectorAll(sel).forEach((x) => x.setAttribute(sel === ".modo" ? "aria-checked" : "aria-pressed", x === b));
  }));
  elegir(".dif", "k", (k) => { dificultad = k; guardar("escoba.dif", k); });
  elegir(".socio", "k", (k) => { companero = k; guardar("escoba.socio", k); });
  elegir(".modo", "m", (m) => {
    modo = m === "4" ? 4 : 2; guardar("escoba.modo", String(modo));
    app.querySelector(".de2").hidden = modo === 4; app.querySelector(".de4").hidden = modo === 2;
  });
  app.querySelector(".jugar").addEventListener("click", () => contraBot(app, ctx));
  app.querySelector(".amigo").addEventListener("click", () => invitar(app, ctx));
  app.querySelector(".jugar4").addEventListener("click", () => contraBot(app, ctx, null, { jugadores: 4 }));
  app.querySelector(".amigos4").addEventListener("click", () => invitar4(app, ctx));
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
}

/** Contra los bots. De a 4 (`jugadores: 4`), `companero` es el bot que va con vos. */
export function contraBot(app, ctx, dif, { semilla, jugadores, companero: socio } = {}) {
  if (dif && DIFS.some((d) => d.k === dif)) dificultad = dif;
  if (socio && DIFS.some((d) => d.k === socio)) companero = socio;
  const de4 = jugadores === 4;
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const p = ctx.yo();
  baja = escoba.montar(app, {
    dificultad, semilla, nombre: p.nombre, estilo: p.estilo, salir: ctx.volver,
    jugadores: de4 ? 4 : 2, companero,
    otraDificultad: () => menu(app, ctx), alCrear: (f) => { window.__fuente = f; },
  });
}

/** Comparte el link: copiar y, en el celular, el menú de compartir. */
function compartir(app, link, texto) {
  const input = app.querySelector(".link");
  app.querySelector(".copiar").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(link); e.target.textContent = "¡Copiado!"; }
    catch { input.select(); e.target.textContent = "Seleccionado: copialo"; }
  });
  if (navigator.share) {
    const b = app.querySelector(".compartir");
    b.hidden = false;
    b.addEventListener("click", () => navigator.share({ title: "Escoba", text: texto, url: link }).catch(() => {}));
  }
}
const errorSala = (e) => (["network", "server-error", "socket-error", "socket-closed"].includes(e?.type)
  ? "No pude conectar con el servidor de salas. Revisá tu internet y probá de nuevo."
  : "No se pudo armar la sala. Probá de nuevo.");

function invitar(app, ctx) {
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const a = crearAnfitrion(ctx.yo());
  baja = () => a.cerrar();
  app.innerHTML = `
    <main class="inicio sala">
      <h1 class="sello chico">Escoba</h1>
      <p class="lema" id="estado">Armando la sala…</p>
      <div class="grupo" id="compartir" hidden>
        <span class="etiqueta">mandale este link a tu amigo</span>
        <input class="link" readonly value="${esc(a.link)}" aria-label="Link de la sala">
        <button class="boton primario copiar">Copiar link</button>
        <button class="boton compartir" hidden>Compartir…</button>
      </div>
      <button class="boton suave volver">Cancelar</button>
    </main>`;
  const estado = app.querySelector("#estado");
  a.alAbrir(() => { estado.textContent = "Esperando que entre tu amigo…"; app.querySelector("#compartir").hidden = false; });
  a.alError((e) => { estado.textContent = errorSala(e); });
  let n = 0;
  a.alEntrar(() => {
    if (a._empezada) return;   // el invitado volvió a conectarse: la mesa ya está
    a._empezada = true;
    a.empezar();
    const mesa = escoba.montar(app, {
      fuente: a.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: a.fuente, codigo: a.codigo, n: ++n, ...datosFin(v) }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); a.cerrar(); };
  });
  compartir(app, a.link, "¿Una escoba de 15? Entrá con este link.");
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  window.__anfitrion = a;   // solo para pruebas
}

// ---------- de a 4 ----------
/** Las cuatro sillas en cruz, vistas desde `yo` (el anfitrión es el 0). `editable`: el anfitrión mueve y cambia bots. */
function sillasHTML(sillas, yo, editable, elegida) {
  const silla = (r) => {
    const j = (yo + r) % 4, s = sillas[j];
    const tipo = s.tipo === "bot" ? "bot" : j === yo ? "vos" : s.tipo === "anfitrion" ? "armó la sala" : "amigo";
    const lugar = r === 0 ? "vos" : r === 2 ? "compañero" : "rival";
    return `<div class="silla s${r} ${s.tipo}${elegida === j ? " elegida" : ""}" data-j="${j}">
      <small>${lugar}</small><b>${esc(s.nombre)}</b><i>${tipo}</i>
      ${editable && j !== 0 ? `<div class="silla-acc">${s.tipo === "bot" ? `<button class="boton chico" data-bot="${j}">Otro bot</button>` : ""}<button class="boton chico" data-mover="${j}">${elegida === j ? "Elegí otra silla" : "Cambiar de lugar"}</button></div>` : ""}
    </div>`;
  };
  return `<div class="sala4">${[2, 3, 1, 0].map(silla).join("")}<div class="sala4-sol" aria-hidden="true">↺</div></div>`;
}

function invitar4(app, ctx) {
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const a = crearAnfitrion4(ctx.yo(), { meta: Number(window.__metaEscoba) || 15 });   // __metaEscoba: solo pruebas
  baja = () => a.cerrar();
  app.innerHTML = `
    <main class="inicio sala sala-de4">
      <h1 class="sello chico">Escoba de a 4</h1>
      <p class="lema" id="estado">Armando la sala…</p>
      <div class="grupo" id="compartir" hidden>
        <span class="etiqueta">mandales este link a tus amigos (hasta 3)</span>
        <input class="link" readonly value="${esc(a.link)}" aria-label="Link de la sala">
        <button class="boton primario copiar">Copiar link</button>
        <button class="boton compartir" hidden>Compartir…</button>
      </div>
      <div class="sillas"></div>
      <button class="boton primario empezar" disabled>Empezar</button>
      <button class="boton suave volver">Cancelar</button>
    </main>`;
  const estado = app.querySelector("#estado"), sillasEl = app.querySelector(".sillas"), empezar = app.querySelector(".empezar");
  let elegida = null;
  const pintar = () => {
    sillasEl.innerHTML = sillasHTML(a.sillas(), 0, true, elegida);
    const p = a.personas();
    empezar.textContent = p ? `Empezar (${p} ${p === 1 ? "amigo" : "amigos"} y ${3 - p} ${3 - p === 1 ? "bot" : "bots"})` : "Empezar con bots";
  };
  sillasEl.addEventListener("click", (e) => {
    const bb = e.target.closest("[data-bot]"), mv = e.target.closest("[data-mover]"), s = e.target.closest(".silla");
    const j = mv ? Number(mv.dataset.mover) : s ? Number(s.dataset.j) : null;
    // con una silla elegida, tocar cualquier parte de otra (también sus botones) la cambia de lugar
    if (bb && (elegida === null || elegida === j)) { a.cambiarBot(Number(bb.dataset.bot)); return; }
    if (j === null || j === 0) return;
    if (elegida === null) { elegida = j; pintar(); return; }
    if (elegida !== j) a.mover(elegida, j);
    elegida = null; pintar();
  });
  a.alSala(pintar);
  a.alAbrir(() => {
    estado.textContent = "Esperando a tus amigos. Los lugares vacíos los ocupan bots.";
    app.querySelector("#compartir").hidden = false;
    empezar.disabled = false;
    pintar();
  });
  a.alError((e) => { estado.textContent = errorSala(e); });
  pintar();
  let n = 0;
  empezar.addEventListener("click", () => {
    a.empezar();
    const mesa = escoba.montar(app, {
      fuente: a.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: a.fuente, codigo: a.codigo, n: ++n, ...datosFin(v) }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); a.cerrar(); };
  });
  compartir(app, a.link, "¿Una escoba de a 4? Entrá con este link.");
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  window.__anfitrion = a;   // solo para pruebas
}

function entrar4(app, codigo, ctx) {
  sonido.despertar();
  cerrar();
  const inv = entrarComoInvitado4(codigo, ctx.yo());
  baja = () => inv.fuente.destruir();
  app.innerHTML = `<main class="inicio sala sala-de4"><h1 class="sello chico">Escoba de a 4</h1><p class="lema" id="estado">Entrando a la sala…</p><div class="sillas"></div><button class="boton suave volver">Cancelar</button></main>`;
  app.querySelector(".volver").addEventListener("click", () => { inv.fuente.irse(); ctx.volver(); });
  inv.alSala((s) => {
    const t = app.querySelector("#estado"), el = app.querySelector(".sillas");
    if (!t || s.tuya === null) return;
    t.textContent = `Tu lugar: ${s.tuya === 2 ? `compañero de ${s.sillas[0].nombre}` : `rival de ${s.sillas[0].nombre}, ${s.tuya === 1 ? "a su derecha" : "a su izquierda"}`}. Esperando que arranque…`;
    el.innerHTML = sillasHTML(s.sillas, s.tuya, false, null);
  });
  inv.alError((e) => {
    const t = app.querySelector("#estado");
    if (!t) return;
    t.textContent = e?.type === "lleno" ? "Esa mesa ya está completa."
      : e?.type === "empezada" ? "Esa partida ya empezó sin vos."
      : e?.type === "peer-unavailable" ? "Todavía no encuentro la sala. Si tu amigo recién la armó, esperá unos segundos: sigo intentando."
      : "No pude conectar. Sigo intentando…";
  });
  let n = 0;
  inv.alListo(() => {
    pedirPantallaCompleta();
    const mesa = escoba.montar(app, {
      fuente: inv.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: inv.fuente, codigo, n: ++n, ...datosFin(v) }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); inv.fuente.destruir(); };
  });
}

/** Link ?sala=codigo&juego=escoba (con &n=4, la de a 4): entra como invitado. */
export function entrar(app, codigo, ctx) {
  if (new URLSearchParams(location.search).get("n") === "4") { entrar4(app, codigo, ctx); return; }
  sonido.despertar();
  cerrar();
  const inv = entrarComoInvitado(codigo, ctx.yo());
  baja = () => inv.fuente.destruir();
  app.innerHTML = `<main class="inicio sala"><h1 class="sello chico">Escoba</h1><p class="lema" id="estado">Entrando a la sala…</p><button class="boton suave volver">Cancelar</button></main>`;
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  inv.alError((e) => {
    const t = app.querySelector("#estado");
    if (!t) return;
    t.textContent = e?.type === "lleno" ? "Esa sala ya tiene dos jugadores."
      : e?.type === "peer-unavailable" ? "Todavía no encuentro la sala. Si tu amigo recién la armó, esperá unos segundos: sigo intentando."
      : "No pude conectar. Sigo intentando…";
  });
  let n = 0;
  inv.alListo(() => {
    const mesa = escoba.montar(app, {
      fuente: inv.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: inv.fuente, codigo, n: ++n, ...datosFin(v) }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); inv.fuente.destruir(); };
  });
}
