// Mesa de la ESCOBA, dirección A «El sol con cruces» + la tiza de la B mientras se arma la jugada.
// Las cartas de la mesa rodean al sol; las escobas quedan cruzadas boca arriba sobre el montón de cada uno.
// Se juega arrastrando: tu carta sobre la mesa (o sobre una carta). Si hay más de una forma de levantar, se tocan
// las cartas que querés llevarte; la tiza va sumando y se pone verde en 15. También se puede tocar en vez de arrastrar.
import { frente, dorso, ROTULO } from "../../nucleo/cartas.js";
import { cara, reaccionar, parpadear } from "../../nucleo/caras.js";
import { sonido } from "../../nucleo/sonido.js";
import { LISTA as EMOTES, textoDe, mudo as emotesMudo, ponerMudo } from "../../nucleo/emotes.js";
import { valor, combinaciones } from "./motor.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (QUIETO ? Math.min(ms, 60) : ms);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FIG = { 10: "sota", 11: "caballo", 12: "rey" };
const nombreCarta = (id) => { const [n, p] = id.split("-"); return `${FIG[n] || n} de ${p}`; };
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch { /* ok */ } };
const suma = (ids) => ids.reduce((s, c) => s + valor(c), 0);
// cada carta de la mesa queda un poco torcida, siempre igual (como tirada a mano)
const giro = (id) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ((h % 13) - 6) * 0.9; };

const SOL = (() => {
  let rayos = "";
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    rayos += `<line x1="${(36 * c).toFixed(1)}" y1="${(36 * s).toFixed(1)}" x2="${(54 * c).toFixed(1)}" y2="${(54 * s).toFixed(1)}"/>`;
  }
  return `<svg viewBox="-60 -60 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><circle r="27"/>${rayos}</g></svg>`;
})();

export function pedirPantallaCompleta() {
  try {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen || !matchMedia("(pointer: fine)").matches) return;
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  } catch { /* ok */ }
}

/**
 * @param {HTMLElement} cont
 * @param {{ fuente: object, salir: () => void, otraDificultad?: () => void, alFin?: (v) => void }} o
 */
