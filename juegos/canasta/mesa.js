// Mesa de la CANASTA, «pulpería de noche» con el paño «El sol». Arriba los juegos del rival, en el medio el mazo y el
// pozo, abajo tus juegos y tu mano (ordenada; en dos filas si no entra). Se juega tocando: marcás cartas de la mano y
// tocás el pozo (levantarlo o tirar), uno de tus juegos (agregar) o los botones Bajar / Tirar. También se arrastra:
// una carta (con lo marcado) al pozo, a un juego o a tu zona de juegos.
import { dorso, ROTULO } from "../../nucleo/cartas.js";
import { frente, nombreCarta } from "../../nucleo/cartas-francesas.js";
import { cara, reaccionar, parpadear } from "../../nucleo/caras.js";
import { sonido } from "../../nucleo/sonido.js";
import { LISTA as EMOTES, textoDe, mudo as emotesMudo, ponerMudo } from "../../nucleo/emotes.js";
import { rango, esLibre, esNegro3, sumar, CANASTA } from "./motor.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (QUIETO ? Math.min(ms, 60) : ms);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vibrar = (p) => { try { navigator.vibrate?.(p); } catch { /* ok */ } };
const NOMBRE_R = { 1: "A", 11: "J", 12: "Q", 13: "K" };
export const rotuloRango = (r) => NOMBRE_R[r] || String(r);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// orden de la mano: del 4 a la K, el as, los 3 negros, los 2 y los comodines al final
const PESO = (id) => { const r = rango(id); return r === 0 ? 100 : r === 2 ? 90 : r === 3 ? 80 : r === 1 ? 14 : r; };
const PALO_ORDEN = { pica: 0, corazon: 1, trebol: 2, diamante: 3 };
export const ordenarMano = (ids) => [...ids].sort((a, b) => PESO(a) - PESO(b) || (PALO_ORDEN[a.split("-")[1]] ?? 9) - (PALO_ORDEN[b.split("-")[1]] ?? 9) || (a < b ? -1 : 1));

/**
 * Lo que querés bajar con estas cartas: juegos nuevos y agregados a los tuyos. Las libres van donde hacen falta.
 * Devuelve { nuevos: [[ids]], agregar: [{ rango, cartas }] } o { error }.
 */
export function planBajada(cartas, misJuegos) {
  const grupos = new Map();
  for (const c of cartas) if (!esLibre(c)) { const r = rango(c); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(c); }
  const libres = cartas.filter(esLibre).sort((a, b) => (rango(b) === 2) - (rango(a) === 2));
  if (!grupos.size) return { error: libres.length ? "Las libres solas no forman juego: marcá también las naturales." : "Marcá las cartas que querés bajar." };
  const destinos = [...grupos].map(([r, nat]) => {
    const ya = misJuegos.find((g) => g.rango === r);
    return { r, nat: [...nat], lib: [], ya, natYa: ya ? ya.cartas.filter((c) => !esLibre(c)).length : 0, libYa: ya ? ya.cartas.filter(esLibre).length : 0 };
  });
  for (const l of libres) {
    const largo = (d) => d.nat.length + d.lib.length + (d.ya ? d.ya.cartas.length : 0);
    const caben = destinos.filter((d) => d.r !== 3 && d.natYa + d.nat.length > d.libYa + d.lib.length + 1 && d.libYa + d.lib.length < 3);
    if (!caben.length) return { error: "No hay dónde poner esa libre: un juego necesita más naturales que libres, y hasta 3." };
    // primero los juegos nuevos que no llegan a 3; después el más cerca de ser canasta
    caben.sort((a, b) => (!a.ya && largo(a) < 3 ? -1 : 0) - (!b.ya && largo(b) < 3 ? -1 : 0) || largo(b) - largo(a));
    caben[0].lib.push(l);
  }
  const nuevos = [], agregar = [];
  for (const d of destinos) {
    const cs = [...d.nat, ...d.lib];
    if (d.ya) agregar.push({ rango: d.r, cartas: cs });
    else if (cs.length < 3) return { error: `Para bajar ${rotuloRango(d.r)} hacen falta tres cartas (o dos y una libre).` };
    else nuevos.push(cs);
  }
  return { nuevos, agregar };
}

