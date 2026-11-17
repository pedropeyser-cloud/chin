// Pantallas de la escoba antes y después de la mesa: menú (rival / invitar), sala de espera e ingreso por link.
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?({ v, fuente, codigo, n, juego, restantes }) }
import { escoba } from "./index.js";
import { crearAnfitrion, entrarComoInvitado } from "./red-fuente.js";
import { sonido } from "../../nucleo/sonido.js";
import { pedirPantallaCompleta } from "./mesa.js";
import { PERSONAJES } from "./personajes.js";

const DIFS = ["tranquilo", "rapido", "implacable"].map((k) => ({ k, p: PERSONAJES[k] }));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let dificultad = "rapido";
try { dificultad = localStorage.getItem("escoba.dif") || dificultad; } catch { /* ok */ }

let baja = null;
export function cerrar() { if (baja) { baja(); baja = null; } }
/** Lo que va al historial: el ganador y los puntos del que perdió. */
const datosFin = (v) => ({ juego: "escoba", restantes: v.puntos[1 - v.ganador] });

export function menu(app, ctx) {
  cerrar();
  app.innerHTML = `
    <main class="inicio juego-menu escoba-menu">
      <h1 class="sello">Escoba</h1>
      <p class="lema">De quince, como en la mesa de la cocina. Levantá cartas que sumen 15 con la tuya y barré la mesa.</p>
      <div class="grupo">
        <span class="etiqueta">contra el bot</span>
        <div class="dificultades">${DIFS.map((d) => `<button class="dif" data-k="${d.k}" aria-pressed="${d.k === dificultad}"><b>${d.p.nombre}</b><small>${d.k === "tranquilo" ? "con la tiza que suma" : d.k === "rapido" ? "sopla seguido" : "no se le escapa nada"}</small></button>`).join("")}</div>
        <button class="boton primario jugar">Jugar contra el bot</button>
      </div>
      <div class="grupo">
        <span class="etiqueta">con un amigo (queda en el historial si los dos tienen usuario)</span>
        <button class="boton amigo">Invitar a un amigo por link</button>
      </div>
      <details class="reglas"><summary>Cómo se juega</summary><ul>
        <li>Mazo español de 40, sin 8 ni 9. Las cartas valen lo que dicen; la sota 8, el caballo 9 y el rey 10.</li>
        <li>Tres cartas para cada uno y cuatro a la mesa. Si las de la mesa suman 15 (o 30), se las lleva el que repartió, como escoba.</li>
        <li>En tu turno marcá las cartas de la mesa que suman 15 con la tuya y soltá tu carta encima (o tocá «Levantar»). La cuenta la hacés vos: soltarla en el paño sin nada marcado es tirarla.</li>
        <li><b>Soplo:</b> si el otro tira sin levantar y había 15, tocá «¡Soplo!», marcá la que tiró y las que sumaban con ella, y te las llevás. Vale hasta que hagas tu jugada. Nadie te avisa si había.</li>
        <li>Contra Don Tranqui hay ayuda: una tiza va sumando y, si hay una sola forma de levantar, se hace sola.</li>
        <li>Si dejás la mesa vacía es escoba: queda cruzada sobre tu montón y vale un punto.</li>
        <li>Al final del mazo, lo que queda en la mesa es para el último que levantó (no es escoba).</li>
        <li>En cada mano suman: cada escoba, más cartas, más oros, el siete de oro y la setenta (más sietes; si empatan, más seises). Se juega a 15.</li>
      </ul></details>
      <button class="boton suave volver">← Volver al inicio</button>
    </main>`;
  app.querySelectorAll(".dif").forEach((b) => b.addEventListener("click", () => {
    dificultad = b.dataset.k;
    try { localStorage.setItem("escoba.dif", dificultad); } catch { /* ok */ }
    app.querySelectorAll(".dif").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  app.querySelector(".jugar").addEventListener("click", () => contraBot(app, ctx));
  app.querySelector(".amigo").addEventListener("click", () => invitar(app, ctx));
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
}

export function contraBot(app, ctx, dif, { semilla } = {}) {
  if (dif && DIFS.some((d) => d.k === dif)) dificultad = dif;
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const p = ctx.yo();
  baja = escoba.montar(app, { dificultad, semilla, nombre: p.nombre, estilo: p.estilo, salir: ctx.volver, otraDificultad: () => menu(app, ctx), alCrear: (f) => { window.__fuente = f; } });
}

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
  a.alError((e) => {
    estado.textContent = ["network", "server-error", "socket-error", "socket-closed"].includes(e?.type)
      ? "No pude conectar con el servidor de salas. Revisá tu internet y probá de nuevo."
      : "No se pudo armar la sala. Probá de nuevo.";
  });
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
  const input = app.querySelector(".link");
  app.querySelector(".copiar").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(a.link); e.target.textContent = "¡Copiado!"; }
    catch { input.select(); e.target.textContent = "Seleccionado: copialo"; }
  });
  if (navigator.share) {
    const b = app.querySelector(".compartir");
    b.hidden = false;
    b.addEventListener("click", () => navigator.share({ title: "Escoba", text: "¿Una escoba de 15? Entrá con este link.", url: a.link }).catch(() => {}));
  }
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  window.__anfitrion = a;   // solo para pruebas
}

/** Link ?sala=codigo&juego=escoba: entra como invitado. */
export function entrar(app, codigo, ctx) {
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
