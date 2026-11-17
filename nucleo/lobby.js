// Lobby de la plataforma: tres pantallas (Jugar, Pulpería, Vos) con cabecera de perfil y barra de abajo.
// Jugar = catálogo de juegos (registro.js). Pulpería = lo que se consigue con la gloria (catalogo.js).
// Vos = entrar con Google, elegir usuario, ver la gloria y las partidas, cerrar sesión o borrar la cuenta.
import { JUEGOS, juegoPorId } from "./registro.js";
import { cara } from "./caras.js";
import { dorso } from "./cartas.js";
import { DORSOS, PANOS, CARAS, alcanza, formaDe, gloriaDe, proximo } from "./catalogo.js";
import * as nube from "./nube.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TABS = [["jugar", "Jugar"], ["pulperia", "Pulpería"], ["vos", "Vos"]];

export function montarLobby(app, { abrirJuego, tab: tabInicial = "jugar" }) {
  let tab = tabInicial, aviso = "", cargando = false, partidas = null, confirmarBorrado = false;
  let vivo = true;

  async function toast(txt) { aviso = txt; pintar(); setTimeout(() => { if (aviso === txt) { aviso = ""; if (vivo) pintar(); } }, 3500); }

  function cabecera() {
    const p = nube.miPerfil();
    if (!p) return `<header class="cab"><div class="cab-cara">${cara(0, "invitado")}</div><div class="cab-quien"><b>Invitado</b><small>sin usuario</small></div></header>`;
    return `<header class="cab"><div class="cab-cara">${cara(formaDe(p), "tu cara")}</div>
      <div class="cab-quien"><b>${esc(p.usuario)}</b><small>${gloriaDe(p)} de gloria</small></div></header>`;
  }

  function pantallaJugar() {
    return `<section class="tarjetas">${JUEGOS.map((j) => `
      <button class="tarjeta" data-juego="${j.id}">
        <span class="t-nombre">${esc(j.nombre)}</span>
        <span class="t-desc">${esc(j.descripcion)}</span>
        <span class="t-pie">${j.jugadores[0] === j.jugadores[1] ? `${j.jugadores[0]} jugadores` : `${j.jugadores[0]} a ${j.jugadores[1]} jugadores`}${j.estado === "enlace" ? " · se abre en otra página" : ""}</span>
      </button>`).join("")}
      <div class="tarjeta pronto"><span class="t-nombre">Más juegos</span><span class="t-desc">Cada juego nuevo entra a este mismo link, con tu mismo usuario.</span></div>
    </section>`;
  }

  function item(tipo, k, x, p, puesto) {
    const ok = alcanza(p, x.p);
    const muestra = tipo === "dorso" ? `<div class="mini-dorso">${dorso(k)}</div>` : tipo === "pano" ? `<div class="mini-pano" style="background:radial-gradient(ellipse at 50% 40%, ${x.a}, ${x.b} 75%)"></div>` : "";
    return `<button class="item${puesto ? " puesto" : ""}${ok ? "" : " bloq"}" data-tipo="${tipo}" data-k="${k}" ${ok && p ? "" : "aria-disabled=true"}>
      ${muestra}<span class="i-nombre">${esc(x.nombre)}${x.propio ? ' <em>nuevo</em>' : ""}</span>
      <span class="i-estado">${puesto ? "puesto ✓" : ok ? (p ? "ponerlo" : "disponible") : `con ${x.p} de gloria`}</span></button>`;
  }
  function pantallaPulperia() {
    const p = nube.miPerfil(), e = p?.estilo || {}, g = gloriaDe(p), sig = proximo(g);
    return `<section class="pulperia">
      <p class="medidor"><b>${g}</b> de gloria${sig ? ` · te faltan ${sig.p - g} para ${esc(sig.nombre)}` : " · lo tenés todo"}</p>
      ${p ? "" : `<p class="nota">La gloria se gana jugando al truco. Entrá con tu usuario (pestaña Vos) para ponerte lo que desbloqueaste.</p>`}
      <h2>Tu cara</h2>
      <div class="caras">${CARAS.map((f) => `<button class="cara-op${formaDe(p, 0) === f && (e.cara === f || (!Number.isInteger(e.cara) && f === formaDe(p, 0))) ? " puesto" : ""}" data-tipo="cara" data-k="${f}" ${p ? "" : "aria-disabled=true"} aria-label="Cara ${f + 1}">${cara(f, "cara " + (f + 1))}</button>`).join("")}</div>
      <h2>Dorso de tus cartas</h2>
      <div class="items">${Object.entries(DORSOS).map(([k, x]) => item("dorso", k, x, p, (e.dorso || "clasico") === k && alcanza(p, x.p))).join("")}</div>
      <h2>Paño de tu mesa</h2>
      <div class="items">${Object.entries(PANOS).map(([k, x]) => item("pano", k, x, p, (e.pano || "casa") === k && alcanza(p, x.p))).join("")}</div>
    </section>`;
  }

  function pantallaVos() {
    const p = nube.miPerfil(), u = nube.miUsuario();
    if (!nube.activa()) return `<section class="vos"><p class="nota">Las cuentas todavía no están activadas en esta copia. Podés jugar igual contra el bot y con amigos por link.</p></section>`;
    if (!u) return `<section class="vos">
      <h2>Tu usuario</h2>
      <p class="nota">Entrá con Google para tener tu usuario y ponerte lo que desbloqueaste con la gloria del truco. Es el mismo usuario del truco.</p>
      <button class="boton primario" data-accion="google">Entrar con Google</button>
      ${legal()}</section>`;
    if (!p) return `<section class="vos">
      <h2>Elegí tu usuario</h2>
      <p class="nota">De 3 a 16 letras o números, sin espacios. Es el que ven los demás.</p>
      <input class="campo" id="usuario" maxlength="16" autocomplete="off" aria-label="Usuario">
      <button class="boton primario" data-accion="crear">Crear usuario</button>
      ${legal()}</section>`;
    const prox = proximo(gloriaDe(p));
    return `<section class="vos">
      <div class="perfil-grande"><div class="cab-cara grande">${cara(formaDe(p), "tu cara")}</div>
        <div><b class="p-nombre">${esc(p.usuario)}</b><small>${gloriaDe(p)} de gloria${prox ? ` · próximo: ${esc(prox.nombre)} (${prox.p})` : ""}</small></div></div>
      <p class="nota">El CHIN y la escoba no dan gloria (la gloria es del truco). Las partidas con un amigo quedan en tu historial cuando los dos confirman el resultado.</p>
      <h2>Tus últimas partidas</h2>
      ${partidas === null ? `<p class="nota">Cargando…</p>` : partidas.length ? `<ul class="historial">${partidas.map((x) => `<li class="${x.gano ? "gane" : "perdi"}"><b>${esc(juegoPorId(x.partidas_juego?.juego)?.nombre || x.partidas_juego?.juego || "")}</b> ${x.gano ? "ganaste" : "perdiste"}</li>`).join("")}</ul>` : `<p class="nota">Todavía no jugaste ninguna con un amigo.</p>`}
      <div class="acciones">
        <button class="boton" data-accion="salir">Cerrar sesión</button>
        ${confirmarBorrado ? `<div class="borrar"><p class="nota">Esto borra tu usuario, tu gloria y tu historial, también en el truco. No se puede deshacer. Escribí tu usuario para confirmar:</p><input class="campo" id="confirmar" autocomplete="off" aria-label="Escribí tu usuario"><button class="boton peligro" data-accion="borrar-ok">Borrar mi cuenta</button><button class="boton suave" data-accion="borrar-no">No, volver</button></div>`
          : `<button class="boton suave" data-accion="borrar">Borrar mi cuenta</button>`}
      </div>
      ${legal()}</section>`;
  }
  const legal = () => `<p class="legal"><a href="terminos.html" target="_blank" rel="noopener">Términos</a> · <a href="privacidad.html" target="_blank" rel="noopener">Privacidad</a></p>`;

  function pintar() {
    if (!vivo) return;
    const cuerpo = tab === "jugar" ? pantallaJugar() : tab === "pulperia" ? pantallaPulperia() : pantallaVos();
    app.innerHTML = `<div class="lobby">${cabecera()}<main class="cuerpo" role="tabpanel">${cuerpo}</main>
      ${aviso ? `<p class="toast" role="status">${esc(aviso)}</p>` : ""}
      <nav class="barra" role="tablist">${TABS.map(([k, n]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${n}</button>`).join("")}</nav></div>`;
  }

  app.onclick = async (ev) => {
    const t = ev.target.closest("[data-tab],[data-juego],[data-tipo],[data-accion]");
    if (!t || cargando) return;
    if (t.dataset.tab) {
      tab = t.dataset.tab; confirmarBorrado = false; pintar();
      if (tab === "vos" && nube.miPerfil() && partidas === null) nube.misPartidasJuego().then((x) => { partidas = x; if (tab === "vos") pintar(); }).catch(() => { partidas = []; });
      return;
    }
    if (t.dataset.juego) { abrirJuego(t.dataset.juego); return; }
    const p = nube.miPerfil();
    if (t.dataset.tipo) {
      if (!p) return toast("Entrá con tu usuario para ponerte esto.");
      const tipo = t.dataset.tipo, k = t.dataset.k;
      const x = tipo === "dorso" ? DORSOS[k] : tipo === "pano" ? PANOS[k] : { p: 0 };
      if (!alcanza(p, x.p)) return toast(`Se desbloquea con ${x.p} de gloria.`);
      const estilo = { ...(p.estilo || {}) };
      if (tipo === "cara") estilo.cara = Number(k); else if (tipo === "dorso") { if (k === "clasico") delete estilo.dorso; else estilo.dorso = k; } else if (k === "casa") delete estilo.pano; else estilo.pano = k;
      try { await nube.guardarEstilo(estilo); } catch (e) { toast(e.message || "No se pudo guardar."); }
      return;
    }
    const a = t.dataset.accion;
    try {
      cargando = true;
      if (a === "google") await nube.entrarConGoogle();
      else if (a === "crear") { await nube.crearPerfil(app.querySelector("#usuario").value); partidas = []; }
      else if (a === "salir") { await nube.salir(); partidas = null; }
      else if (a === "borrar") { confirmarBorrado = true; pintar(); }
      else if (a === "borrar-no") { confirmarBorrado = false; pintar(); }
      else if (a === "borrar-ok") {
        if (nube.normalizarUsuario(app.querySelector("#confirmar").value) !== p.usuario) toast("Escribí tu usuario tal cual para confirmar.");
        else { await nube.borrarMiCuenta(); confirmarBorrado = false; partidas = null; toast("Cuenta borrada."); }
      }
    } catch (e) { toast(e.message || "Algo salió mal. Probá de nuevo."); }
    finally { cargando = false; }
  };

  nube.on("sesion", () => pintar());
  pintar();
  return () => { vivo = false; app.onclick = null; };
}
