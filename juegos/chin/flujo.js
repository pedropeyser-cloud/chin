// Pantallas de CHIN antes y después de la mesa: menú (dificultad / invitar), sala de espera e ingreso por link.
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?({ v, fuente, codigo, n }) }
import { chin } from "./index.js";
import { crearAnfitrion, entrarComoInvitado } from "./red-fuente.js";
import { sonido } from "../../nucleo/sonido.js";
import { pedirPantallaCompleta } from "./mesa.js";
import { PERSONAJES } from "./personajes.js";
import { montarTutorial, visto as tutorialVisto } from "./tutorial.js";
import * as D from "./desafio.js";
import * as nube from "../../nucleo/nube.js";

const DIFS = [
  { k: "tranquilo", n: "tranquilo" },
  { k: "rapido", n: "rápido" },
  { k: "implacable", n: "implacable" },
].map((d) => ({ ...d, p: PERSONAJES[d.k] }));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let dificultad = "rapido", formato = 1;
try { dificultad = localStorage.getItem("chin.dif") || dificultad; formato = localStorage.getItem("chin.formato") === "3" ? 3 : 1; } catch { /* ok */ }

let baja = null;
export function cerrar() { if (baja) { baja(); baja = null; } }

export function menu(app, ctx) {
  cerrar();
  app.innerHTML = `
    <main class="inicio juego-menu">
      <h1 class="sello">CHIN</h1>
      <p class="lema">Dos pilas, dos mazos, un solo grito. Gana el que más rápido canta.</p>
      <div class="grupo">
        <span class="etiqueta">cómo se juega la partida</span>
        <div class="formatos" role="group" aria-label="Formato">
          <button class="fmt" data-f="1" aria-pressed="${formato === 1}"><b>Partida</b><small>una sola</small></button>
          <button class="fmt" data-f="3" aria-pressed="${formato === 3}"><b>Al mejor de 3</b><small>gana el que llega a 2</small></button>
        </div>
      </div>
      <div class="grupo">
        <span class="etiqueta">contra el bot</span>
        <div class="dificultades">${DIFS.map((d) => `<button class="dif" data-k="${d.k}" aria-pressed="${d.k === dificultad}"><b>${d.p.nombre}</b><small>${d.p.lema}</small></button>`).join("")}</div>
        <button class="boton primario jugar">Jugar contra el bot</button>
      </div>
      <div class="grupo">
        <span class="etiqueta">con un amigo (queda en el historial si los dos tienen usuario)</span>
        <button class="boton amigo">Invitar a un amigo por link</button>
      </div>
      <div class="grupo desafio">
        <span class="etiqueta">desafío del día · ${D.fechaLinda(D.diaDeHoy())}</span>
        <p class="desafio-lema">El mismo reparto para todos contra ${PERSONAJES[D.BOT_DESAFIO].nombre}. Gana el más rápido; para la tabla cuenta tu primer intento y hace falta cuenta.</p>
        <button class="boton desafio-jugar">Jugar el desafío</button>
        <details class="desafio-tabla"><summary>Ver la tabla de hoy</summary><div class="desafio-filas">Cargando…</div></details>
      </div>
      <details class="reglas"><summary>Cómo se juega</summary><ul>
        <li>Cada uno arranca con su mazo de 48 boca abajo y el centro vacío. Arrastrá 5 cartas del mazo a tu fila y, con la fila completa, una del mazo a tu pila del centro. Cuando las dos pilas tienen carta, se juega.</li>
        <li>Sin turnos, arrastrás cartas de tu fila a cualquier pila si son la que sigue o la anterior: sobre un 12 va un 11 o un 1. Los huecos se llenan arrastrando del mazo a la fila.</li>
        <li>Cuando arriba de las dos pilas queda el mismo número (el palo no importa), el sol se prende: tocalo para cantar CHIN. El otro se lleva las dos pilas y arranca otra ronda: las filas se completan solas y va una de cada mazo a cada pila.</li>
        <li>Si nadie puede tirar, se marcan los mazos: cuando los dos tocan el suyo, va una de cada mazo a cada pila. Gana el primero que se queda sin cartas.</li>
        <li>Para ordenar tu fila, arrastrá una carta sobre otra y cambian de lugar (si son del mismo número, se apilan).</li>
        <li>La rapidez de la mano cuenta: todo se arrastra. En la compu se juega en pantalla completa y espacio = CHIN.</li>
      </ul></details>
      <button class="boton suave ver-tutorial">Ver el tutorial (40 s)</button>
      <button class="boton suave volver">← Volver al inicio</button>
    </main>`;
  app.querySelectorAll(".fmt").forEach((b) => b.addEventListener("click", () => {
    formato = Number(b.dataset.f) === 3 ? 3 : 1;
    try { localStorage.setItem("chin.formato", String(formato)); } catch { /* ok */ }
    app.querySelectorAll(".fmt").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  app.querySelector(".desafio-jugar").addEventListener("click", () => desafio(app, ctx));
  const tabla = app.querySelector(".desafio-tabla");
  tabla.addEventListener("toggle", async () => {
    if (!tabla.open) return;
    const caja = tabla.querySelector(".desafio-filas");
    try {
      const filas = await nube.tablaDesafio(D.diaDeHoy());
      caja.innerHTML = filas === null ? "La tabla necesita conexión con la base." : D.tablaHTML(filas, nube.miPerfil()?.usuario);
    } catch { caja.textContent = "No pude traer la tabla. Probá de nuevo."; }
  });
  app.querySelector(".ver-tutorial").addEventListener("click", () => tutorial(app, ctx, () => menu(app, ctx)));
  app.querySelectorAll(".dif").forEach((b) => b.addEventListener("click", () => {
    dificultad = b.dataset.k;
    try { localStorage.setItem("chin.dif", dificultad); } catch { /* ok */ }
    app.querySelectorAll(".dif").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  app.querySelector(".jugar").addEventListener("click", () => contraBot(app, ctx));
  app.querySelector(".amigo").addEventListener("click", () => invitar(app, ctx));
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
}

/** Tutorial sobre la mesa; al terminar (o saltearlo) sigue con `despues`. */
export function tutorial(app, ctx, despues) {
  sonido.despertar();
  cerrar();
  const p = ctx.yo();
  baja = montarTutorial(app, { nombre: p.nombre, estilo: p.estilo, alTerminar: () => { baja = null; despues(); } });
}

/** `opciones.tutorial = false` saltea el tutorial de la primera vez (las pruebas con ?auto=1 lo usan). */
export function contraBot(app, ctx, dif, { tutorial: conTutorial = true } = {}) {
  if (dif && DIFS.some((d) => d.k === dif)) dificultad = dif;
  sonido.despertar();
  pedirPantallaCompleta();
  // la primera partida arranca con el tutorial (una sola vez)
  if (conTutorial && !tutorialVisto()) { tutorial(app, ctx, () => contraBot(app, ctx, dificultad, { tutorial: false })); return; }
  cerrar();
  const p = ctx.yo();
  baja = chin.montar(app, { dificultad, formato, nombre: p.nombre, estilo: p.estilo, salir: ctx.volver, otraDificultad: () => menu(app, ctx), alCrear: (f) => { window.__fuente = f; } });
}

/** Desafío del día: el reparto de hoy contra Rata. Las revanchas que siguen son partidas comunes. */
async function desafio(app, ctx) {
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const dia = D.diaDeHoy();
  app.innerHTML = `<main class="inicio sala"><h1 class="sello chico">CHIN</h1><p class="lema">Preparando el desafío del día…</p></main>`;
  const modo = await D.empezar(dia);
  const p = ctx.yo();
  let primera = true;
  baja = chin.montar(app, {
    dificultad: D.BOT_DESAFIO, formato: 1, semilla: D.semillaDe(dia), nombre: p.nombre, estilo: p.estilo, salir: ctx.volver,
    pieFin: (el, v, datos) => { if (!primera) return; primera = false; D.pie(el, datos, modo, dia); },
    alCrear: (f) => { window.__fuente = f; },
  });
}

function invitar(app, ctx) {
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const a = crearAnfitrion(ctx.yo(), { formato });
  baja = () => a.cerrar();
  app.innerHTML = `
    <main class="inicio sala">
      <h1 class="sello chico">CHIN</h1>
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
  a.alError((e) => {
    estado.textContent = ["network", "server-error", "socket-error", "socket-closed"].includes(e?.type)
      ? "No pude conectar con el servidor de salas. Revisá tu internet y probá de nuevo."
      : "No se pudo armar la sala. Probá de nuevo.";
  });
  let n = 0;
  a.alEntrar(() => {
    a.empezar();
    const mesa = chin.montar(app, {
      fuente: a.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: a.fuente, codigo: a.codigo, n: ++n }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); a.cerrar(); };
  });
  const input = app.querySelector(".link");
  app.querySelector(".copiar").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(a.link); e.target.textContent = "¡Copiado!"; }
    catch { input.select(); e.target.textContent = "Seleccionado: copialo"; }
  });
  if (navigator.share) {
    const b = app.querySelector(".compartir");
    b.hidden = false;
    b.addEventListener("click", () => navigator.share({ title: "CHIN", text: "Te desafío a CHIN: gana el que más rápido canta.", url: a.link }).catch(() => {}));
  }
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  window.__anfitrion = a;   // solo para pruebas
}

/** Link ?sala=codigo: entra como invitado. */
export function entrar(app, codigo, ctx) {
  sonido.despertar();
  cerrar();
  const inv = entrarComoInvitado(codigo, ctx.yo());
  baja = () => inv.fuente.destruir();
  app.innerHTML = `<main class="inicio sala"><h1 class="sello chico">CHIN</h1><p class="lema" id="estado">Entrando a la sala…</p><button class="boton suave volver">Cancelar</button></main>`;
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
    const mesa = chin.montar(app, {
      fuente: inv.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: inv.fuente, codigo, n: ++n }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); inv.fuente.destruir(); };
  });
}
