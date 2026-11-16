// Desafío del día de CHIN (2026-11-16): el mismo reparto para todos contra Rata (bot rápido) y una tabla del más
// rápido en ganar. Jugarlo es libre; la tabla pide cuenta y cuenta solo el primer intento del día.
// El reparto sale de la fecha de Argentina: misma fecha = misma semilla = mismos mazos (y el bot decide igual).
import * as nube from "../../nucleo/nube.js";

export const BOT_DESAFIO = "rapido";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Fecha de hoy en Argentina, "AAAA-MM-DD". */
export function diaDeHoy(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}
/** Semilla del reparto de un día (FNV-1a de "chin-AAAA-MM-DD"). */
export function semillaDe(dia) {
  let h = 2166136261;
  for (const c of `chin-${dia}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** 146 300 ms → 2'26"3 */
export const tiempo = (ms) => { const d = Math.max(0, Math.round(ms / 100)); const s = Math.floor(d / 10); return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"${d % 10}`; };
export const fechaLinda = (dia) => { const [, m, d] = dia.split("-").map(Number); return `${d}/${m}`; };

export function tablaHTML(filas, yo) {
  if (!filas?.length) return `<p class="tabla-vacia">Todavía nadie le ganó a Rata hoy. ¿Sos el primero?</p>`;
  return `<ol class="tabla-dia">${filas.slice(0, 10).map((f, i) => `<li class="${yo && f.usuario === yo ? "yo" : ""}"><span class="puesto">${i + 1}</span><span class="quien">${esc(f.usuario)}</span><b>${tiempo(f.ms)}</b></li>`).join("")}</ol>`;
}

/** Al empezar: con cuenta anota el intento. "anota" | "ya" (ya jugó hoy) | "libre" (sin cuenta) | "error". */
export async function empezar(dia) {
  if (!nube.miPerfil()) return "libre";
  try { return (await nube.empezarDesafio(dia)) === "ok" ? "anota" : "ya"; } catch { return "error"; }
}

/** Lo que se ve en la pizarra del final de la partida del desafío. */
export async function pie(el, { ms, gane }, modo, dia) {
  const yo = nube.miPerfil()?.usuario;
  const cab = (txt) => `<p class="desafio-msj">${txt}</p>`;
  el.className = "fin-extra desafio-pie";
  el.innerHTML = cab("Desafío del día…");
  let msj = "";
  if (modo === "anota") {
    try {
      const puesto = await nube.terminarDesafio(dia, ms, gane);
      msj = gane ? `Entraste a la tabla${puesto ? `: puesto <b>${puesto}</b>` : ""} con <b>${tiempo(ms)}</b>.` : "Hoy no entraste a la tabla. Mañana hay otro reparto.";
    } catch { msj = "No pude anotar tu tiempo en la tabla."; }
  } else if (modo === "ya") msj = "Ya jugaste el desafío de hoy: este fue de práctica.";
  else if (modo === "libre") msj = gane ? `Lo ganaste en <b>${tiempo(ms)}</b>. Entrá con tu cuenta para anotarte en la tabla.` : "Entrá con tu cuenta para anotarte en la tabla.";
  else msj = "No pude conectar con la tabla del día.";
  let filas = null;
  try { filas = await nube.tablaDesafio(dia); } catch { /* sin tabla */ }
  el.innerHTML = cab(msj) + (filas ? `<p class="desafio-tit">Tabla del ${fechaLinda(dia)}</p>${tablaHTML(filas, yo)}` : "");
}