/** Cómo levantar el pozo con lo marcado (o, si no marcaste, con lo que tengas). Devuelve una acción o { error }. */
export function accionPozo(V, marcadas) {
  const p = V.pozo;
  if (!p.n) return { error: "El pozo está vacío." };
  if (p.tapado) return { error: esNegro3(p.tope) ? "Hay un 3 negro arriba: el pozo está tapado este turno." : "Hay una libre arriba: el pozo no se puede levantar." };
  const r = rango(p.tope), frio = p.congelado, mios = V.juegos[V.yo], yo = V.yo;
  const natSel = marcadas.filter((c) => !esLibre(c) && rango(c) === r), libSel = marcadas.filter(esLibre);
  let con = null;
  if (natSel.length >= 2) con = natSel.slice(0, 2);
  else if (natSel.length === 1 && libSel.length && !frio) con = [natSel[0], libSel[0]];
  else if (!frio && mios.some((g) => g.rango === r) && !natSel.length) return { t: "pozo", a: r };
  else {
    const nat = V.mano.filter((c) => !esLibre(c) && rango(c) === r);
    const lib = V.mano.filter(esLibre).sort((a, b) => (rango(b) === 2) - (rango(a) === 2));
    if (nat.length >= 2) con = nat.slice(0, 2);
    else if (!frio && nat.length === 1 && lib.length) con = [nat[0], lib[0]];
    else return { error: frio ? `El pozo está congelado: necesitás dos ${rotuloRango(r)} naturales en la mano.` : `Para levantar el pozo necesitás dos ${rotuloRango(r)} (o uno y una libre).` };
  }
  if (V.bajo[yo]) return { t: "pozo", con };
  const resto = marcadas.filter((c) => !con.includes(c));
  if (!resto.length) return { t: "pozo", con };
  const pl = planBajada(resto, []);
  if (pl.error) return pl;
  return { t: "pozo", con, juegos: pl.nuevos };
}

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
  ROTULO.texto = "canasta";
  const jug = fuente.jugadores();
  let nombres = fuente.vista().nombres;
  const formas = jug.map((j, i) => (Number.isInteger(j.estilo?.cara) ? j.estilo.cara : [2, 4][i]));
  const dorsoDe = (j) => jug[j]?.estilo?.dorso || "clasico";

  cont.innerHTML = "";
  const mesa = el(`
  <div class="mesa canasta">
    <header class="franja arriba">
      <button type="button" class="icono salir-btn" aria-label="Salir de la partida" title="Salir de la partida">←</button>
      <div class="cara-slot rival-cara"><span class="burbuja rival-burbuja"></span></div>
      <div class="quien"><span class="n-rival"></span><button type="button" class="red-punto" hidden aria-label="Conexión"></button><small class="sub-rival"></small></div>
      <div class="puntos rival-puntos" aria-label="Puntos del rival"><b>0</b><small>de 5000</small></div>
      <button class="icono emote-btn" aria-label="Reacciones">💬</button>
      <button class="icono pantalla-btn" aria-label="Pantalla completa" title="Pantalla completa" hidden>⛶</button>
      <button class="icono sonido-btn" aria-label="Sonido"></button>
      <div class="emotes-bandeja" hidden></div>
    </header>
    <div class="pano">
      <section class="zona rival-zona" aria-label="Juegos del rival">
        <div class="zona-info"><span class="rival-mano-n"></span><span class="rojos rival-rojos"></span></div>
        <div class="juegos rival-juegos"></div>
      </section>
      <div class="centro">
        <button type="button" class="mazo-c" aria-label="Robar del mazo"><span class="pila-dorsos"></span><b>0</b><small>mazo</small></button>
        <button type="button" class="pozo-c" aria-label="Pozo"><span class="debajo"></span><span class="tope"></span><b class="pozo-n"></b><small class="pozo-est">pozo</small></button>
        <div class="tiza" aria-live="polite"></div>
      </div>
      <section class="zona mia-zona" aria-label="Tus juegos">
        <div class="juegos mis-juegos"></div>
        <div class="zona-info"><span class="rojos mis-rojos"></span><span class="mis-canastas"></span></div>
      </section>
      <div class="grito" aria-live="assertive"></div>
      <div class="aviso" aria-live="polite"></div>
    </div>
    <div class="barra">
      <span class="ayuda"></span>
      <button type="button" class="boton chico bajar" hidden>Bajar</button>
      <button type="button" class="boton chico primario tirar" hidden>Tirar</button>
    </div>
    <div class="mi-mano" role="group" aria-label="Tus cartas"></div>
    <header class="franja abajo">
      <div class="cara-slot mia-cara"><span class="burbuja mia-burbuja"></span></div>
      <div class="quien"><span class="n-yo"></span><small class="sub-yo"></small></div>
      <div class="puntos mios-puntos" aria-label="Tus puntos"><b>0</b><small>de 5000</small></div>
    </header>
    <div class="corte" hidden>Se cortó la conexión. Reintentando…</div>
    <div class="fin recuento" hidden></div>
    <div class="fin final" hidden></div>
    <div class="fin dejar" hidden role="dialog" aria-modal="true" aria-labelledby="dejar-tit"></div>
  </div>`);
  cont.append(mesa);
  const $ = (s) => mesa.querySelector(s);
  const pano = $(".pano"), grito = $(".grito"), aviso = $(".aviso"), tiza = $(".tiza");
  const miMano = $(".mi-mano"), ayuda = $(".ayuda"), btnBajar = $(".bajar"), btnTirar = $(".tirar");
  const mazoEl = $(".mazo-c"), pozoEl = $(".pozo-c");
  const juegosEl = [yo === 0 ? $(".mis-juegos") : $(".rival-juegos"), yo === 0 ? $(".rival-juegos") : $(".mis-juegos")];
  const rojosEl = [yo === 0 ? $(".mis-rojos") : $(".rival-rojos"), yo === 0 ? $(".rival-rojos") : $(".mis-rojos")];
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
  mazoEl.querySelector(".pila-dorsos").innerHTML = `<span class="capa c3">${dorso("clasico")}</span><span class="capa c2">${dorso("clasico")}</span><span class="capa c1">${dorso("clasico")}</span>`;

  // ---------- pantalla completa y sonido ----------
  const btnPantalla = $(".pantalla-btn");
  if (document.documentElement.requestFullscreen && matchMedia("(pointer: fine)").matches) {
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

  // ---------- estado de la pantalla ----------
  let V = fuente.vista();
  const sel = new Set();            // cartas de mi mano marcadas
  let nuevas = new Set();           // las que acaban de entrar (brillan un rato)
  let enviando = false;
  let yoQuiero = false, rivalQuiere = false, rivalNo = false, alFinLlamado = -1;
  const serie = [0, 0];
  let serieViva = false;

  const enTurno = () => V.turno === yo && (V.fase === "robar" || V.fase === "jugar");
  const puedo = () => enTurno() && !enviando;
  const marcadas = () => V.mano.filter((c) => sel.has(c));
  function mostrarAviso(txt, ms = 2600) {
    aviso.textContent = txt; aviso.classList.add("ver");
    clearTimeout(mostrarAviso._t); mostrarAviso._t = setTimeout(() => aviso.classList.remove("ver"), ms);
  }
  function gritar(txt, clase = "") { grito.textContent = txt; grito.className = `grito ${clase}`; void grito.offsetWidth; grito.classList.add("pop"); }
  function temblar(nodo = pano) { sonido.play("rechazo"); vibrar(30); nodo.classList.remove("no"); void nodo.offsetWidth; nodo.classList.add("no"); }

  // ---------- pintar ----------
  const cartaHTML = (id, extra = "") => `<span class="carta ${extra}" data-id="${id}">${frente(id)}</span>`;
  function pintarJuegos() {
    for (const j of [0, 1]) {
      const cont = juegosEl[j], js = [...V.juegos[j]].sort((a, b) => (b.cartas.length >= CANASTA) - (a.cartas.length >= CANASTA) || PESO(a.cartas.find((c) => !esLibre(c)) || "comodin-1") - PESO(b.cartas.find((c) => !esLibre(c)) || "comodin-1"));
      cont.dataset.n = js.length;
      cont.innerHTML = js.map((g) => {
        const can = g.cartas.length >= CANASTA, pura = can && !g.cartas.some(esLibre);
        // las canastas se cierran: se ven tres cartas apretadas y el rótulo
        const muestra = can ? [...g.cartas.filter((c) => !esLibre(c)).slice(0, 2), g.cartas.find(esLibre) || g.cartas.at(-1)].slice(0, 3) : g.cartas;
        const ordenadas = can ? muestra : [...g.cartas.filter((c) => !esLibre(c)), ...g.cartas.filter(esLibre)];
        return `<button type="button" class="juego${can ? ` canasta ${pura ? "pura" : "impura"}` : ""}" data-r="${g.rango}" aria-label="${esc(`${can ? (pura ? "Canasta pura" : "Canasta impura") : "Juego"} de ${rotuloRango(g.rango)}, ${g.cartas.length} cartas`)}" style="--n:${ordenadas.length}">
          ${ordenadas.map((c, k) => `<span class="carta" data-id="${c}" style="--k:${k}">${frente(c)}</span>`).join("")}
          ${can ? `<i class="rotulo">${pura ? "pura" : "impura"}</i>` : g.cartas.length >= 4 ? `<i class="cuenta">${g.cartas.length}</i>` : ""}
        </button>`;
      }).join("") || `<p class="vacio">${j === yo ? (V.bajo[yo] ? "" : `primera bajada: ${V.minimos[yo]} puntos`) : "todavía no bajó"}</p>`;
      rojosEl[j].innerHTML = V.rojos[j].map((c) => `<span class="rojo" title="3 rojo">${frente(c)}</span>`).join("");
    }
    ajustarJuegos();
    const can = (j) => V.juegos[j].filter((g) => g.cartas.length >= CANASTA).length;
    $(".mis-canastas").textContent = can(yo) ? plural(can(yo), "canasta", "canastas") + (can(yo) >= 2 ? " · ya te podés ir" : "") : "";
    $(".rival-mano-n").textContent = `${plural(V.enMano[rv], "carta", "cartas")} en la mano${can(rv) ? ` · ${plural(can(rv), "canasta", "canastas")}` : ""}`;
  }
  /** El ancho de las cartas de cada zona: que entren todos los juegos en una fila y la columna más alta a lo alto. */
  function ajustarJuegos() {
    for (const cont of juegosEl) {
      const cols = [...cont.querySelectorAll(".juego")];
      if (!cols.length) { cont.style.removeProperty("--jw"); continue; }
      const W = cont.clientWidth - 6, H = cont.clientHeight - 10;
      const alto = Math.max(...cols.map((c) => (c.classList.contains("canasta") ? 1.433 + 2 * 0.12 + 0.1 : 1.433 + (Number(c.style.getPropertyValue("--n")) - 1) * 0.34)));
      const tope = Math.min(64, innerWidth * 0.13);
      const jw = Math.max(22, Math.min(tope, (W - (cols.length - 1) * 5) / cols.length, H > 40 ? H / alto : tope));
      cont.style.setProperty("--jw", `${jw.toFixed(1)}px`);
    }
  }
  const vigiaJuegos = new ResizeObserver(() => ajustarJuegos());
  juegosEl.forEach((c) => vigiaJuegos.observe(c));
  function pintarCentro() {
    mazoEl.querySelector("b").textContent = V.mazo;
    mazoEl.classList.toggle("vacio", !V.mazo);
    const p = V.pozo;
    pozoEl.querySelector(".tope").innerHTML = p.tope ? cartaHTML(p.tope) : "";
    pozoEl.querySelector(".debajo").innerHTML = p.congelado && p.libres.length ? `<span class="cruz">${frente(p.libres[0])}</span>` : p.n > 1 ? `<span class="capa">${dorso("clasico")}</span>` : "";
    pozoEl.querySelector(".pozo-n").textContent = p.n > 1 ? p.n : "";
    pozoEl.querySelector(".pozo-est").textContent = !p.n ? "pozo vacío" : p.congelado ? "congelado" : p.tapado ? "tapado" : "pozo";
    pozoEl.classList.toggle("congelado", p.congelado);
    pozoEl.classList.toggle("tapado", p.tapado && p.n > 0);
    pozoEl.setAttribute("aria-label", p.tope ? `Pozo: ${nombreCarta(p.tope)} arriba, ${p.n} cartas${p.congelado ? ", congelado" : ""}` : "Pozo vacío");
    const robar = puedo() && V.fase === "robar";
    mazoEl.classList.toggle("pide", robar && V.mazo > 0);
    pozoEl.classList.toggle("pide", robar && !p.tapado && p.n > 0);
    pozoEl.classList.toggle("tira", puedo() && V.fase === "jugar" && sel.size === 1);
  }
  /** La mano en una o dos filas, encimadas lo justo para que se lea el índice. */
  function acomodarMano() {
    const cartas = [...miMano.children], n = cartas.length;
    if (!n) return;
    const W = miMano.clientWidth, cw = cartas[0].offsetWidth || 56, ch = cw * 860 / 600;
    const minPaso = cw * 0.44, maxPaso = cw * 0.72;
    const porFila = Math.max(1, Math.floor((W - cw) / minPaso) + 1);
    const filas = n > porFila ? 2 : 1;
    const enFila = filas === 2 ? Math.ceil(n / 2) : n;
    const paso = enFila > 1 ? Math.min(maxPaso, (W - cw) / (enFila - 1)) : 0;
    const bajada = ch * 0.52;
    cartas.forEach((b, k) => {
      const f = filas === 2 && k >= enFila ? 1 : 0, i = f ? k - enFila : k;
      const enEsta = f ? n - enFila : enFila;
      const ancho = cw + paso * (enEsta - 1);
      b.style.left = `${(W - ancho) / 2 + i * paso}px`;
      b.style.top = `${f * bajada}px`;
      b.style.zIndex = String(k + 1);
    });
    miMano.style.height = `${ch + (filas - 1) * bajada + 16}px`;
  }
  const vigiaTam = new ResizeObserver(() => acomodarMano());
  vigiaTam.observe(miMano);
  function pintarMano() {
    const ya = new Map([...miMano.children].map((c) => [c.dataset.id, c]));
    miMano.replaceChildren(...ordenarMano(V.mano).map((id) => {
      const b = ya.get(id) || el(`<button type="button" class="carta-mano" data-id="${id}" aria-label="${nombreCarta(id)}">${cartaHTML(id)}</button>`);
      b.classList.toggle("marcada", sel.has(id));
      b.classList.toggle("nueva", nuevas.has(id));
      b.setAttribute("aria-pressed", sel.has(id));
      return b;
    }));
    acomodarMano();
  }
  function pintarPuntos() {
    puntosEl.forEach((p, j) => { p.querySelector("b").textContent = V.puntos[j]; p.querySelector("small").textContent = `de ${V.meta}`; p.classList.toggle("cerca", V.puntos[j] >= V.meta - 800); });
  }
  function pintarBarra() {
    const m = marcadas(), t = enTurno();
    caraSlots.forEach((c, j) => c.classList.toggle("turno", (V.fase === "robar" || V.fase === "jugar") && V.turno === j));
    mesa.classList.toggle("mi-turno", t);
    $(".sub-rival").textContent = V.turno === rv && (V.fase === "robar" || V.fase === "jugar") ? (V.fase === "robar" ? "piensa…" : "juega…") : V.bajo[rv] ? "rival" : `rival · le piden ${V.minimos[rv]}`;
    $(".sub-yo").textContent = V.bajo[yo] ? `${plural(V.mano.length, "carta", "cartas")}` : `primera bajada: ${V.minimos[yo]}`;
    let txt = "";
    if (V.fase === "recuento") txt = "recuento de la mano";
    else if (V.fase === "fin") txt = "";
    else if (!t) txt = `le toca a ${nombres[rv]}`;
    else if (V.fase === "robar") txt = m.length ? "tocá el pozo para levantarlo con esas" : "robá del mazo o levantá el pozo";
    else txt = m.length === 0 ? "marcá cartas para bajar, o una para tirar" : m.length === 1 ? "tirala al pozo, o sumala a un juego" : "bajalas o sumalas a un juego";
    ayuda.textContent = txt;
    const jugar = t && V.fase === "jugar" && !enviando;
    let pl = null;
    if (jugar && m.length) pl = planBajada(m, V.juegos[yo]);
    // con una sola carta, Bajar solo aparece si es natural y ya tenés ese juego (una libre suelta se toca sobre el juego)
    const sirveSola = m.length === 1 && !esLibre(m[0]) && V.juegos[yo].some((g) => g.rango === rango(m[0]));
    btnBajar.hidden = !(jugar && m.length && (m.length > 1 || sirveSola));
    btnBajar.textContent = pl && !pl.error && !pl.nuevos.length ? "Agregar" : "Bajar";
    btnTirar.hidden = !(jugar && m.length === 1);
    // la tiza: cuánto suman las marcadas contra el mínimo de la primera bajada
    if (t && m.length && !V.bajo[yo]) {
      const extra = V.fase === "robar" && V.pozo.tope ? valorTope() : 0;
      const s = sumar(m) + extra, min = V.minimos[yo];
      tiza.innerHTML = `${extra ? "con el pozo " : ""}<b>${s}</b> <small>de ${min}</small>${s >= min ? " ✓" : ""}`;
      tiza.classList.add("ver"); tiza.classList.toggle("justo", s >= min);
    } else tiza.classList.remove("ver", "justo");
  }
  const valorTope = () => (V.pozo.tope && !V.pozo.tapado ? sumar([V.pozo.tope]) : 0);
  function pintar() {
    if (!enTurno()) sel.clear();
    for (const c of [...sel]) if (!V.mano.includes(c)) sel.delete(c);
    nombres = V.nombres?.length ? V.nombres : nombres;
    pintarNombres(); pintarJuegos(); pintarCentro(); pintarMano(); pintarPuntos(); pintarBarra();
  }

  // ---------- jugar ----------
  async function enviar(accion) {
    if (!puedo()) return "no";
    enviando = true;
    let r = null;
    try { r = await fuente.enviar(accion); } finally { enviando = false; }
    if (r) { mostrarAviso(r.motivo === "minimo" ? `${r.mensaje} (te piden ${V.minimos[yo]})` : r.mensaje, 3400); temblar(); pintar(); return r; }
    return null;
  }
  async function robar() {
    if (!puedo() || V.fase !== "robar") return;
    if (!V.mazo) { mostrarAviso("No queda mazo: la mano termina."); }
    await enviar({ t: "robar" });
  }
  async function levantarPozo() {
    if (!puedo() || V.fase !== "robar") return;
    const a = accionPozo(V, marcadas());
    if (a.error) { mostrarAviso(a.error, 3400); temblar(pozoEl); return; }
    const r = await enviar(a);
    if (!r) sel.clear();
  }
  async function tirar(carta) {
    if (!puedo() || V.fase !== "jugar") return;
    const r = await enviar({ t: "tirar", carta });
    if (!r) sel.clear();
  }
  async function bajar(cartas, rangoDestino = null) {
    if (!puedo() || V.fase !== "jugar" || !cartas.length) return;
    if (rangoDestino !== null) {
      const r = await enviar({ t: "agregar", rango: rangoDestino, cartas });
      if (!r) sel.clear();
      pintar();
      return;
    }
    const pl = planBajada(cartas, V.juegos[yo]);
    if (pl.error) { mostrarAviso(pl.error, 3400); temblar(); return; }
    if (pl.nuevos.length && await enviar({ t: "bajar", juegos: pl.nuevos })) return;
    for (const a of pl.agregar) if (await enviar({ t: "agregar", rango: a.rango, cartas: a.cartas })) return;
    sel.clear();
    pintar();
  }

  mazoEl.addEventListener("click", () => { if (!recienArrastre) robar(); });
  pozoEl.addEventListener("click", () => {
    if (recienArrastre || !puedo()) return;
    if (V.fase === "robar") levantarPozo();
    else if (sel.size === 1) tirar(marcadas()[0]);
    else mostrarAviso(sel.size ? "Al pozo va una sola carta." : "Marcá la carta que tirás.");
  });
  $(".mis-juegos").parentElement.addEventListener("click", (e) => {
    if (recienArrastre || !puedo() || V.fase !== "jugar" || !sel.size) return;
    const j = e.target.closest(".juego");
    if (j && juegosEl[yo].contains(j)) bajar(marcadas(), Number(j.dataset.r));
    else bajar(marcadas());
  });
  btnBajar.addEventListener("click", () => bajar(marcadas()));
  btnTirar.addEventListener("click", () => { if (sel.size === 1) tirar(marcadas()[0]); });

  // ---------- tocar y arrastrar mis cartas ----------
  let arrastre = null, recienArrastre = false;
  miMano.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".carta-mano");
    if (!b || e.button > 0) return;
    e.preventDefault();
    const r = b.getBoundingClientRect();
    arrastre = { id: b.dataset.id, nodo: b, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, movio: false, fantasma: null, destino: null };
  });
  addEventListener("pointermove", moverArrastre);
  addEventListener("pointerup", soltarArrastre);
  addEventListener("pointercancel", cancelarArrastre);
  function destinoEn(x, y) {
    const d = document.elementFromPoint(x, y);
    if (!d) return null;
    if (d.closest(".pozo-c")) return { pozo: true, nodo: pozoEl };
    const j = d.closest(".juego");
    if (j && juegosEl[yo].contains(j)) return { rango: Number(j.dataset.r), nodo: j };
    const z = d.closest(".mia-zona");
    if (z) return { zona: true, nodo: z };
    return null;
  }
  function moverArrastre(e) {
    const a = arrastre;
    if (!a) return;
    if (!a.movio && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 8) return;
    if (!puedo()) return;
    if (!a.movio) {
      a.movio = true;
      if (!sel.has(a.id)) { sel.add(a.id); pintarMano(); pintarBarra(); }
      const n = sel.size;
      a.fantasma = el(`<div class="carta arrastre">${frente(a.id)}${n > 1 ? `<b class="cuantas">${n}</b>` : ""}</div>`);
      a.fantasma.style.width = a.w + "px";
      mesa.append(a.fantasma);
      a.nodo.classList.add("levantada");
      sonido.play("carta");
    }
    const mr = mesa.getBoundingClientRect();
    a.fantasma.style.transform = `translate(${e.clientX - mr.left - a.dx}px, ${e.clientY - mr.top - a.dy}px) rotate(-4deg)`;
    const d = destinoEn(e.clientX, e.clientY);
    if (a.destino?.nodo !== d?.nodo) { a.destino?.nodo.classList.remove("encima"); d?.nodo.classList.add("encima"); }
    a.destino = d;
  }
  function limpiarArrastre() {
    const a = arrastre;
    arrastre = null;
    if (!a) return null;
    a.fantasma?.remove();
    a.nodo.classList.remove("levantada");
    a.destino?.nodo.classList.remove("encima");
    return a;
  }
  function soltarArrastre() {
    const a = arrastre;
    if (!a) return;
    if (!a.movio) {
      limpiarArrastre();
      if (!enTurno()) { mostrarAviso(`Le toca a ${nombres[rv]}.`, 1400); return; }
      if (sel.has(a.id)) sel.delete(a.id); else sel.add(a.id);
      sonido.play("carta");
      pintarMano(); pintarBarra(); pintarCentro();
      return;
    }
    const d = a.destino;
    limpiarArrastre();
    // el click que sigue al pointerup no cuenta como toque; si no cae en ningún lado, la carta queda marcada
    recienArrastre = true;
    setTimeout(() => { recienArrastre = false; }, 0);
    if (!d) { pintar(); return; }
    if (d.pozo) {
      if (V.fase === "robar") levantarPozo();
      else if (sel.size === 1) tirar(a.id);
      else { mostrarAviso("Al pozo va una sola carta."); temblar(pozoEl); }
    } else if (V.fase !== "jugar") mostrarAviso("Primero robá del mazo o levantá el pozo.");
    else if (d.rango) bajar(marcadas(), d.rango);
    else bajar(marcadas());
  }
  function cancelarArrastre() { if (arrastre) { limpiarArrastre(); pintar(); } }

  // ---------- vuelos ----------
  function volar(id, desde, hasta, { boca = true, ms = 380, despues } = {}) {
    if (!desde || !hasta || QUIETO) { despues?.(); return; }
    const mr = mesa.getBoundingClientRect();
    const n = el(`<div class="carta vuelo">${boca ? frente(id) : dorso("clasico")}</div>`);
    n.style.width = desde.width + "px";
    n.style.transform = `translate(${desde.left - mr.left}px, ${desde.top - mr.top}px)`;
    mesa.append(n);
    const k = hasta.width / desde.width;
    n.animate([
      { transform: `translate(${desde.left - mr.left}px, ${desde.top - mr.top}px)` },
      { transform: `translate(${hasta.left - mr.left}px, ${hasta.top - mr.top}px) scale(${k})` },
    ], { duration: dur(ms), easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }).finished.then(() => { n.remove(); despues?.(); }, () => { n.remove(); despues?.(); });
  }
  const rectDe = (nodo) => nodo?.getBoundingClientRect() || null;
  /** Hace volar las cartas `ids` desde donde estaban (o desde `origen`) hasta donde quedaron dibujadas. */
  function aterrizar(ids, antes, origen, { boca = true, ms = 380, paso = 50 } = {}) {
    ids.forEach((id, k) => {
      const nodo = mesa.querySelector(`.pano [data-id="${id}"], .mi-mano [data-id="${id}"]`);
      const desde = antes.get(id) || origen;
      if (!nodo || !desde) return;
      nodo.style.opacity = "0";
      setTimeout(() => volar(id, desde, nodo.getBoundingClientRect(), { boca, ms, despues: () => { nodo.style.opacity = ""; } }), k * paso);
    });
  }

  // ---------- eventos del motor ----------
  function eventos(v, ev) {
    const antes = new Map([...mesa.querySelectorAll(".mi-mano [data-id], .pano [data-id]")].map((n) => [n.dataset.id, n.getBoundingClientRect()]));
    const mazoRect = rectDe(mazoEl.querySelector(".pila-dorsos")), pozoRect = rectDe(pozoEl.querySelector(".tope .carta")) || rectDe(pozoEl);
    const rivalRect = rectDe($(".rival-mano-n"));
    V = v;
    if (ev.some((e) => e.t === "robo" || e.t === "pozo" || e.t === "reparto")) nuevas = new Set(v.robadas || []);
    pintar();
    let esperar = 0;
    for (const e of ev) {
      const mia = e.jugador === yo;
      if (e.t === "robo") {
        sonido.play("carta");
        if (mia) aterrizar(v.robadas, new Map(), mazoRect, { boca: false, ms: 320, paso: 120 });
        else if (mazoRect && rivalRect) volar("x", mazoRect, rivalRect, { boca: false, ms: 320 });
        setTimeout(() => { nuevas.clear(); miMano.querySelectorAll(".nueva").forEach((n) => n.classList.remove("nueva")); }, 1800);
      } else if (e.t === "rojo") {
        setTimeout(() => mostrarAviso(mia ? "¡Un 3 rojo! Va a la mesa y robás otra." : `${nombres[rv]} sacó un 3 rojo`), 300);
      } else if (e.t === "tirar") {
        sonido.play("poner");
        const nodo = pozoEl.querySelector(".tope .carta");
        if (nodo) { nodo.style.opacity = "0"; volar(e.carta, mia ? antes.get(e.carta) : rivalRect, nodo.getBoundingClientRect(), { despues: () => { nodo.style.opacity = ""; } }); }
        if (e.congela) setTimeout(() => mostrarAviso(mia ? "Tiraste una libre: el pozo queda congelado." : `${nombres[rv]} congeló el pozo`), 350);
        else if (esNegro3(e.carta)) setTimeout(() => mostrarAviso(mia ? "3 negro: el pozo queda tapado para el otro." : "3 negro: el pozo está tapado este turno"), 350);
      } else if (e.t === "bajar" || e.t === "agregar") {
        sonido.play("poner");
        const ids = e.t === "bajar" ? e.juegos.flat() : e.cartas;
        aterrizar(ids, mia ? antes : new Map(), rivalRect);
      } else if (e.t === "pozo") {
        sonido.play("llevar");
        aterrizar([e.tope, ...e.con, ...e.juegos.flat()], mia ? new Map([...antes].filter(([id]) => id !== e.tope)) : new Map(), mia ? null : rivalRect);
        const t = mesa.querySelector(`.pano [data-id="${e.tope}"]`);
        if (t && pozoRect) { t.style.opacity = "0"; volar(e.tope, pozoRect, t.getBoundingClientRect(), { ms: 420, despues: () => { t.style.opacity = ""; } }); }
        if (mia) aterrizar(v.robadas, new Map(), pozoRect, { ms: 360, paso: 35 });
        else if (pozoRect && rivalRect) volar("x", pozoRect, rivalRect, { boca: false, ms: 420 });
        if (e.n >= 4) setTimeout(() => mostrarAviso(mia ? `Te llevaste el pozo: ${e.n} cartas` : `${nombres[rv]} se llevó el pozo (${e.n} cartas)`), 450);
        setTimeout(() => { nuevas.clear(); miMano.querySelectorAll(".nueva").forEach((n) => n.classList.remove("nueva")); }, 2200);
      } else if (e.t === "canasta") {
        setTimeout(() => {
          gritar("¡Canasta!", `${mia ? "" : "rival"} ${e.pura ? "" : "chico"}`);
          if (mia) { sonido.voz("canasta", "chin"); vibrar([20, 40, 60]); } else sonido.play("chin");
          reaccionar(caras[e.jugador], "risa", 1400);
          if (e.pura) mostrarAviso(`${mia ? "Canasta pura" : `${nombres[rv]}: canasta pura`} de ${rotuloRango(e.rango)} · 500`);
        }, 420);
        esperar = Math.max(esperar, 600);
      } else if (e.t === "cierre") {
        setTimeout(() => {
          gritar("¡Me voy!", mia ? "" : "rival");
          if (mia) { sonido.voz("me_voy", "chin"); vibrar([30, 50, 80]); } else sonido.play("chin");
          reaccionar(caras[e.jugador], "risa", 1600); reaccionar(caras[1 - e.jugador], "bronca", 1600);
        }, 300);
        esperar = Math.max(esperar, 1400);
      } else if (e.t === "mazo_vacio") {
        mostrarAviso("Se terminó el mazo: la mano termina sin cierre.");
        esperar = Math.max(esperar, 1200);
      } else if (e.t === "reparto") {
        sonido.play("carta");
        nuevas.clear();
        const cartas = [...miMano.querySelectorAll(".carta-mano")];
        cartas.forEach((b, k) => { b.style.opacity = "0"; setTimeout(() => volar(b.dataset.id, mazoRect, b.getBoundingClientRect(), { boca: false, ms: 260, despues: () => { b.style.opacity = ""; } }), 80 + k * 55); });
        if (e.mano > 1) mostrarAviso(`Mano ${e.mano} · reparte ${e.reparte === yo ? "vos" : nombres[e.reparte]}`);
        const rm = e.rojos[yo].length;
        if (rm) setTimeout(() => mostrarAviso(rm === 1 ? "Te tocó un 3 rojo: va a la mesa y te reponen otra." : `Te tocaron ${rm} tres rojos: van a la mesa.`), 1300);
        recuentoEl.hidden = true;
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
  function mostrarRecuento() {
    const r = V.recuento;
    if (!r || V.fase !== "recuento") return;
    const a = r.jugadores[yo], b = r.jugadores[rv];
    const signo = (x) => (x > 0 ? `+${x}` : `${x}`);
    const can = (c) => (c.puras || c.impuras ? [c.puras ? plural(c.puras, "pura", "puras") : "", c.impuras ? plural(c.impuras, "impura", "impuras") : ""].filter(Boolean).join(" · ") + `<small>${signo(c.puras * 500 + c.impuras * 300)}</small>` : "—");
    const fila = (n, x, y) => `<tr><th scope="row">${n}</th><td>${x}</td><td>${y}</td></tr>`;
    recuentoEl.innerHTML = `
      <div class="fin-caja pizarra">
        <p class="fin-titulo chico">Mano ${r.mano}</p>
        <p class="fin-sub">${r.cerro === null ? "Se terminó el mazo: nadie cerró." : r.cerro === yo ? "Cerraste vos." : `Cerró ${esc(nombres[rv])}.`}</p>
        <table class="fin-tabla">
          <thead><tr><th></th><th scope="col">vos</th><th scope="col">${esc(nombres[rv])}</th></tr></thead>
          <tbody>
            ${fila("cartas bajadas", signo(a.cartas), signo(b.cartas))}
            ${fila("canastas", can(a), can(b))}
            ${fila("3 rojos", a.nRojos ? signo(a.rojos) : "—", b.nRojos ? signo(b.rojos) : "—")}
            ${fila("cierre", a.cierre ? "+100" : "—", b.cierre ? "+100" : "—")}
            ${fila("en la mano", a.mano ? signo(a.mano) : "—", b.mano ? signo(b.mano) : "—")}
            <tr class="suma"><th scope="row">esta mano</th><td>${signo(a.total)}</td><td>${signo(b.total)}</td></tr>
            <tr class="van"><th scope="row">van</th><td>${r.despues[yo]}</td><td>${r.despues[rv]}</td></tr>
          </tbody>
        </table>
        <p class="fin-sub">Para la próxima bajada te piden ${V.minimos[yo]}. Se juega a ${V.meta}.</p>
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
    const signo = (x) => (x > 0 ? `+${x}` : `${x}`);
    const manos = V.historial.map((h) => `<tr><th scope="row">mano ${h.mano}${h.cerro === yo ? " · cerraste" : h.cerro === rv ? " · cerró" : ""}</th><td>${signo(h.total[yo])}</td><td>${signo(h.total[rv])}</td></tr>`).join("");
    finEl.innerHTML = `
      <div class="fin-caja pizarra">
        <p class="fin-titulo ${gane ? "gane" : "perdi"}">${gane ? "¡Ganaste!" : "Perdiste"}</p>
        <p class="fin-sub"><b>${V.puntos[yo]}</b> a <b>${V.puntos[rv]}</b> en ${plural(V.historial.length, "mano", "manos")}</p>
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
    vigiaTam.disconnect(); vigiaJuegos.disconnect();
    cesar.forEach((f) => f && f());
    ROTULO.texto = rotuloAntes;
    cont.innerHTML = "";
  };
}
