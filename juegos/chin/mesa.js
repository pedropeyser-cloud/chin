// Pantalla de la mesa de CHIN (dirección B «El sol»). Dibuja la `vista` que le da la fuente de partida
// (local contra el bot o, en la tanda de red, PeerJS) y reacciona a los eventos con animación y sonido.
// No conoce las reglas: solo manda acciones y muestra lo que vuelve.

import { frente, dorso } from "../../nucleo/cartas.js";
import { cara, reaccionar, parpadear } from "../../nucleo/caras.js";
import { sonido } from "../../nucleo/sonido.js";
import { LISTA as EMOTES, textoDe, mudo as emotesMudo, ponerMudo } from "../../nucleo/emotes.js";

const MANO = 5;
const nombreCarta = (id) => { const [n, p] = id.split("-"); return `${n} de ${p}`; };

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (ms) => (QUIETO ? Math.min(ms, 60) : ms);

const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));  // los nombres pueden venir de la red
const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

const SOL = (() => {
  let rayos = "";
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    rayos += `<line x1="${(36 * c).toFixed(1)}" y1="${(36 * s).toFixed(1)}" x2="${(54 * c).toFixed(1)}" y2="${(54 * s).toFixed(1)}"/>`;
  }
  return `<svg viewBox="-60 -60 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><circle r="27"/>${rayos}</g></svg>`;
})();

