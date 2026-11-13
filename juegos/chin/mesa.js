// Pantalla de la mesa de CHIN (dirección B «El sol»). Dibuja la `vista` que le da la fuente de partida
// (local contra el bot o, en la tanda de red, PeerJS) y reacciona a los eventos con animación y sonido.
// No conoce las reglas: solo manda acciones y muestra lo que vuelve.

import { frente, dorso } from "../../nucleo/cartas.js";
import { cara, reaccionar, parpadear } from "../../nucleo/caras.js";
import { sonido } from "../../nucleo/sonido.js";
import { LISTA as EMOTES, textoDe, mudo as emotesMudo, ponerMudo } from "../../nucleo/emotes.js";

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
      <div class="mano-slot mini rival-mano" aria-label="Carta del rival"></div>
      <div class="mazo rival-mazo"></div>
      <button class="icono emote-btn" aria-label="Reacciones">💬</button>
      <button class="icono sonido-btn" aria-label="Sonido"></button>
      <div class="emotes-bandeja" hidden></div>
    </header>
    <div class="pano">
      <div class="pila" data-pila="0" role="button" aria-label="Pila izquierda"><div class="hueco"></div></div>
      <button class="chin sol" aria-label="CHIN" aria-disabled="true">${SOL}<span>CHIN</span></button>
      <div class="pila" data-pila="1" role="button" aria-label="Pila derecha"><div class="hueco"></div></div>
      <div class="grito" aria-live="assertive"></div>
      <div class="aviso" aria-live="polite"></div>
    </div>
    <header class="franja abajo">
      <div class="mazo mio-mazo" role="button" aria-label="Tu mazo: tocá para dar vuelta"></div>
      <div class="mano-slot mio-mano" aria-label="Tu carta dada vuelta"></div>
      <div class="quien"><span class="n-yo"></span><small class="ayuda">tocá una pila · espacio = CHIN</small></div>
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
  const manos = [yo === 0 ? $(".mio-mano") : $(".rival-mano"), yo === 0 ? $(".rival-mano") : $(".mio-mano")];
  const mazoMio = mazos[yo], manoMia = manos[yo];

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
  const cuentas = mazos.map((m) => m.querySelector("b"));

  const btnSonido = $(".sonido-btn");
  const pintarSonido = () => { btnSonido.textContent = sonido.mudo ? "🔇" : "🔊"; };
  pintarSonido();
  btnSonido.addEventListener("click", () => { sonido.setMudo(!sonido.mudo); pintarSonido(); });

  // ---------- estado de lo que está dibujado ----------
  const S = { tope: [null, null], mano: [null, null], cartas: [null, null], coincId: null, par: false, vistoId: null, vistoT: 0, fin: false };
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
  const poner = (p) => enviar({ t: "poner", pila: p });
  const voltear = () => { if (S.mano[yo] === null && (S.cartas[yo] ?? 0) > 0) enviar({ t: "voltear" }); };
  const cantar = () => {
    const v = fuente.vista();
    // si la pareja se acaba de tapar, mandamos igual el id que veías para que el juego explique qué pasó
    const visto = v.coincidencia ? v.coincidencia.id : (performance.now() - S.vistoT < 1500 ? S.vistoId : null);
    enviar({ t: "chin", visto });
  };

  pilas.forEach((p, i) => p.addEventListener("pointerdown", (e) => { e.preventDefault(); poner(i); }));
  mazoMio.addEventListener("pointerdown", (e) => { e.preventDefault(); voltear(); });
  sol.addEventListener("pointerdown", (e) => { e.preventDefault(); cantar(); });
  const teclas = (e) => {
    if (e.repeat) return;
    if (e.code === "Space") { e.preventDefault(); cantar(); }
    else if (e.code === "ArrowLeft" || e.code === "KeyA") poner(0);
    else if (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "KeyS") poner(1);
    else if (e.code === "ArrowDown" || e.code === "KeyW") voltear();
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
      const a = volar(carta, ll.de, n, { rot });
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
        case "voltear":
          if (!ev.some((x) => x.t === "poner" && x.jugador === e.jugador)) sonido.play("carta");
          break;
        case "poner": {
          const rect = (S.mano[e.jugador] === e.carta ? manos[e.jugador] : mazos[e.jugador]).getBoundingClientRect();
          llegadas[e.pila] = { de: rect };
          sonido.play(e.jugador === yo ? "poner" : "poner");
          break;
        }
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
          fin.hidden = true; S.fin = false; S.tope = [null, null]; S.mano = [null, null]; S.coincId = null;
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
      if (S.cartas[j] !== v.cartas[j]) { tween(cuentas[j], S.cartas[j] ?? v.cartas[j], v.cartas[j], 380); S.cartas[j] = v.cartas[j]; }
      mazos[j].classList.toggle("vacio", v.enMazo[j] === 0);
      mazos[j].querySelector(".c1").style.display = v.enMazo[j] > 0 ? "" : "none";
      mazos[j].querySelector(".c2").style.display = v.enMazo[j] > 8 ? "" : "none";
      mazos[j].querySelector(".c3").style.display = v.enMazo[j] > 20 ? "" : "none";
    }
    // cartas dadas vuelta
    for (const j of [0, 1]) {
      if (S.mano[j] !== v.mano[j]) {
        manos[j].innerHTML = v.mano[j] ? `<div class="carta">${frente(v.mano[j])}</div>` : "";
        if (v.mano[j] && !QUIETO) manos[j].firstElementChild.animate([{ transform: "rotateY(85deg) scale(.9)" }, { transform: "none" }], { duration: 150, easing: "ease-out" });
        S.mano[j] = v.mano[j];
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
    mazoMio.classList.toggle("pide", v.mano[yo] === null && v.cartas[yo] > 0 && v.fase === "jugando" && fuente.ahora() >= v.arranca);
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
          <li><b>${v.chins[yo]}</b> CHIN tuyos</li>
          <li><b>${v.chins[rv]}</b> de ${esc(nombres[rv])}</li>
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
