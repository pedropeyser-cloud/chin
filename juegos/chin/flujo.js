// Pantallas de CHIN antes y después de la mesa: menú (dificultad / invitar), sala de espera e ingreso por link.
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?({ v, fuente, codigo, n }) }
import { chin } from "./index.js";
import { crearAnfitrion, entrarComoInvitado } from "./red-fuente.js";
import { sonido } from "../../nucleo/sonido.js";

const DIFS = [
  { k: "tranquilo", n: "Tranquilo", d: "te da tiempo" },
  { k: "rapido", n: "Rápido", d: "no se duerme" },
  { k: "implacable", n: "Implacable", d: "casi no falla" },
];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let dificultad = "rapido";
try { dificultad = localStorage.getItem("chin.dif") || dificultad; } catch { /* ok */ }

let baja = null;
export function cerrar() { if (baja) { baja(); baja = null; } }

export function menu(app, ctx) {
  cerrar();
  app.innerHTML = `
    <main class="inicio juego-menu">
      <h1 class="sello">CHIN</h1>
      <p class="lema">Dos pilas, dos mazos, un solo grito. Gana el que más rápido canta.</p>
      <div class="grupo">
        <span class="etiqueta">contra el bot (no suma gloria)</span>
        <div class="dificultades">${DIFS.map((d) => `<button class="dif" data-k="${d.k}" aria-pressed="${d.k === dificultad}"><b>${d.n}</b><small>${d.d}</small></button>`).join("")}</div>
        <button class="boton primario jugar">Jugar contra el bot</button>
      </div>
      <div class="grupo">
        <span class="etiqueta">con un amigo (suma gloria si los dos tienen usuario)</span>
        <button class="boton amigo">Invitar a un amigo por link</button>
      </div>
      <details class="reglas"><summary>Cómo se juega</summary><ul>
        <li>Cada uno tiene su mazo español completo, boca abajo.</li>
        <li>Tocá una pila para dar vuelta tu carta y ponerla ahí. No hay turnos: gana el más rápido.</li>
        <li>Cuando las cartas de arriba de las dos pilas son iguales (mismo número y palo), el sol se prende: tocalo para cantar CHIN.</li>
        <li>El que canta primero gana y el otro se lleva las dos pilas. Si el rival movió antes, ya no vale.</li>
        <li>Gana el primero que se queda sin cartas. En la compu: espacio = CHIN, ← y → = pilas.</li>
      </ul></details>
      <button class="boton suave volver">← Volver al inicio</button>
    </main>`;
  app.querySelectorAll(".dif").forEach((b) => b.addEventListener("click", () => {
    dificultad = b.dataset.k;
    try { localStorage.setItem("chin.dif", dificultad); } catch { /* ok */ }
    app.querySelectorAll(".dif").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));
  app.querySelector(".jugar").addEventListener("click", () => contraBot(app, ctx));
  app.querySelector(".amigo").addEventListener("click", () => invitar(app, ctx));
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
}

export function contraBot(app, ctx, dif) {
  if (dif && DIFS.some((d) => d.k === dif)) dificultad = dif;
  sonido.despertar();
  cerrar();
  const p = ctx.yo();
  baja = chin.montar(app, { dificultad, nombre: p.nombre, estilo: p.estilo, salir: ctx.volver, otraDificultad: () => menu(app, ctx), alCrear: (f) => { window.__fuente = f; } });
}

function invitar(app, ctx) {
  sonido.despertar();
  cerrar();
  const a = crearAnfitrion(ctx.yo());
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
