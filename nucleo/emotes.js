// Reacciones rápidas de la plataforma (copiadas de truco/juego/js/emotes.js y generalizadas).
// Por la red viaja solo la clave ({ t: "emote", k }), nunca texto libre: no hay nada que moderar.
// El que recibe valida la clave y pone tope.
export const LISTA = [
  { k: "risa", txt: "¡Jajaja!" },
  { k: "suerte", txt: "¡Qué suerte!" },
  { k: "bien", txt: "¡Bien jugado!" },
  { k: "uy", txt: "¡Uy, uy, uy!" },
  { k: "rapido", txt: "¡Qué rápido!" },
  { k: "mate", txt: "¿Un mate?" },
  { k: "dale", txt: "Dale, que se enfría" },
  { k: "revancha", txt: "¡Revancha!" },
];
const POR_K = Object.fromEntries(LISTA.map((e) => [e.k, e]));
// contra el bot, a veces contesta
const RESPUESTA = { risa: ["risa"], suerte: ["bien", "risa"], bien: ["bien"], uy: ["risa"], rapido: ["risa", "suerte"], mate: ["mate"], dale: ["dale", "risa"], revancha: ["risa"] };

export const valido = (k) => typeof k === "string" && Object.hasOwn(POR_K, k);
export const textoDe = (k) => POR_K[k]?.txt || "";
export const respuestaBot = (k) => { const r = RESPUESTA[k]; return r && Math.random() < 0.4 ? r[Math.floor(Math.random() * r.length)] : null; };

const CLAVE_MUDO = "plataforma.emotes.mudo";
export function mudo() { try { return localStorage.getItem(CLAVE_MUDO) === "1"; } catch { return false; } }
export function ponerMudo(v) { try { localStorage.setItem(CLAVE_MUDO, v ? "1" : "0"); } catch { /* ok */ } }

/** Tope: una por jugador cada 1,5 s (lo usan el que manda y el anfitrión que reenvía). */
export function tope(ms = 1500) {
  const ult = new Map();
  return (quien) => { const t = Date.now(); if (t - (ult.get(quien) || 0) < ms) return false; ult.set(quien, t); return true; };
}
