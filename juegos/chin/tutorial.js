// Tutorial de CHIN (2026-11-16): unos 40 s sobre la mesa de verdad, con un reparto armado y el bot quieto.
// Cada cosa se hace una vez: reponer, abrir la pila, tirar, apilar y cantar CHIN. Una mano fantasma muestra el gesto
// y una consigna corta dice qué hacer. Se ve una sola vez (localStorage) y se puede volver a ver desde el menú.
import { nuevaPartida, aplicar, mazoCompleto } from "./motor.js";
import { crearLocal } from "./local.js";
import { montarMesa } from "./mesa.js";

const CLAVE = "chin.tutorial";
export const visto = () => { try { return localStorage.getItem(CLAVE) === "hecho"; } catch { return false; } };
const marcar = () => { try { localStorage.setItem(CLAVE, "hecho"); } catch { /* ok */ } };

// fila del jugador: 6, 3, 11, 3 y un hueco (va el 1); abre con el 5. El rival tiene 6 y 5 en la fila y abrió con un 7.
const MIO = ["6-espada", "3-oro", "11-copa", "3-basto", "1-oro", "5-copa"];
const SUYO = ["6-copa", "5-espada", "10-oro", "12-basto", "2-copa", "7-oro"];
const resto = (usadas) => mazoCompleto().filter((c) => !usadas.includes(c));

/** Estado de arranque del tutorial: el rival ya armó su fila y abrió; a mí me falta una carta y abrir. */
export function estadoTutorial(ahora, nombres = ["Vos", "Don Tranqui"]) {
  let s = nuevaPartida({ nombres, ahora: ahora - 2000, cuenta: 0, mazos: [[...MIO, ...resto(MIO)], [...SUYO, ...resto(SUYO)]] });
  const t = ahora - 1000;
  const hacer = (j, a) => { const r = aplicar(s, j, a, t); if (r.rechazo) throw new Error(`tutorial: ${r.rechazo.motivo}`); s = r.estado; };
  for (let i = 0; i < 5; i++) hacer(1, { t: "reponer", carta: i });
  hacer(1, { t: "abrir" });
  for (let i = 0; i < 4; i++) hacer(0, { t: "reponer", carta: i });
  return s;
}

export const PASOS = [
  { t: "reponer", txt: "Arrastrá una carta de tu mazo al hueco de tu fila." },
  { t: "abrir", txt: "Fila completa: arrastrá una del mazo a tu pila del centro." },
  { t: "poner", txt: "Tirá el 6: va sobre el 5 o sobre el 7 (uno más o uno menos)." },
  { t: "juntar", txt: "Apilá: soltá un 3 sobre el otro 3. Así hacés lugar en tu fila." },
  { t: "chin", txt: "¡Mismo número arriba! Tocá el sol (o apretá espacio)." },
];

/**
 * Monta el tutorial en `app`. `o` = { nombre, estilo, alTerminar() } (se llama al terminar o al saltear).
 * Devuelve desmontar.
 */