function tween(nodo, desde, hasta, ms) {
  if (desde === hasta || QUIETO) { nodo.textContent = hasta; return; }
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    nodo.textContent = Math.round(desde + (hasta - desde) * k);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/**
 * @param {HTMLElement} cont contenedor
 * @param {{fuente: object, formaCara?: [number, number], salir: () => void, otraDificultad?: () => void}} o
 * @returns {() => void} desmontar
 */
export function montarMesa(cont, { fuente, salir, otraDificultad, alFin }) {
  const yo = fuente.yo, rv = 1 - yo;
  const nombres = fuente.vista().nombres;
  const jug = fuente.jugadores();
  const formas = jug.map((j, i) => (Number.isInteger(j.estilo?.cara) ? j.estilo.cara : [2, 4][i]));

  cont.innerHTML = "";
  const mesa = el(`
  <div class="mesa" data-estado="espera">
    <header class="franja arriba">
      <div class="cara-slot rival-cara"><span class="burbuja rival-burbuja"></span></div>
      <div class="quien"><span class="n-rival"></span><small class="sub-rival">rival</small></div>
      <div class="total total-rival" aria-live="off"><b>0</b><small>cartas</small></div>
      <div class="mazo rival-mazo"></div>
      <button class="icono emote-btn" aria-label="Reacciones">💬</button>
      <button class="icono sonido-btn" aria-label="Sonido"></button>
      <div class="emotes-bandeja" hidden></div>
    </header>
    <div class="mano-fila rival-fila" aria-label="Las cartas del rival"></div>
    <div class="pano">
      <div class="pila" data-pila="0" role="button" aria-label="Pila izquierda"><div class="hueco"></div></div>
      <button class="chin sol" aria-label="CHIN" aria-disabled="true">${SOL}<span>CHIN</span></button>
      <div class="pila" data-pila="1" role="button" aria-label="Pila derecha"><div class="hueco"></div></div>
      <div class="grito" aria-live="assertive"></div>
      <div class="aviso" aria-live="polite"></div>
    </div>
    <div class="mano-fila mia-fila" aria-label="Tus cartas"></div>
    <header class="franja abajo">
      <div class="mazo mio-mazo" aria-label="Tu mazo"></div>
      <div class="quien"><span class="n-yo"></span><small class="ayuda">arrastrá las cartas a una pila</small></div>
      <div class="total total-yo" aria-live="off"><b>0</b><small>cartas</small></div>
      <div class="cara-slot mia-cara"><span class="burbuja mia-burbuja"></span></div>
    </header>
    <div class="cuenta" aria-hidden="true"></div>
    <div class="corte" hidden>Se cortó la conexión. Reintentando…</div>
    <div class="fin" hidden></div>
  </div>`);
  cont.append(mesa);
  const $ = (s) => mesa.querySelector(s);
  const sol = $(".sol"), grito = $(".grito"), aviso = $(".aviso"), cuenta = $(".cuenta"), fin = $(".fin");
  const pilas = [...mesa.querySelectorAll(".pila")];
  const mazos = [yo === 0 ? $(".mio-mazo") : $(".rival-mazo"), yo === 0 ? $(".rival-mazo") : $(".mio-mazo")];
  const filas = [yo === 0 ? $(".mia-fila") : $(".rival-fila"), yo === 0 ? $(".rival-fila") : $(".mia-fila")];
  filas.forEach((f, j) => {
    f.innerHTML = Array.from({ length: MANO }, (_, i) => j === yo
      ? `<button type="button" class="mano-slot" data-i="${i}" aria-label="Carta ${i + 1}"></button>`
      : `<div class="mano-slot mini" data-i="${i}"></div>`).join("");
  });
  const slots = filas.map((f) => [...f.querySelectorAll(".mano-slot")]);
  const mazoMio = mazos[yo];

  const pano = jug[yo]?.estilo?.pano;
  if (pano) $(".pano").dataset.pano = pano;
  $(".n-rival").textContent = nombres[rv];
  $(".n-yo").textContent = nombres[yo];
  const caraMia = el(cara(formas[yo], "tu cara")), caraRival = el(cara(formas[rv], "cara del rival"));
  $(".mia-cara").append(caraMia); $(".rival-cara").append(caraRival);
  const cesar = [parpadear(caraMia), parpadear(caraRival)];
  const caras = [yo === 0 ? caraMia : caraRival, yo === 0 ? caraRival : caraMia];

  mazos.forEach((m, j) => {
    const d = jug[j]?.estilo?.dorso || "clasico";
    m.innerHTML = `<div class="capa c3">${dorso(d)}</div><div class="capa c2">${dorso(d)}</div><div class="capa c1">${dorso(d)}</div><b>0</b>`;
  });
  const enMazoN = mazos.map((m) => m.querySelector("b"));        // en el mazo: lo que queda para reponer
  const totales = [yo === 0 ? $(".total-yo") : $(".total-rival"), yo === 0 ? $(".total-rival") : $(".total-yo")];
  const cuentas = totales.map((n) => n.querySelector("b"));        // en su poder: mazo + fila (lo que le falta para ganar)

  const btnSonido = $(".sonido-btn");
  const pintarSonido = () => { btnSonido.textContent = sonido.mudo ? "🔇" : "🔊"; };
  pintarSonido();
  btnSonido.addEventListener("click", () => { sonido.setMudo(!sonido.mudo); pintarSonido(); });

  // ---------- estado de lo que está dibujado ----------
  const S = { tope: [null, null], mano: [Array(MANO).fill(null), Array(MANO).fill(null)], trabado: false, apil: [Array(MANO).fill(0), Array(MANO).fill(0)], cartas: [null, null], coincId: null, par: false, vistoId: null, vistoT: 0, fin: false };
  let llegadas = [null, null];        // por pila: de dónde viene la carta que acaba de caer
  let ultimoAviso = 0;
  let yoQuiero = false, rivalQuiere = false;

  function mostrarAviso(txt) {
    aviso.textContent = txt;
    aviso.classList.remove("ver"); void aviso.offsetWidth; aviso.classList.add("ver");
    ultimoAviso = performance.now();
  }
  function gritar(txt, clase = "") {
    grito.className = "grito"; void grito.offsetWidth;
    grito.textContent = txt; grito.className = "grito pop " + clase;
  }

  // ---------- acciones del jugador ----------
  function enviar(accion) {
    sonido.despertar();
    const rechazar = (r) => {
      if (!r) return;
      sonido.play("rechazo");
      mostrarAviso(r.mensaje);
      sol.classList.remove("no"); void sol.offsetWidth; sol.classList.add("no");
    };
    const r = fuente.enviar(accion);
    if (r && typeof r.then === "function") r.then(rechazar); else rechazar(r);   // en red la respuesta llega después
  }
  // ---------- arrastrar ----------
  // La velocidad de la mano es parte del juego: las cartas se arrastran de la fila a una pila y del mazo a la fila.
  // Con los mazos marcados (nadie puede tirar), se toca el mazo propio.
  const dentro = (r, x, y, m = 0) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
  let arrastre = null;        // { tipo: "carta"|"mazo", i, fantasma, dx, dy, x0, y0, movio, origen }
  let soltado = null;         // { rect, t }: de dónde sale la carta que acabo de soltar (para la animación a la pila)
  let avisoArrastre = 0;

  function empezar(e, tipo, i) {
    const v = fuente.vista();
    if (v.fase !== "jugando" || arrastre) return;
    const origen = tipo === "carta" ? slots[yo][i] : mazoMio;
    const r = (tipo === "carta" ? origen.firstElementChild : origen.querySelector(".c1"))?.getBoundingClientRect() || origen.getBoundingClientRect();
    const mr = mesa.getBoundingClientRect();
    const fantasma = el(`<div class="carta arrastre">${tipo === "carta" ? frente(v.mano[yo][i]) : dorso(jug[yo]?.estilo?.dorso || "clasico")}</div>`);
    Object.assign(fantasma.style, { left: r.left - mr.left + "px", top: r.top - mr.top + "px", width: r.width + "px" });
    fantasma.hidden = true;   // aparece recién cuando el dedo se mueve: un toque solo no levanta nada
    mesa.append(fantasma);
    arrastre = { tipo, i, fantasma, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, movio: false, origen, r0: r, mr };
    try { origen.setPointerCapture(e.pointerId); } catch { /* ok */ }
  }
  function mover(e) {
    const a = arrastre;
    if (!a) return;
    if (!a.movio && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
    if (!a.movio) { a.movio = true; a.fantasma.hidden = false; if (a.tipo === "carta") a.origen.classList.add("levantada"); sonido.play("carta"); }
    const x = e.clientX - a.dx - a.r0.left, y = e.clientY - a.dy - a.r0.top;
    a.fantasma.style.transform = `translate(${x}px, ${y}px) rotate(${Math.max(-8, Math.min(8, (e.clientX - a.x0) / 30))}deg) scale(1.06)`;
    if (a.tipo === "carta") pilas.forEach((pl) => pl.classList.toggle("encima", dentro(pl.getBoundingClientRect(), e.clientX, e.clientY, 18)));
    else filas[yo].classList.toggle("encima", dentro(filas[yo].getBoundingClientRect(), e.clientX, e.clientY, 14));
  }
  function volverAlLugar(a) {
    const f = a.fantasma;
    const anim = QUIETO ? null : f.animate([{ transform: f.style.transform || "none" }, { transform: "none" }], { duration: 160, easing: "ease-out" });
    const fin = () => { f.remove(); a.origen.classList.remove("levantada"); };
    if (anim) anim.finished.then(fin).catch(fin); else fin();
  }
  function soltar(e) {
    const a = arrastre;
    if (!a) return;
    arrastre = null;
    pilas.forEach((pl) => pl.classList.remove("encima"));
    filas[yo].classList.remove("encima");
    if (!a.movio) {
      a.fantasma.remove(); a.origen.classList.remove("levantada");
      const v = fuente.vista();
      if (a.tipo === "mazo" && v.trabado && !v.trabado.listos[yo]) { enviar({ t: "destrabar" }); return; }
      if (performance.now() - avisoArrastre > 4000) {
        avisoArrastre = performance.now();
        mostrarAviso(a.tipo === "carta" ? "Arrastrala hasta una pila" : (v.mano[yo].includes(null) ? "Arrastrá del mazo a un hueco de tu fila" : "Tu fila está completa"));
      }
      return;
    }
    if (a.tipo === "carta") {
      const p = pilas.findIndex((pl) => dentro(pl.getBoundingClientRect(), e.clientX, e.clientY, 18));
      if (p < 0) {
        // sobre otra carta de la fila: si es del mismo número, se apilan en ese lugar
        const k = slots[yo].findIndex((n, q) => q !== a.i && dentro(n.getBoundingClientRect(), e.clientX, e.clientY, 4));
        const v = fuente.vista();
        if (k >= 0 && v.mano[yo][k]) {
          a.fantasma.remove(); a.origen.classList.remove("levantada");
          enviar({ t: "juntar", desde: a.i, hacia: k });
          return;
        }
        volverAlLugar(a); return;
      }
      soltado = { rect: a.fantasma.getBoundingClientRect(), t: performance.now() };
      a.fantasma.remove();
      a.origen.classList.remove("levantada");
      enviar({ t: "poner", carta: a.i, pila: p });
      return;
    }
    // del mazo a la fila: al hueco que está debajo, o al primero libre
    const v = fuente.vista();
    if (!dentro(filas[yo].getBoundingClientRect(), e.clientX, e.clientY, 14)) { volverAlLugar(a); return; }
    let i = slots[yo].findIndex((n, k) => !v.mano[yo][k] && dentro(n.getBoundingClientRect(), e.clientX, e.clientY, 6));
    if (i < 0) i = v.mano[yo].findIndex((c) => !c);
    a.fantasma.remove();
    if (i < 0) { mostrarAviso("Tu fila está completa"); return; }
    enviar({ t: "reponer", carta: i });
  }
  function cancelar() { if (arrastre) { const a = arrastre; arrastre = null; volverAlLugar(a); } }

  slots[yo].forEach((n, i) => n.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    sonido.despertar();
    if (fuente.vista().mano[yo][i]) empezar(e, "carta", i);
  }));
  mazoMio.addEventListener("pointerdown", (e) => { e.preventDefault(); sonido.despertar(); empezar(e, "mazo", null); });
  for (const n of [...slots[yo], mazoMio]) {
    n.addEventListener("pointermove", mover);
    n.addEventListener("pointerup", soltar);
    n.addEventListener("pointercancel", cancelar);
    n.addEventListener("lostpointercapture", () => { if (arrastre && arrastre.origen === n) cancelar(); });
  }

  const cantar = () => {
    const v = fuente.vista();
    // si la pareja se acaba de tapar, mandamos igual el id que veías para que el juego explique qué pasó
    const visto = v.coincidencia ? v.coincidencia.id : (performance.now() - S.vistoT < 1500 ? S.vistoId : null);
    enviar({ t: "chin", visto });
  };
  sol.addEventListener("pointerdown", (e) => { e.preventDefault(); cantar(); });
  const teclas = (e) => {
    if (e.repeat) return;
    if (e.code === "Space") { e.preventDefault(); cantar(); }
  };
  addEventListener("keydown", teclas);

  // ---------- animaciones ----------
  function volar(carta, desdeRect, haciaNodo, { rot = 0, girar = true } = {}) {
    const dest = haciaNodo.getBoundingClientRect();
    const o = centro(desdeRect), d = centro(dest);
    const dx = o.x - d.x, dy = o.y - d.y;
    const esc = Math.max(0.5, desdeRect.width / dest.width);
    const k = [
      { transform: `translate(${dx}px,${dy}px) rotate(${rot * 3}deg) scale(${esc})${girar ? " rotateY(80deg)" : ""}` },
      { transform: `translate(${dx * 0.12}px,${dy * 0.12}px) rotate(${rot}deg) scale(1.1)`, offset: 0.78 },
      { transform: `rotate(${rot}deg) scale(1)` },
    ];
    return haciaNodo.animate(k, { duration: dur(230), easing: "cubic-bezier(.2,.75,.3,1)" });
  }

  function nuevoTope(p, carta) {
    const pila = pilas[p];
    const viejo = pila.querySelectorAll(".tope");
    const rot = (Math.random() * 7 - 3.5);
    const n = el(`<div class="carta tope">${frente(carta)}</div>`);
    n.style.transform = `rotate(${rot}deg)`;
    pila.append(n);
    const ll = llegadas[p];
    if (ll) {
      const a = volar(carta, ll.de, n, { rot, girar: ll.girar !== false });
      a.finished.then(() => { n.classList.add("asentada"); setTimeout(() => n.classList.remove("asentada"), 200); }).catch(() => {});
      viejo.forEach((v) => setTimeout(() => v.remove(), dur(240)));
    } else viejo.forEach((v) => v.remove());
    llegadas[p] = null;
  }

  function llevarPilas(perdedor) {
    // las dos pilas viajan hacia el que pierde: copiamos lo que se ve y lo mandamos al mazo
    const mz = mazos[perdedor].getBoundingClientRect();
    const mr = mesa.getBoundingClientRect();
    pilas.forEach((pila, i) => {
      const tope = pila.querySelector(".tope");
      if (!tope) return;
      const r = tope.getBoundingClientRect();
      const c = tope.cloneNode(true);
      c.className = "carta vuelo";
      Object.assign(c.style, { left: r.left - mr.left + "px", top: r.top - mr.top + "px", width: r.width + "px", transform: "" });
      mesa.append(c);
      const a = c.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: `translate(${centro(mz).x - centro(r).x}px,${centro(mz).y - centro(r).y}px) scale(.55) rotate(${(i ? 1 : -1) * 18}deg)`, opacity: 0.2 },
      ], { duration: dur(520), delay: i * dur(70), easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
      a.finished.then(() => c.remove()).catch(() => c.remove());
    });
  }

  // ---------- eventos ----------
  const reaccion = { suma: 0, n: 0 };
  function eventos(v, ev) {
    const cantaron = ev.some((e) => e.t === "chin");
    for (const e of ev) {
      switch (e.t) {
        case "poner": {
          const mio = e.jugador === yo && soltado && performance.now() - soltado.t < 1500;
          llegadas[e.pila] = { de: mio ? soltado.rect : (slots[e.jugador][e.lugar] || mazos[e.jugador]).getBoundingClientRect(), girar: !mio };
          if (e.jugador === yo) soltado = null;
          sonido.play("poner");
          break;
        }
        case "reponer":
          if (e.jugador !== yo) sonido.play("carta");
          break;
        case "juntar":
          sonido.play("poner");
          break;
        case "listo":
          mostrarAviso(e.jugador === yo ? `Esperando que ${nombres[rv]} toque su mazo…` : `${nombres[rv]} ya tocó su mazo: tocá el tuyo`);
          break;
        case "ronda":
        case "destrabe":
          e.cartas.forEach((c, j) => { if (c) llegadas[j] = { de: mazos[j].getBoundingClientRect() }; });
          cancelar();
          sonido.play("carta");
          if (e.t === "destrabe") mostrarAviso(e.como === "mezcla" ? "Sin mazos: se mezclaron las pilas" : "¡Una de cada mazo!");
          else if (e.n > 1) setTimeout(() => mostrarAviso("Ronda nueva: se completa la mano y va una a cada pila"), dur(700));
          break;
        case "coincidencia":
          sonido.play("coincidencia");
          reaccionar(caraMia, "concentrado", 1400); reaccionar(caraRival, "concentrado", 1400);
          break;
        case "chin": {
          const gane = e.jugador === yo;
          sonido.voz(gane ? "chin" : "chin_rival", "chin");
          gritar(gane ? "¡CHIN!" : "¡Chin!", gane ? "mio" : "rival");
          sol.classList.add("estalla"); setTimeout(() => sol.classList.remove("estalla"), dur(500));
          llevarPilas(e.perdedor);
          setTimeout(() => sonido.play("llevar"), 120);
          reaccionar(caras[e.jugador], "risa", 1500);
          reaccionar(caras[e.perdedor], "bronca", 1500);
          if (gane) { reaccion.suma += e.reaccion; reaccion.n++; mostrarAviso(`Lo cantaste en ${Math.round(e.reaccion)} ms`); }
          else mostrarAviso(`${nombres[e.jugador]} lo cantó en ${Math.round(e.reaccion)} ms`);
          break;
        }
        case "fin":
          S.fin = true;
          try { alFin?.(v); } catch (err) { console.error(err); }
          setTimeout(() => mostrarFin(v), dur(cantaron ? 1100 : 600));
          break;
        case "quiere_revancha":
          if (e.jugador !== yo) { rivalQuiere = true; pintarRevancha(); }
          break;
        case "revancha":
          yoQuiero = false; rivalQuiere = false;
          fin.hidden = true; S.fin = false; S.tope = [null, null]; S.coincId = null; cancelar();
          pilas.forEach((p) => p.querySelectorAll(".tope").forEach((t) => t.remove()));
          reaccion.suma = 0; reaccion.n = 0;
          break;
        default:
      }
    }
  }

  // ---------- pintar la vista ----------
  function pintar(v) {
    // contadores
    for (const j of [0, 1]) {
      if (S.cartas[j] !== v.cartas[j]) {
        tween(cuentas[j], S.cartas[j] ?? v.cartas[j], v.cartas[j], 380);
        const subio = S.cartas[j] !== null && v.cartas[j] > S.cartas[j];
        totales[j].classList.remove("late", "sube"); void totales[j].offsetWidth;
        if (S.cartas[j] !== null) totales[j].classList.add(subio ? "sube" : "late");
        totales[j].classList.toggle("poquitas", v.cartas[j] <= 10);
        S.cartas[j] = v.cartas[j];
      }
      enMazoN[j].textContent = v.enMazo[j];
      mazos[j].classList.toggle("vacio", v.enMazo[j] === 0);
      mazos[j].querySelector(".c1").style.display = v.enMazo[j] > 0 ? "" : "none";
      mazos[j].querySelector(".c2").style.display = v.enMazo[j] > 8 ? "" : "none";
      mazos[j].querySelector(".c3").style.display = v.enMazo[j] > 20 ? "" : "none";
    }
    // las manos (boca arriba: se ven las dos)
    for (const j of [0, 1]) {
      for (let i = 0; i < MANO; i++) {
        const c = v.mano[j][i] ?? null;
        const ap = (c && v.apiladas?.[j]?.[i]) || 0;
        if (S.mano[j][i] === c && S.apil[j][i] === ap) continue;
        const n = slots[j][i];
        const nueva = S.mano[j][i] !== c;
        n.innerHTML = c ? `<div class="carta">${frente(c)}</div>${ap ? `<b class="cuantas">×${ap + 1}</b>` : ""}` : "";
        n.classList.toggle("vacio", !c);
        n.dataset.apil = Math.min(ap, 3);
        if (j === yo) n.setAttribute("aria-label", c ? (ap ? `${ap + 1} cartas de ${c.split("-")[0]}` : nombreCarta(c)) : "Lugar vacío");
        if (c && nueva && !QUIETO) n.firstElementChild.animate([{ transform: "translateY(14px) scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 180, easing: "ease-out" });
        S.mano[j][i] = c; S.apil[j][i] = ap;
      }
    }
    // pilas
    v.pilas.forEach((pl, i) => {
      const pila = pilas[i];
      if (pl.tope !== S.tope[i]) {
        if (pl.tope === null) pila.querySelectorAll(".tope").forEach((t) => t.remove());
        else nuevoTope(i, pl.tope);
        S.tope[i] = pl.tope;
      }
      pila.dataset.n = pl.n > 14 ? 3 : pl.n > 6 ? 2 : pl.n > 1 ? 1 : 0;
      pila.classList.toggle("par", !!v.coincidencia);
    });
    // el sol
    const par = !!v.coincidencia;
    sol.classList.toggle("lista", par);
    sol.setAttribute("aria-disabled", par ? "false" : "true");
    if (par) { S.vistoId = v.coincidencia.id; S.vistoT = performance.now(); }
    S.par = par;
    // trabados: se marcan los mazos hasta que cada uno toca el suyo
    const tr = v.fase === "jugando" ? v.trabado : null;
    mazos.forEach((m, j) => { m.classList.toggle("pide", !!tr && !tr.listos[j]); m.classList.toggle("listo", !!tr && tr.listos[j]); });
    if (!!tr !== S.trabado) { S.trabado = !!tr; if (tr && !tr.listos[yo]) mostrarAviso("Nadie puede tirar: tocá tu mazo"); }
    mesa.dataset.estado = v.fase;
  }

  function mostrarFin(v) {
    const gane = v.ganador === yo;
    sonido.play(gane ? "gane" : "perdi");
    reaccionar(caras[v.ganador], "risa", 2500); reaccionar(caras[1 - v.ganador], "bronca", 2500);
    const prom = reaccion.n ? Math.round(reaccion.suma / reaccion.n) : null;
    fin.innerHTML = `
      <div class="fin-caja">
        <p class="fin-titulo ${gane ? "gane" : "perdi"}">${gane ? "¡Ganaste!" : "Perdiste"}</p>
        <p class="fin-sub">${gane ? `Te quedaste sin cartas antes que ${esc(nombres[rv])}.` : `${esc(nombres[rv])} se quedó sin cartas primero.`}</p>
        <ul class="fin-datos">
          <li><b>${Number(v.chins[yo]) || 0}</b> CHIN tuyos</li>
          <li><b>${Number(v.chins[rv]) || 0}</b> de ${esc(nombres[rv])}</li>
          ${prom !== null ? `<li>reaccionaste en <b>${prom} ms</b> en promedio</li>` : ""}
        </ul>
        <div class="fin-botones">
          <button class="boton primario revancha" data-a="revancha">Revancha</button>
          ${otraDificultad ? `<button class="boton" data-a="dificultad">Cambiar dificultad</button>` : ""}
          <button class="boton suave" data-a="salir">Salir</button>
        </div>
      </div>`;
    fin.hidden = false;
    pintarRevancha();
    fin.querySelector('[data-a="revancha"]').focus();
  }
  function pintarRevancha() {
    const b = fin.querySelector(".revancha");
    if (!b) return;
    b.disabled = yoQuiero;
    b.textContent = yoQuiero ? "Esperando al rival…" : rivalQuiere ? `${nombres[rv]} quiere revancha: aceptar` : "Revancha";
  }
  fin.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "revancha") { if (!yoQuiero) { yoQuiero = true; pintarRevancha(); fuente.revancha(); } }
    else if (a === "dificultad") otraDificultad?.();
    else if (a === "salir") salir?.();
  });

  // ---------- cuenta regresiva ----------
  let ultimoN = null, raf = 0;
  function reloj() {
    const v = fuente.vista();
    if (v.fase === "jugando") {
      const resto = v.arranca - fuente.ahora();
      const n = resto > 0 ? Math.ceil(resto / 1000) : (resto > -500 ? 0 : null);
      if (n !== ultimoN) {
        ultimoN = n;
        if (n === null) cuenta.textContent = "";
        else { cuenta.textContent = n === 0 ? "¡YA!" : n; cuenta.classList.remove("pop"); void cuenta.offsetWidth; cuenta.classList.add("pop"); sonido.play(n === 0 ? "ya" : "tic"); }
        mesa.classList.toggle("contando", n !== null && n > 0);
      }
    } else if (ultimoN !== null) { ultimoN = null; cuenta.textContent = ""; mesa.classList.remove("contando"); }
    if (ultimoAviso && performance.now() - ultimoAviso > 2200) { aviso.classList.remove("ver"); ultimoAviso = 0; }
    raf = requestAnimationFrame(reloj);
  }
  raf = requestAnimationFrame(reloj);

  // ---------- reacciones rápidas ----------
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
  function burbuja(j, k) {
    const b = $(j === yo ? ".mia-burbuja" : ".rival-burbuja");
    b.textContent = textoDe(k);
    b.classList.remove("ver"); void b.offsetWidth; b.classList.add("ver");
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("ver"), 2200);
    if (k === "risa" || k === "bien" || k === "rapido") reaccionar(caras[j], "risa", 900);
    else if (k === "uy" || k === "dale") reaccionar(caras[j], "sorpresa", 900);
  }
  const bajaE = fuente.suscribirEmote((k, j) => { if (j !== yo && !emotesMudo()) burbuja(j, k); });

  // ---------- conexión (solo en red) ----------
  const corte = $(".corte");
  const bajaC = fuente.suscribirConexion((estado) => { corte.hidden = estado === "conectado"; });
  const subRival = $(".sub-rival");
  const timerPing = fuente.esLocal ? 0 : setInterval(() => { subRival.textContent = `ping ${fuente.latencia()} ms`; }, 2000);

  const baja = fuente.suscribir((v, ev) => { eventos(v, ev); pintar(v); });
  pintar(fuente.vista());

  return () => {
    baja(); bajaE(); bajaC(); clearInterval(timerPing); cancelAnimationFrame(raf); removeEventListener("keydown", teclas); document.removeEventListener("pointerdown", cerrarBandeja, true);
    cesar.forEach((f) => f && f()); cont.innerHTML = "";
  };
}
