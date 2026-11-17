// Pantallas de la canasta antes y después de la mesa: menú (rival / invitar), sala de espera e ingreso por link.
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?({ v, fuente, codigo, n, juego, restantes }) }
import { canasta } from "./index.js";
import { crearAnfitrion, entrarComoInvitado } from "./red-fuente.js";
import { sonido } from "../../nucleo/sonido.js";
import { pedirPantallaCompleta } from "./mesa.js";
import { PERSONAJES } from "./personajes.js";

const DIFS = ["tranquilo", "rapido", "implacable"].map((k) => ({ k, p: PERSONAJES[k] }));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let dificultad = "rapido";
try { dificultad = localStorage.getItem("canasta.dif") || dificultad; } catch { /* ok */ }

let baja = null;
export function cerrar() { if (baja) { baja(); baja = null; } }
/** Lo que va al historial: el ganador y los puntos del que perdió. */
const datosFin = (v) => ({ juego: "canasta", restantes: Math.min(20000, Math.max(0, v.puntos[1 - v.ganador])) });

export function menu(app, ctx) {
  cerrar();
  app.innerHTML = `
    <main class="inicio juego-menu canasta-menu">
      <h1 class="sello">Canasta</h1>
      <p class="lema">Como en las tardes largas: juntá siete iguales, armá tus canastas y, con dos, te vas.</p>
      <div class="grupo">
        <span class="etiqueta">contra el bot</span>
        <div class="dificultades">${DIFS.map((d) => `<button class="dif" data-k="${d.k}" aria-pressed="${d.k === dificultad}"><b>${d.p.nombre}</b><small>${d.k === "tranquilo" ? "tira sin mirarte" : d.k === "rapido" ? "va por el pozo" : "se acuerda de lo que tirás"}</small></button>`).join("")}</div>
        <button class="boton primario jugar">Jugar contra el bot</button>
      </div>
      <div class="grupo">
        <span class="etiqueta">con un amigo (queda en el historial si los dos tienen usuario)</span>
        <button class="boton amigo">Invitar a un amigo por link</button>
      </div>
      <details class="reglas"><summary>Cómo se juega</summary><ul>
        <li>Dos mazos franceses y cuatro comodines. Quince cartas para cada uno. En tu turno robás dos del mazo (o levantás el pozo), bajás si querés y tirás una.</li>
        <li>Un juego son tres o más cartas del mismo número. Los 2 y los comodines son libres: van en cualquier juego, siempre con más naturales que libres y hasta tres.</li>
        <li>Siete cartas del mismo número son una canasta: pura sin libres (500) o impura (300).</li>
        <li>La primera vez que bajás tenés que sumar un mínimo: 50, 90 desde 1000 puntos, 120 desde 2000 y 150 desde 3000. Comodín 50; as y 2, 20; del 8 a la K, 10; del 4 al 7 y el 3 negro, 5.</li>
        <li>El pozo se levanta con dos cartas iguales a la de arriba (o una y una libre). Si tiene una libre adentro está congelado y hacen falta dos naturales. Un 3 negro arriba lo tapa.</li>
        <li>Los 3 rojos van a la mesa solos: 100 cada uno, 800 los cuatro, y restan si no bajaste nada.</li>
        <li>Con dos canastas te podés ir: bajás todo o tirás la última. Cerrar suma 100 y al otro le resta lo que tiene en la mano. Se juega a 5000.</li>
      </ul></details>
      <button class="boton suave volver">← Volver al inicio</button>
    </main>`;
  app.querySelectorAll(".dif").forEach((b) => b.addEventListener("click", () => {
    dificultad = b.dataset.k;
    try { localStorage.setItem("canasta.dif", dificultad); } catch { /* ok */ }
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
  baja = canasta.montar(app, { dificultad, semilla, nombre: p.nombre, estilo: p.estilo, salir: ctx.volver, otraDificultad: () => menu(app, ctx), alCrear: (f) => { window.__fuente = f; } });
}

function invitar(app, ctx) {
  sonido.despertar();
  pedirPantallaCompleta();
  cerrar();
  const a = crearAnfitrion(ctx.yo());
  baja = () => a.cerrar();
  app.innerHTML = `
    <main class="inicio sala">
      <h1 class="sello chico">Canasta</h1>
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
    const mesa = canasta.montar(app, {
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
    b.addEventListener("click", () => navigator.share({ title: "Canasta", text: "¿Una canasta? Entrá con este link.", url: a.link }).catch(() => {}));
  }
  app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  window.__anfitrion = a;   // solo para pruebas
}

/** Link ?sala=codigo&juego=canasta: entra como invitado. */
export function entrar(app, codigo, ctx) {
  sonido.despertar();
  cerrar();
  const inv = entrarComoInvitado(codigo, ctx.yo());
  baja = () => inv.fuente.destruir();
  app.innerHTML = `<main class="inicio sala"><h1 class="sello chico">Canasta</h1><p class="lema" id="estado">Entrando a la sala…</p><button class="boton suave volver">Cancelar</button></main>`;
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
    const mesa = canasta.montar(app, {
      fuente: inv.fuente, salir: ctx.volver,
      alFin: (v) => ctx.alFin?.({ v, fuente: inv.fuente, codigo, n: ++n, ...datosFin(v) }),
      alCrear: (f) => { window.__fuente = f; },
    });
    baja = () => { mesa(); inv.fuente.destruir(); };
  });
}