export function montarTutorial(app, { nombre = "Vos", estilo = {}, alTerminar } = {}) {
  const fuente = crearLocal({ dificultad: "tranquilo", nombre, estilo, callado: true, pausado: true, inicial: (t) => estadoTutorial(t, [nombre, "Don Tranqui"]) });
  window.__fuente = fuente;   // solo para pruebas
  let paso = 0, terminado = false;

  // solo deja hacer lo que pide el paso (y ordenar la fila, que no molesta)
  const enviarReal = fuente.enviar.bind(fuente);
  fuente.enviar = (a) => {
    if (paso >= PASOS.length) return null;
    if (a.t !== PASOS[paso].t && a.t !== "mover") return { motivo: "tutorial", mensaje: `Ahora: ${PASOS[paso].txt}` };
    return enviarReal(a);
  };

  const desmontarMesa = montarMesa(app, { fuente, salir: () => cerrar() });
  const mesa = app.querySelector(".mesa");
  mesa.classList.add("en-tutorial");
  const capa = document.createElement("div");
  capa.className = "tutorial-capa";
  capa.innerHTML = `
    <div class="tutorial-consigna" role="status" aria-live="polite">
      <span class="tutorial-paso"></span><p class="tutorial-txt"></p>
      <button type="button" class="tutorial-saltear">Saltear</button>
    </div>
    <div class="tutorial-mano" aria-hidden="true"></div>
    <div class="tutorial-fin" hidden>
      <p class="tutorial-fin-tit">¡Eso es!</p>
      <p>El que canta primero le pasa las dos pilas al otro. Gana el que se queda sin cartas.</p>
      <button type="button" class="boton primario tutorial-jugar">A jugar</button>
    </div>`;
  mesa.append(capa);
  const $ = (s) => capa.querySelector(s);
  const mano = $(".tutorial-mano");
  capa.querySelector(".tutorial-saltear").addEventListener("click", () => cerrar());
  capa.querySelector(".tutorial-jugar").addEventListener("click", () => cerrar());

  // ---------- la mano fantasma: va del origen al destino del gesto de este paso ----------
  const q = (s) => mesa.querySelector(s);
  const slotCon = (pref) => [...mesa.querySelectorAll(".mia-fila .mano-slot")].filter((n) => (n.getAttribute("aria-label") || "").startsWith(pref));
  function gesto() {
    const v = fuente.vista();
    switch (PASOS[paso]?.t) {
      case "reponer": return [q(".mio-mazo"), q(".mia-fila .mano-slot.vacio")];
      case "abrir": return [q(".mio-mazo"), q('.pila[data-pila="0"]')];
      case "poner": {
        const seis = slotCon("6 de")[0];
        const pila = v.pilas.findIndex((p) => p.tope && Math.abs(parseInt(p.tope, 10) - 6) === 1);
        return [seis, q(`.pila[data-pila="${Math.max(0, pila)}"]`)];
      }
      case "juntar": { const tres = slotCon("3 de"); return [tres[0], tres[1]]; }
      case "chin": return [q(".sol"), q(".sol")];
      default: return [null, null];
    }
  }
  let anim = null, timer = 0;
  function mostrarGesto() {
    anim?.cancel();
    const [a, b] = gesto();
    if (!a || !b) { mano.hidden = true; return; }
    const mr = mesa.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const xa = ra.left + ra.width / 2 - mr.left, ya = ra.top + ra.height / 2 - mr.top;
    const xb = rb.left + rb.width / 2 - mr.left, yb = rb.top + rb.height / 2 - mr.top;
    mano.hidden = false;
    const toque = a === b;
    const k = toque
      ? [{ transform: `translate(${xa}px,${ya}px) scale(1)`, opacity: 0 }, { transform: `translate(${xa}px,${ya}px) scale(1)`, opacity: 1, offset: 0.2 },
         { transform: `translate(${xa}px,${ya}px) scale(.8)`, opacity: 1, offset: 0.4 }, { transform: `translate(${xa}px,${ya}px) scale(1)`, opacity: 1, offset: 0.6 },
         { transform: `translate(${xa}px,${ya}px) scale(1)`, opacity: 0 }]
      : [{ transform: `translate(${xa}px,${ya}px) scale(1)`, opacity: 0 }, { transform: `translate(${xa}px,${ya}px) scale(.85)`, opacity: 1, offset: 0.15 },
         { transform: `translate(${xb}px,${yb}px) scale(.85)`, opacity: 1, offset: 0.7 }, { transform: `translate(${xb}px,${yb}px) scale(1)`, opacity: 0 }];
    anim = mano.animate(k, { duration: toque ? 1300 : 1600, easing: "ease-in-out", fill: "forwards" });
  }
  function pintarPaso() {
    if (paso >= PASOS.length) return;
    $(".tutorial-paso").textContent = `${paso + 1}/${PASOS.length}`;
    $(".tutorial-txt").textContent = PASOS[paso].txt;
    clearInterval(timer);
    setTimeout(mostrarGesto, 250);
    timer = setInterval(mostrarGesto, 2600);
  }

  const baja = fuente.suscribir((v, ev) => {
    if (terminado) return;
    for (const e of ev) {
      const mio = e.jugador === 0;
      if (paso === 0 && e.t === "reponer" && mio) avanzar();
      else if (paso === 1 && e.t === "abrir" && mio) avanzar();
      else if (paso === 2 && e.t === "poner" && mio) avanzar();
      else if (paso === 3 && e.t === "juntar" && mio) {
        // el rival tira y deja el mismo número arriba de las dos pilas
        mano.hidden = true; clearInterval(timer);
        setTimeout(() => {
          // arriba 6 y 7 → el rival tira su 6 sobre el 7; arriba 5 y 6 → tira su 5 sobre el 6
          const seisALaIzquierda = parseInt(fuente.vista().pilas[0].tope, 10) === 6;
          fuente.jugarRival({ t: "poner", carta: seisALaIzquierda ? 0 : 1, pila: 1 });
        }, 700);
      } else if (paso === 3 && e.t === "coincidencia") avanzar();
      else if (paso === 4 && e.t === "chin" && mio) {
        paso = PASOS.length; clearInterval(timer); anim?.cancel(); mano.hidden = true;
        setTimeout(() => { capa.querySelector(".tutorial-consigna").hidden = true; $(".tutorial-fin").hidden = false; capa.querySelector(".tutorial-jugar").focus(); }, 900);
      }
    }
  });
  function avanzar() { paso++; mesa.querySelector(".aviso")?.classList.remove("ver"); pintarPaso(); }
  pintarPaso();

  function cerrar() {
    if (terminado) return;
    terminado = true;
    marcar();
    desmontar();
    alTerminar?.();
  }
  function desmontar() { clearInterval(timer); anim?.cancel(); baja(); desmontarMesa(); fuente.destruir(); }
  return () => { if (!terminado) { terminado = true; desmontar(); } };
}