export function montarMesa(cont, { fuente, salir, otraDificultad, alFin }) {
  const yo = fuente.yo, rv = 1 - yo;
  const rotuloAntes = ROTULO.texto;
  ROTULO.texto = "escoba";
  const jug = fuente.jugadores();
  let nombres = fuente.vista().nombres;
  const formas = jug.map((j, i) => (Number.isInteger(j.estilo?.cara) ? j.estilo.cara : [2, 4][i]));
  const dorsoDe = (j) => jug[j]?.estilo?.dorso || "clasico";

  cont.innerHTML = "";
  const mesa = el(`
  <div class="mesa escoba">
    <header class="franja arriba">
      <button type="button" class="icono salir-btn" aria-label="Salir de la partida" title="Salir de la partida">←</button>
      <div class="cara-slot rival-cara"><span class="burbuja rival-burbuja"></span></div>
      <div class="quien"><span class="n-rival"></span><button type="button" class="red-punto" hidden aria-label="Conexión"></button><small class="sub-rival"></small></div>
      <div class="puntos rival-puntos" aria-label="Puntos del rival"><b>0</b><small>de 15</small></div>
      <button class="icono emote-btn" aria-label="Reacciones">💬</button>
      <button class="icono pantalla-btn" aria-label="Pantalla completa" title="Pantalla completa" hidden>⛶</button>
      <button class="icono sonido-btn" aria-label="Sonido"></button>
      <div class="emotes-bandeja" hidden></div>
    </header>
    <div class="fila-rival">
      <div class="monton rival-monton" aria-label="Lo que levantó el rival"><div class="cruces"></div><div class="pila-dorsos"></div><b>0</b></div>
      <div class="rival-mano" aria-label="Cartas del rival"></div>
      <div class="mazo-chico" aria-label="Cartas en el mazo"><div class="pila-dorsos"></div><b>30</b><small>mazo</small></div>
    </div>
    <div class="pano">
      <div class="sol-fondo">${SOL}</div>
      <div class="tiza" aria-live="polite"></div>
      <div class="mesa-cartas" role="group" aria-label="Cartas de la mesa"></div>
      <div class="tiza-acc" hidden><button type="button" class="boton chico tirar">Tirarla sin levantar</button></div>
      <div class="grito" aria-live="assertive"></div>
      <div class="aviso" aria-live="polite"></div>
    </div>
    <div class="fila-mia">
      <div class="mi-mano" role="group" aria-label="Tus cartas"></div>
    </div>
    <header class="franja abajo">
      <div class="cara-slot mia-cara"><span class="burbuja mia-burbuja"></span></div>
      <div class="quien"><span class="n-yo"></span><small class="ayuda"></small></div>
      <div class="monton mio-monton" aria-label="Lo que levantaste"><div class="cruces"></div><div class="pila-dorsos"></div><b>0</b></div>
      <div class="puntos mios-puntos" aria-label="Tus puntos"><b>0</b><small>de 15</small></div>
    </header>
    <div class="corte" hidden>Se cortó la conexión. Reintentando…</div>
    <div class="fin recuento" hidden></div>
    <div class="fin final" hidden></div>
    <div class="fin dejar" hidden role="dialog" aria-modal="true" aria-labelledby="dejar-tit"></div>
  </div>`);
  cont.append(mesa);
  const $ = (s) => mesa.querySelector(s);
  const pano = $(".pano"), tiza = $(".tiza"), tizaAcc = $(".tiza-acc"), mesaCartas = $(".mesa-cartas"), grito = $(".grito"), aviso = $(".aviso");
  const miMano = $(".mi-mano"), rivalMano = $(".rival-mano"), ayuda = $(".ayuda");
  const montones = [yo === 0 ? $(".mio-monton") : $(".rival-monton"), yo === 0 ? $(".rival-monton") : $(".mio-monton")];
  const puntosEl = [yo === 0 ? $(".mios-puntos") : $(".rival-puntos"), yo === 0 ? $(".rival-puntos") : $(".mios-puntos")];
  const caraSlots = [yo === 0 ? $(".mia-cara") : $(".rival-cara"), yo === 0 ? $(".rival-cara") : $(".mia-cara")];
  const recuentoEl = $(".fin.recuento"), finEl = $(".fin.final"), dejar = $(".fin.dejar");
  const panoEstilo = jug[yo]?.estilo?.pano;
  if (panoEstilo) pano.dataset.pano = panoEstilo;
  const caraMia = el(cara(formas[yo], "tu cara")), caraRival = el(cara(formas[rv], "cara del rival"));
  $(".mia-cara").append(caraMia); $(".rival-cara").append(caraRival);
  const cesar = [parpadear(caraMia), parpadear(caraRival)];
  const caras = [yo === 0 ? caraMia : caraRival, yo === 0 ? caraRival : caraMia];
  const pintarNombres = () => { $(".n-rival").textContent = nombres[rv]; $(".n-yo").textContent = nombres[yo]; };
  pintarNombres();
  montones.forEach((m, j) => { m.querySelector(".pila-dorsos").innerHTML = `<div class="capa c2">${dorso(dorsoDe(j))}</div><div class="capa c1">${dorso(dorsoDe(j))}</div>`; });
  $(".mazo-chico .pila-dorsos").innerHTML = `<div class="capa c2">${dorso("clasico")}</div><div class="capa c1">${dorso("clasico")}</div>`;

  // ---------- pantalla completa y sonido ----------
  const btnPantalla = $(".pantalla-btn");
  const puedePantalla = !!document.documentElement.requestFullscreen && matchMedia("(pointer: fine)").matches;
  if (puedePantalla) {
    btnPantalla.hidden = false;
    btnPantalla.addEventListener("click", () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else pedirPantallaCompleta(); });
  }
  const pintarPantalla = () => { btnPantalla.textContent = document.fullscreenElement ? "🗗" : "⛶"; };
  const alCambiarPantalla = () => { pintarPantalla(); cancelarArrastre(); };
  document.addEventListener("fullscreenchange", alCambiarPantalla);
  pintarPantalla();
  const btnSonido = $(".sonido-btn");
  const pintarSonido = () => { btnSonido.textContent = sonido.mudo ? "🔇" : "🔊"; };
  pintarSonido();
  btnSonido.addEventListener("click", () => { sonido.setMudo(!sonido.mudo); pintarSonido(); });

  // ---------- lo que está dibujado y lo que estoy armando ----------
  let V = fuente.vista();
  let elegida = null;            // id de la carta de mi mano que estoy por tirar
  const sel = new Set();         // cartas de la mesa marcadas para levantar
  let enviando = false, ultimoAviso = 0;
  let yoQuiero = false, rivalQuiere = false, rivalNo = false, alFinLlamado = -1;
  const serie = [0, 0];
  let serieViva = false;

  const miTurno = () => V.fase === "jugando" && V.turno === yo && !enviando;
  function mostrarAviso(txt) {
    aviso.textContent = txt; aviso.classList.add("ver"); ultimoAviso = performance.now();
    clearTimeout(mostrarAviso._t); mostrarAviso._t = setTimeout(() => aviso.classList.remove("ver"), 2400);
  }
  function gritar(txt, clase = "") {
    grito.textContent = txt; grito.className = `grito ${clase}`; void grito.offsetWidth; grito.classList.add("pop");
  }

  // ---------- pintar ----------
  function cartaHTML(id, extra = "") { return `<div class="carta ${extra}" data-id="${id}">${frente(id)}</div>`; }
  function pintarMesa() {
    const n = V.mesa.length;
    mesaCartas.dataset.n = n > 9 ? "muchas" : n > 6 ? "varias" : "pocas";
    const ya = new Map([...mesaCartas.children].map((c) => [c.dataset.id, c]));
    // reusar los nodos que siguen para que no salten
    const nuevos = V.mesa.map((id) => {
      let b = ya.get(id);
      if (!b) {
        b = el(`<button type="button" class="carta-mesa" data-id="${id}" aria-label="${nombreCarta(id)}" style="--giro:${giro(id)}deg">${cartaHTML(id)}</button>`);
      }
      b.classList.toggle("marcada", sel.has(id));
      b.setAttribute("aria-pressed", sel.has(id));
      return b;
    });
    mesaCartas.replaceChildren(...nuevos);
    pano.classList.toggle("vacia", !n);
    acomodarAnillo();
  }
  /** Hasta 10 cartas van en anillo alrededor del sol (empieza arriba y gira como el reloj); con más, en filas. */
  function acomodarAnillo() {
    const cartas = [...mesaCartas.children], n = cartas.length;
    const anillo = n > 0 && n <= 10;
    mesaCartas.classList.toggle("anillo", anillo);
    if (!anillo) { cartas.forEach((b) => { b.style.left = b.style.top = ""; }); return; }
    const W = mesaCartas.clientWidth, H = mesaCartas.clientHeight;
    const cw = cartas[0].offsetWidth || 60, ch = cw * 860 / 600;
    const ry = Math.max(0, H / 2 - ch / 2 - 6);
    const anchoMax = Math.max(0, W / 2 - cw / 2 - 6);
    // pocas: óvalo cerca de redondo; muchas: se abre a lo ancho (en la compu el paño es bajo y ancho)
    const rx = Math.min(anchoMax, n <= 6 ? ry * 1.8 : n <= 7 ? ry * 3.2 : ry * 4.4);
    if (n === 1) { cartas[0].style.left = "50%"; cartas[0].style.top = "50%"; return; }
    // repartidas por largo de arco (no por ángulo): en un óvalo chato no se enciman en las puntas
    const pasos = 360, pts = [], largo = [0];
    for (let i = 0; i <= pasos; i++) { const a = (-90 + (360 * i) / pasos) * Math.PI / 180; pts.push([W / 2 + rx * Math.cos(a), H / 2 + ry * Math.sin(a)]); }
    for (let i = 1; i <= pasos; i++) largo.push(largo[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = largo[pasos];
    let i = 0;
    cartas.forEach((b, k) => {
      const meta = (total * k) / n;
      while (i < pasos && largo[i + 1] < meta) i++;
      b.style.left = `${pts[i][0]}px`;
      b.style.top = `${pts[i][1]}px`;
    });
  }
  const vigiaTam = new ResizeObserver(() => acomodarAnillo());
  vigiaTam.observe(mesaCartas);
  function pintarMano() {
    const ya = new Map([...miMano.children].map((c) => [c.dataset.id, c]));
    miMano.replaceChildren(...V.mano.map((id) => {
      const b = ya.get(id) || el(`<button type="button" class="carta-mano" data-id="${id}" aria-label="${nombreCarta(id)}">${cartaHTML(id)}</button>`);
      b.classList.toggle("elegida", elegida === id);
      return b;
    }));
    const nr = V.enMano[rv];
    rivalMano.innerHTML = Array.from({ length: nr }, () => `<div class="carta dorso-chico">${dorso(dorsoDe(rv))}</div>`).join("");
  }
  function pintarMontones() {
    montones.forEach((m, j) => {
      m.querySelector("b").textContent = V.levantadas[j];
      m.classList.toggle("vacio", !V.levantadas[j]);
      const esc = V.escobas[j];
      const cr = m.querySelector(".cruces");
      const muestra = esc.slice(-5);
      cr.innerHTML = muestra.map((id, k) => `<div class="cruz" style="--k:${k}">${frente(id)}</div>`).join("") + (esc.length ? `<i class="n-escobas" title="escobas">${esc.length} ${esc.length === 1 ? "escoba" : "escobas"}</i>` : "");
    });
    const mz = $(".mazo-chico");
    mz.querySelector("b").textContent = V.mazo;
    mz.classList.toggle("vacio", !V.mazo);
  }
  function pintarPuntos() {
    puntosEl.forEach((p, j) => { p.querySelector("b").textContent = V.puntos[j]; p.querySelector("small").textContent = `de ${V.meta}`; p.classList.toggle("cerca", V.puntos[j] >= V.meta - 3); });
  }
  function pintarTurno() {
    const t = V.fase === "jugando" ? V.turno : null;
    caraSlots.forEach((c, j) => c.classList.toggle("turno", t === j));
    mesa.classList.toggle("mi-turno", t === yo);
    $(".sub-rival").textContent = t === rv ? "piensa…" : V.reparte === rv ? "reparte" : "rival";
    if (V.fase !== "jugando") ayuda.textContent = V.fase === "recuento" ? "recuento de la mano" : "";
    else if (t === yo) ayuda.textContent = elegida ? "tocá lo que levantás" : "te toca: arrastrá una carta a la mesa";
    else ayuda.textContent = `le toca a ${nombres[rv]}`;
  }
  function pintarTiza() {
    if (!elegida && !sel.size) { tiza.classList.remove("ver", "justo", "pasa"); tizaAcc.hidden = true; return; }
    const partes = [...(elegida ? [elegida] : []), ...V.mesa.filter((c) => sel.has(c))];
    const total = suma(partes);
    const resto = total < 15 ? ` <small>· ${elegida && partes.length === 1 ? "buscá" : "te falta"} ${15 - total}</small>` : "";
    tiza.innerHTML = partes.length === 1 && elegida
      ? `${valor(elegida)}${resto}`
      : `${partes.map((c) => valor(c)).join(" + ")} = <b>${total}</b>${total === 15 && elegida ? " ✓" : ""}${resto}`;
    tiza.classList.add("ver");
    tiza.classList.toggle("justo", total === 15 && !!elegida);
    tiza.classList.toggle("pasa", total > 15);
    // se puede tirar sin levantar aunque haya jugada (no es obligatorio levantar)
    tizaAcc.hidden = !(elegida && miTurno() && combinaciones(V.mesa, elegida).length);
  }
  function pintar() {
    if (V.fase !== "jugando" || V.turno !== yo) { elegida = null; sel.clear(); }
    // lo marcado que ya no está en la mesa se olvida
    for (const c of [...sel]) if (!V.mesa.includes(c)) sel.delete(c);
    if (elegida && !V.mano.includes(elegida)) elegida = null;
    nombres = V.nombres?.length ? V.nombres : nombres;
    pintarNombres(); pintarMesa(); pintarMano(); pintarMontones(); pintarPuntos(); pintarTurno(); pintarTiza();
  }

  // ---------- jugar ----------
  async function jugar(carta, levanta) {
    if (!miTurno()) return;
    enviando = true;
    const desde = miMano.querySelector(`[data-id="${carta}"]`)?.getBoundingClientRect();
    ultimaMia = { carta, desde };
    let r = null;
    try { r = await fuente.enviar({ t: "jugar", carta, levanta }); } finally { enviando = false; }
    if (r) { mostrarAviso(r.mensaje); sonido.play("rechazo"); ultimaMia = null; pintar(); return; }
    elegida = null; sel.clear();
    pintar();
  }
  let ultimaMia = null;
  /** Con la carta `carta` y lo marcado: si suma 15 se juega; si no hay nada marcado decide según las combinaciones. */
  function intentar(carta, { sobre = null, enPano = false } = {}) {
    const marcadas = V.mesa.filter((c) => sel.has(c) || c === sobre);
    if (marcadas.length && suma(marcadas) + valor(carta) === 15) return jugar(carta, marcadas);
    const combos = combinaciones(V.mesa, carta);
    if (sobre) {
      const con = combos.filter((x) => x.includes(sobre) && [...sel].every((c) => x.includes(c)));
      if (con.length === 1) return jugar(carta, con[0]);
      if (con.length > 1) { elegida = carta; sel.clear(); sel.add(sobre); mostrarAviso("Hay más de una forma: tocá las que levantás"); pintar(); return; }
      if (!combos.length) return jugar(carta, []);
      temblar(); mostrarAviso(`Con ${nombreCarta(sobre)} no llega a 15`); return;
    }
    if (enPano) {
      if (sel.size) { temblar(); mostrarAviso(`Eso suma ${suma(marcadas) + valor(carta)}, no 15`); elegida = carta; pintar(); return; }
      if (!combos.length) return jugar(carta, []);
      if (combos.length === 1) return jugar(carta, combos[0]);
      elegida = carta; mostrarAviso("Hay más de una forma: tocá las que levantás"); pintar(); return;
    }
  }
  function temblar() { sonido.play("rechazo"); vibrar(30); pano.classList.remove("no"); void pano.offsetWidth; pano.classList.add("no"); }

  // tocar una carta de la mesa: la marca o desmarca; si ya hay carta elegida y llega a 15, se juega
  mesaCartas.addEventListener("click", (e) => {
    const b = e.target.closest(".carta-mesa");
    if (!b || !miTurno() || arrastre?.movio) return;
    const id = b.dataset.id;
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    sonido.play("carta");
    if (elegida && suma(V.mesa.filter((c) => sel.has(c))) + valor(elegida) === 15) { jugar(elegida, V.mesa.filter((c) => sel.has(c))); return; }
    pintar();
  });
  // tocar el paño vacío con una carta elegida = soltarla ahí
  pano.addEventListener("click", (e) => {
    if (e.target.closest(".carta-mesa, .tiza-acc") || !elegida || !miTurno()) return;
    intentar(elegida, { enPano: true });
  });
  tizaAcc.querySelector(".tirar").addEventListener("click", () => { if (elegida && miTurno()) jugar(elegida, []); });

  // ---------- arrastre de mi carta ----------
  let arrastre = null;
  miMano.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".carta-mano");
    if (!b || !miTurno() || e.button > 0) return;
    e.preventDefault();
    const r = b.getBoundingClientRect();
    arrastre = { id: b.dataset.id, nodo: b, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, movio: false, fantasma: null, encima: null };
    b.setPointerCapture?.(e.pointerId);
  });
  addEventListener("pointermove", moverArrastre);
  addEventListener("pointerup", soltarArrastre);
  addEventListener("pointercancel", cancelarArrastre);
  function moverArrastre(e) {
    const a = arrastre;
    if (!a) return;
    if (!a.movio && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 8) return;
    if (!a.movio) {
      a.movio = true;
      elegida = a.id; pintarMano(); pintarTiza(); pintarTurno();
      a.fantasma = el(`<div class="carta arrastre">${frente(a.id)}</div>`);
      a.fantasma.style.width = a.w + "px";
      mesa.append(a.fantasma);
      a.nodo.classList.add("levantada");
      sonido.play("carta");
    }
    const mr = mesa.getBoundingClientRect();
    a.fantasma.style.transform = `translate(${e.clientX - mr.left - a.dx}px, ${e.clientY - mr.top - a.dy}px) rotate(-4deg)`;
    const debajo = document.elementFromPoint(e.clientX, e.clientY);
    const sobre = debajo?.closest?.(".carta-mesa")?.dataset.id || null;
    const enPano = !!debajo?.closest?.(".pano");
    a.encima = { sobre, enPano };
    mesaCartas.querySelectorAll(".carta-mesa").forEach((c) => c.classList.toggle("encima", c.dataset.id === sobre));
    pano.classList.toggle("encima", enPano && !sobre);
    // la tiza cuenta también la carta que tengo debajo
    if (sobre && !sel.has(sobre)) { sel.add(sobre); pintarTiza(); sel.delete(sobre); } else pintarTiza();
  }
  function limpiarArrastre() {
    const a = arrastre;
    arrastre = null;
    if (!a) return null;
    a.fantasma?.remove();
    a.nodo.classList.remove("levantada");
    mesaCartas.querySelectorAll(".encima").forEach((c) => c.classList.remove("encima"));
    pano.classList.remove("encima");
    return a;
  }
  function soltarArrastre() {
    const a = arrastre;
    if (!a) return;
    if (!a.movio) {
      // fue un toque: elegir o soltar la carta; si con lo marcado llega a 15, se juega
      limpiarArrastre();
      if (elegida === a.id) { elegida = null; pintar(); return; }
      elegida = a.id;
      sonido.play("carta");
      const marcadas = V.mesa.filter((c) => sel.has(c));
      if (marcadas.length && suma(marcadas) + valor(a.id) === 15) { jugar(a.id, marcadas); return; }
      pintar();
      return;
    }
    const rect = a.fantasma.getBoundingClientRect();
    limpiarArrastre();
    if (!a.encima || (!a.encima.sobre && !a.encima.enPano)) { elegida = null; pintar(); return; }
    ultimaRect = rect;
    intentar(a.id, a.encima);
  }
  let ultimaRect = null;
  function cancelarArrastre() { if (limpiarArrastre()) { elegida = null; pintar(); } }

  // ---------- vuelos ----------
  function volar(id, desde, hasta, { boca = true, ms = 380, girar = 0, despues } = {}) {
    if (!desde || !hasta || QUIETO) { despues?.(); return; }
    const mr = mesa.getBoundingClientRect();
    const n = el(`<div class="carta vuelo">${boca ? frente(id) : dorso("clasico")}</div>`);
    n.style.width = desde.width + "px";
    n.style.transform = `translate(${desde.left - mr.left}px, ${desde.top - mr.top}px)`;
    mesa.append(n);
    const k = hasta.width / desde.width;
    n.animate([
      { transform: `translate(${desde.left - mr.left}px, ${desde.top - mr.top}px)` },
      { transform: `translate(${hasta.left - mr.left}px, ${hasta.top - mr.top}px) scale(${k}) rotate(${girar}deg)` },
    ], { duration: dur(ms), easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }).finished.then(() => { n.remove(); despues?.(); }, () => { n.remove(); despues?.(); });
  }
  const rectDe = (nodo) => nodo?.getBoundingClientRect() || null;

  // ---------- eventos del motor ----------
  function eventos(v, ev) {
    const antesMesa = new Map([...mesaCartas.querySelectorAll(".carta-mesa")].map((b) => [b.dataset.id, b.getBoundingClientRect()]));
    const rivalManoRect = rivalMano.lastElementChild?.getBoundingClientRect() || rectDe(rivalMano);
    const mazoRect = rectDe($(".mazo-chico .pila-dorsos"));
    V = v;
    pintar();
    let esperar = 0;
    for (const e of ev) {
      if (e.t === "jugada") {
        const mia = e.jugador === yo;
        const desde = mia ? (ultimaRect || ultimaMia?.desde) : rivalManoRect;
        ultimaRect = null; ultimaMia = null;
        sonido.play("poner");
        if (!e.levanta.length) {
          const nodo = mesaCartas.querySelector(`[data-id="${e.carta}"]`);
          if (nodo) { nodo.style.opacity = "0"; volar(e.carta, desde, nodo.getBoundingClientRect(), { despues: () => { nodo.style.opacity = ""; } }); }
        } else {
          const hacia = rectDe(montones[e.jugador].querySelector(".pila-dorsos"));
          volar(e.carta, desde, hacia, { ms: 460 });
          e.levanta.forEach((c, k) => setTimeout(() => volar(c, antesMesa.get(c), hacia, { ms: 420 }), 60 + k * 50));
          setTimeout(() => sonido.play("llevar"), 200);
          if (e.levanta.concat(e.carta).includes("7-oro")) {
            if (mia) { sonido.voz("siete_oro", "coincidencia"); gritar("¡El siete de oro!", "chico"); }
            else gritar("El siete de oro…", "rival chico");
          }
        }
        if (e.escoba) {
          setTimeout(() => {
            gritar("¡Escoba!", mia ? "" : "rival");
            if (mia) { sonido.voz("escoba", "chin"); vibrar([20, 40, 60]); } else sonido.play("chin");
            reaccionar(caras[e.jugador], "risa", 1400); reaccionar(caras[1 - e.jugador], "bronca", 1400);
          }, 380);
        }
      } else if (e.t === "repartir" || e.t === "reparto") {
        sonido.play("carta");
        const cartas = [...miMano.querySelectorAll(".carta-mano")];
        cartas.forEach((b, k) => { b.style.opacity = "0"; setTimeout(() => volar(b.dataset.id, mazoRect, b.getBoundingClientRect(), { boca: false, ms: 300, despues: () => { b.style.opacity = ""; } }), 120 + k * 110); });
        if (e.t === "reparto") {
          [...mesaCartas.querySelectorAll(".carta-mesa")].forEach((b, k) => { b.style.opacity = "0"; setTimeout(() => volar(b.dataset.id, mazoRect, b.getBoundingClientRect(), { ms: 300, despues: () => { b.style.opacity = ""; } }), 500 + k * 110); });
          if (e.escobasMesa) {
            setTimeout(() => {
              const mio = e.reparte === yo;
              gritar(e.escobasMesa === 2 ? "¡Dos escobas!" : "¡Escoba de mesa!", mio ? "chico" : "rival chico");
              mostrarAviso(`La mesa sumaba ${e.escobasMesa * 15}: ${mio ? "te la llevás vos, que repartiste" : `se la lleva ${nombres[e.reparte]}, que repartió`}`);
              if (mio) sonido.voz("escoba", "chin"); else sonido.play("chin");
            }, 700);
          }
          if (e.mano > 1 || v.puntos[0] + v.puntos[1] > 0) mostrarAviso(`Mano ${e.mano} · reparte ${e.reparte === yo ? "vos" : nombres[e.reparte]}`);
          recuentoEl.hidden = true;
        }
      } else if (e.t === "barrida") {
        const hacia = rectDe(montones[e.jugador].querySelector(".pila-dorsos"));
        e.cartas.forEach((c, k) => setTimeout(() => volar(c, antesMesa.get(c), hacia, { ms: 420 }), 500 + k * 60));
        setTimeout(() => mostrarAviso(`Lo que quedó en la mesa: para ${e.jugador === yo ? "vos" : nombres[e.jugador]} (no es escoba)`), 500);
        esperar = 1200;
      } else if (e.t === "recuento") {
        setTimeout(() => mostrarRecuento(), esperar + 900);
      } else if (e.t === "listo") {
        if (!recuentoEl.hidden) pintarRecuentoBoton();
      } else if (e.t === "fin") {
        setTimeout(() => mostrarFin(), esperar + 1100);
      } else if (e.t === "revancha") {
        yoQuiero = rivalQuiere = rivalNo = false;
        finEl.hidden = true; recuentoEl.hidden = true;
      } else if (e.t === "quiere_revancha") {
        if (e.jugador !== yo) rivalQuiere = true;
        pintarRevancha();
      } else if (e.t === "no_revancha") {
        if (e.jugador !== yo) { rivalNo = true; rivalQuiere = false; yoQuiero = false; }
        pintarRevancha();
      }
    }
  }

  // ---------- recuento de la mano ----------
  // la setenta: sietes; si empatan en sietes, se muestran los seises que la desempatan
  const sietes = (r, j) => `${r.sietes[j]} ${r.sietes[j] === 1 ? "siete" : "sietes"}${r.sietes[0] === r.sietes[1] ? ` · ${r.seises[j]} ${r.seises[j] === 1 ? "seis" : "seises"}` : ""}`;
  const marca = (g, j) => (g === j ? `<i class="gana">●</i>` : "");
  function mostrarRecuento() {
    const r = V.recuento;
    if (!r || V.fase !== "recuento") return;
    const fila = (n, a, b, g) => `<tr><th scope="row">${n}</th><td>${a}${marca(g, yo)}</td><td>${b}${marca(g, rv)}</td></tr>`;
    recuentoEl.innerHTML = `
      <div class="fin-caja pizarra">
        <p class="fin-titulo chico">Mano ${r.mano}</p>
        <table class="fin-tabla">
          <thead><tr><th></th><th scope="col">vos</th><th scope="col">${esc(nombres[rv])}</th></tr></thead>
          <tbody>
            ${fila("escobas", r.escobas[yo], r.escobas[rv], null)}
            ${fila("cartas", r.cartas[yo], r.cartas[rv], r.gana.cartas)}
            ${fila("oros", r.oros[yo], r.oros[rv], r.gana.oros)}
            ${fila("siete de oro", r.gana.siete === yo ? "✓" : "—", r.gana.siete === rv ? "✓" : "—", r.gana.siete)}
            ${fila("setenta", sietes(r, yo), sietes(r, rv), r.gana.setenta)}
            <tr class="suma"><th scope="row">esta mano</th><td>+${r.total[yo]}</td><td>+${r.total[rv]}</td></tr>
            <tr class="van"><th scope="row">van</th><td>${r.despues[yo]}</td><td>${r.despues[rv]}</td></tr>
          </tbody>
        </table>
        <p class="fin-sub">${r.gana.setenta === null ? "La setenta quedó empatada en sietes y en seises: no la cobra nadie. " : ""}Se juega a ${V.meta}.</p>
        <div class="fin-botones"><button class="boton primario seguir">Seguir</button></div>
      </div>`;
    recuentoEl.hidden = false;
    pintarRecuentoBoton();
    recuentoEl.querySelector(".seguir").addEventListener("click", async () => {
      const r2 = await fuente.enviar({ t: "seguir" });
      if (r2 && r2.motivo !== "ya_listo") mostrarAviso(r2.mensaje);
      pintarRecuentoBoton();
    });
    recuentoEl.querySelector(".seguir").focus();
  }
  function pintarRecuentoBoton() {
    const b = recuentoEl.querySelector(".seguir");
    if (!b) return;
    const listo = V.listos?.[yo];
    b.disabled = !!listo;
    const seg = V.recuentoHasta ? Math.max(0, Math.ceil((V.recuentoHasta - fuente.ahora()) / 1000)) : 0;
    b.textContent = listo ? `Esperando a ${nombres[rv]}…` : `Seguir${seg ? ` (${seg})` : ""}`;
  }
  const timerRecuento = setInterval(() => { if (!recuentoEl.hidden) pintarRecuentoBoton(); }, 1000);

  // ---------- final ----------
  function mostrarFin() {
    if (V.fase !== "fin" || V.ganador === null) return;
    recuentoEl.hidden = true;
    const gane = V.ganador === yo;
    if (alFinLlamado !== V.seq) {
      alFinLlamado = V.seq;
      serie[V.ganador]++;
      if (serie[0] + serie[1] > 1) serieViva = true;
      try { alFin?.(V); } catch (err) { console.error(err); }
    }
    if (gane) sonido.voz("ganamos", "gane"); else sonido.play("perdi");
    reaccionar(caras[V.ganador], "risa", 2500); reaccionar(caras[1 - V.ganador], "bronca", 2500);
    const r = V.recuento;
    const manos = V.historial.map((h) => `<tr><th scope="row">mano ${h.mano}</th><td>+${h.total[yo]}</td><td>+${h.total[rv]}</td></tr>`).join("");
    finEl.innerHTML = `
      <div class="fin-caja pizarra">
        <p class="fin-titulo ${gane ? "gane" : "perdi"}">${gane ? "¡Ganaste!" : "Perdiste"}</p>
        <p class="fin-sub"><b>${V.puntos[yo]}</b> a <b>${V.puntos[rv]}</b> en ${V.historial.length} ${V.historial.length === 1 ? "mano" : "manos"}${r ? ` · última mano: ${r.escobas[yo]} ${r.escobas[yo] === 1 ? "escoba" : "escobas"} tuyas` : ""}</p>
        <table class="fin-tabla">
          <thead><tr><th></th><th scope="col">vos</th><th scope="col">${esc(nombres[rv])}</th></tr></thead>
          <tbody>${manos}<tr class="van"><th scope="row">total</th><td>${V.puntos[yo]}</td><td>${V.puntos[rv]}</td></tr></tbody>
        </table>
        ${serieViva ? `<p class="fin-serie">Serie: <b>${serie[yo]}</b> a <b>${serie[rv]}</b></p>` : ""}
        <div class="fin-pedido" hidden></div>
        <div class="fin-botones">
          <button class="boton primario revancha" data-a="revancha">Revancha</button>
          ${otraDificultad ? `<button class="boton" data-a="dificultad">Cambiar de rival</button>` : ""}
          <button class="boton suave" data-a="salir">Salir</button>
        </div>
      </div>`;
    finEl.hidden = false;
    pintarRevancha();
    finEl.querySelector('[data-a="revancha"]').focus();
  }
  function pintarRevancha() {
    const b = finEl.querySelector(".revancha");
    if (!b) return;
    const pedido = finEl.querySelector(".fin-pedido");
    if (rivalQuiere && !yoQuiero) {
      pedido.hidden = false;
      pedido.innerHTML = `<p><b>${esc(nombres[rv])}</b> te pide la revancha</p>
        <div class="fin-pedido-botones"><button class="boton primario" data-a="aceptar">Aceptar</button><button class="boton" data-a="declinar">Declinar</button></div>`;
      b.hidden = true;
      return;
    }
    b.hidden = false;
    pedido.hidden = !(yoQuiero || rivalNo);
    pedido.innerHTML = yoQuiero ? `<p>Le pediste la revancha a <b>${esc(nombres[rv])}</b>. Esperando que acepte…</p>`
      : rivalNo ? `<p><b>${esc(nombres[rv])}</b> no quiere la revancha.</p>` : "";
    b.disabled = yoQuiero;
    b.textContent = yoQuiero ? "Esperando…" : rivalNo ? "Pedirla otra vez" : fuente.esLocal ? "Revancha" : "Pedir revancha";
  }
  finEl.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "revancha" || a === "aceptar") { if (!yoQuiero) { yoQuiero = true; rivalNo = false; pintarRevancha(); fuente.revancha(); } }
    else if (a === "declinar") { rivalQuiere = false; fuente.declinar?.(); pintarRevancha(); }
    else if (a === "dificultad") otraDificultad?.();
    else if (a === "salir") irme();
  });

  // ---------- salir ----------
  let rivalSeFue = false;
  function irme() {
    if (!fuente.esLocal && !rivalSeFue) { fuente.declinar?.(); fuente.irse?.(); setTimeout(() => salir?.(), 200); } else salir?.();
  }
  function cerrarDejar() { dejar.hidden = true; dejar.innerHTML = ""; }
  function preguntarDejar() {
    if (!finEl.hidden || rivalSeFue) { irme(); return; }
    cancelarArrastre();
    dejar.innerHTML = `
      <div class="fin-caja">
        <p class="fin-titulo chico" id="dejar-tit">¿Te vas?</p>
        <p class="fin-sub">${fuente.esLocal ? "La partida queda sin terminar." : `La partida queda sin terminar y <b>${esc(nombres[rv])}</b> se entera de que te fuiste.`}</p>
        <div class="fin-botones"><button class="boton primario" data-d="seguir">Seguir jugando</button><button class="boton suave" data-d="irme">Salir de la partida</button></div>
      </div>`;
    dejar.hidden = false;
    dejar.querySelector('[data-d="seguir"]').focus();
  }
  function seFueElRival() {
    cerrarDejar();
    dejar.innerHTML = `<div class="fin-caja"><p class="fin-titulo chico" id="dejar-tit">Se fue</p><p class="fin-sub"><b>${esc(nombres[rv])}</b> dejó la mesa.</p>
      <div class="fin-botones"><button class="boton primario" data-d="irme">Volver al inicio</button></div></div>`;
    dejar.hidden = false;
  }
  $(".salir-btn").addEventListener("click", preguntarDejar);
  dejar.addEventListener("click", (e) => {
    const d = e.target.closest("[data-d]")?.dataset.d;
    if (d === "seguir") cerrarDejar(); else if (d === "irme") irme();
  });

  // ---------- reacciones y lo que dice el bot ----------
  const bandeja = $(".emotes-bandeja"), btnE = $(".emote-btn");
  bandeja.innerHTML = EMOTES.map((e) => `<button type="button" data-emote="${e.k}">${e.txt}</button>`).join("")
    + `<label class="emotes-mudo"><input type="checkbox" ${emotesMudo() ? "checked" : ""}> no ver las del rival</label>`;
  btnE.addEventListener("click", (e) => { e.stopPropagation(); bandeja.hidden = !bandeja.hidden; });
  bandeja.addEventListener("click", (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-emote]");
    if (!b) return;
    bandeja.hidden = true;
    fuente.emote(b.dataset.emote);
    burbuja(yo, b.dataset.emote);
  });
  bandeja.addEventListener("change", (e) => { if (e.target.matches("input")) ponerMudo(e.target.checked); });
  const cerrarBandeja = (e) => { if (!bandeja.hidden && !e.target.closest(".emotes-bandeja, .emote-btn")) bandeja.hidden = true; };
  document.addEventListener("pointerdown", cerrarBandeja, true);
  function globo(j, txt, dicho = false) {
    const b = $(j === yo ? ".mia-burbuja" : ".rival-burbuja");
    b.textContent = txt;
    b.classList.toggle("dicho", dicho);
    b.classList.remove("ver"); void b.offsetWidth; b.classList.add("ver");
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("ver"), dicho ? 2800 : 2200);
  }
  function burbuja(j, k) {
    globo(j, textoDe(k));
    if (k === "risa" || k === "bien" || k === "rapido") reaccionar(caras[j], "risa", 900);
    else if (k === "uy" || k === "dale") reaccionar(caras[j], "sorpresa", 900);
  }
  const bajaE = fuente.suscribirEmote((k, j) => { if (j !== yo && !emotesMudo()) burbuja(j, k); });
  const bajaD = fuente.suscribirDicho ? fuente.suscribirDicho((txt, j) => globo(j, txt, true)) : () => {};

  // ---------- conexión ----------
  const corte = $(".corte");
  const bajaC = fuente.suscribirConexion((estado) => {
    if (rivalSeFue) return;
    if (estado === "se_fue") { rivalSeFue = true; corte.hidden = true; seFueElRival(); return; }
    corte.hidden = estado === "conectado";
  });
  const punto = $(".red-punto");
  function pintarRed() {
    const ms = Math.round((fuente.latencia() || 0) * 2), lenta = ms >= 150;
    punto.hidden = false;
    punto.dataset.q = lenta ? "lenta" : "buena";
    punto.title = `Conexión ${lenta ? "lenta" : "buena"} · ${ms} ms`;
    punto.setAttribute("aria-label", punto.title);
  }
  if (!fuente.esLocal) { pintarRed(); punto.addEventListener("click", () => { pintarRed(); mostrarAviso(punto.title); }); }
  const timerPing = fuente.esLocal ? 0 : setInterval(pintarRed, 1000);

  const baja = fuente.suscribir((v, ev) => eventos(v, ev));
  pintar();
  // el primer reparto se ve volar
  requestAnimationFrame(() => eventos(fuente.vista(), (fuente.inicial || []).filter((e) => e.t === "reparto")));

  return () => {
    document.removeEventListener("fullscreenchange", alCambiarPantalla);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    removeEventListener("pointermove", moverArrastre); removeEventListener("pointerup", soltarArrastre); removeEventListener("pointercancel", cancelarArrastre);
    document.removeEventListener("pointerdown", cerrarBandeja, true);
    baja(); bajaE(); bajaC(); bajaD(); clearInterval(timerPing); clearInterval(timerRecuento);
    vigiaTam.disconnect();
    cesar.forEach((f) => f && f());
    ROTULO.texto = rotuloAntes;
    cont.innerHTML = "";
  };
}
