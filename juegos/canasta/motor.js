// Motor de la CANASTA (2 jugadores, por turnos). Módulo ES sin DOM ni reloj propio: el tiempo entra como dato
// (`ahora`, en ms) y el estado es un objeto plano serializable a JSON. El anfitrión es el árbitro.
//
// Reglas (docs/canasta/reglas.md), las clásicas argentinas: dos mazos franceses y 4 comodines (108 cartas). 15 a cada
// uno; en cada turno se roban 2 del mazo (o se levanta el pozo) y se tira 1. Los 2 y los comodines son libres. Un juego
// es de 3 o más cartas del mismo número, con más naturales que libres y no más de 3 libres; con 7 es canasta (pura sin
// libres: 500; impura: 300). Los 3 rojos van a la mesa apenas se reciben (100 cada uno, 800 los cuatro; restan si el
// jugador no bajó nada). El 3 negro tapa el pozo y solo se baja para cerrar. El pozo se congela si tiene una libre (o un
// 3 rojo) adentro. Primera bajada mínima según el puntaje: 50 / 90 / 120 / 150. Para cerrar hacen falta 2 canastas
// (+100). Lo que queda en la mano resta. Si al empezar un turno no hay mazo, la mano termina sin cierre. Se juega a 5000.

export const PALOS = ["pica", "corazon", "diamante", "trebol"];
export const META = 5000;
export const MANO = 15;
export const CANASTA = 7;

export const MENSAJES = {
  no_es_tu_turno: "Todavía no es tu turno.",
  primero_robar: "Primero robá del mazo o levantá el pozo.",
  ya_robaste: "Ya robaste: ahora bajá o tirá una carta.",
  no_esta: "Esa carta ya no está en tu mano.",
  juego_invalido: "Ese juego no vale: van 3 o más del mismo número, con más naturales que libres y hasta 3 libres.",
  ya_tenes: "Ya tenés bajado ese número: agregale las cartas.",
  no_tenes: "No tenés bajado ese número.",
  minimo: "Para la primera bajada no te alcanza el mínimo.",
  tres_negros: "Los 3 negros solo se bajan para cerrar, y sin libres.",
  no_podes_cerrar: "Para cerrar te faltan las dos canastas.",
  una_sola: "Te quedarías con una sola carta y todavía no podés cerrar.",
  pozo_vacio: "El pozo está vacío.",
  pozo_tapado: "El pozo está tapado: no se puede levantar.",
  pozo_congelado: "El pozo está congelado: para levantarlo necesitás dos naturales iguales a la de arriba.",
  pozo_no_sirve: "Con esas cartas no podés levantar el pozo.",
  no_jugando: "La mano terminó: esperá el recuento.",
  ya_listo: "Ya estás listo: esperando al otro.",
  fin: "La partida terminó.",
};

// ---------- cartas ----------
// id: "<rango>-<palo>-<copia>" (rango 1..13: 1 as, 11 J, 12 Q, 13 K; copia a|b) o "comodin-1".."comodin-4"
const RE = /^(?:([1-9]|1[0-3])-(pica|corazon|diamante|trebol)-[ab]|comodin-[1-4])$/;
export const idValido = (id) => typeof id === "string" && RE.test(id);
export const esComodin = (id) => id.startsWith("comodin");
export const rango = (id) => (esComodin(id) ? 0 : Number(id.split("-")[0]));
export const palo = (id) => (esComodin(id) ? null : id.split("-")[1]);
export const esLibre = (id) => esComodin(id) || rango(id) === 2;
const rojo = (id) => palo(id) === "corazon" || palo(id) === "diamante";
export const esRojo3 = (id) => rango(id) === 3 && rojo(id);
export const esNegro3 = (id) => rango(id) === 3 && !esComodin(id) && !rojo(id);
/** Lo que vale cada carta al contar (bajada o en la mano). */
export const valor = (id) => {
  if (esComodin(id)) return 50;
  const r = rango(id);
  if (r === 1 || r === 2) return 20;
  if (r >= 8) return 10;
  if (r >= 4) return 5;
  return esRojo3(id) ? 100 : 5;
};
export const sumar = (ids) => ids.reduce((s, c) => s + valor(c), 0);
export function mazoCompleto() {
  const ids = [];
  for (const k of ["a", "b"]) for (const p of PALOS) for (let r = 1; r <= 13; r++) ids.push(`${r}-${p}-${k}`);
  for (let k = 1; k <= 4; k++) ids.push(`comodin-${k}`);
  return ids;
}
/** Mínimo de la primera bajada según los puntos que lleva el jugador. */
export const minimo = (p) => (p < 1000 ? 50 : p < 2000 ? 90 : p < 3000 ? 120 : 150);

/** { rango, nat, lib } de un grupo de cartas, o null si mezcla números o no tiene naturales. */
export function analizar(cartas) {
  const nat = cartas.filter((c) => !esLibre(c));
  if (!nat.length) return null;
  const r = rango(nat[0]);
  if (nat.some((c) => rango(c) !== r) || nat.some(esRojo3)) return null;
  return { rango: r, nat: nat.length, lib: cartas.length - nat.length };
}
/** Un juego (bajado o por bajar) es válido con estas cartas. */
export function juegoValido(cartas) {
  const a = analizar(cartas);
  if (!a || cartas.length < 3 || a.nat <= a.lib || a.lib > 3) return false;
  return a.rango !== 3 || a.lib === 0;
}
export const esCanasta = (g) => g.cartas.length >= CANASTA;
export const esPura = (g) => esCanasta(g) && !g.cartas.some(esLibre);
export const canastas = (juegos) => juegos.filter(esCanasta).length;
export const congelado = (pozo) => pozo.some((c) => esLibre(c) || esRojo3(c));
export const pozoTapado = (pozo) => !pozo.length || esLibre(pozo[pozo.length - 1]) || esNegro3(pozo[pozo.length - 1]);

// ---------- azar con semilla (mulberry32) ----------
function azar(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function mezclar(s, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(azar(s) * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}
const copiar = (e) => JSON.parse(JSON.stringify(e));

// ---------- partida ----------
/**
 * @param {{ nombres?: string[], semilla?: number, ahora?: number, meta?: number, reparte?: 0|1, pausaRecuento?: number, mazo?: string[] }} o
 * `mazo` (solo pruebas): el orden exacto del mazo de la primera mano (se reparte desde el principio).
 */
export function nuevaPartida({ nombres = ["Vos", "Rival"], semilla, ahora = 0, meta = META, reparte, pausaRecuento = 30000, mazo } = {}) {
  const s = {
    juego: "canasta",
    nombres: [...nombres],
    rng: (Number.isFinite(semilla) ? semilla : Math.floor(Math.random() * 2 ** 31)) >>> 0,
    meta, pausaRecuento,
    puntos: [0, 0],
    manoN: 0, reparte: 0,
    fase: "robar", ganador: null,
    mazo: [], pozo: [], mano: [[], []], juegos: [[], []], rojos: [[], []], bajo: [false, false],
    turno: 0, turnoDesde: ahora, accionDesde: ahora, robadas: [],
    recuento: null, listos: [false, false], recuentoHasta: null,
    historial: [], ultimo: null, seq: 0, mazoFijo: mazo ? [...mazo] : null,
  };
  s.reparte = reparte === 0 || reparte === 1 ? reparte : (azar(s) < 0.5 ? 0 : 1);
  const ev = [];
  empezarMano(s, ahora, ev, true);
  s.eventosIniciales = ev;
  return s;
}

/** Saca del mazo para `j`; los 3 rojos van a la mesa y se reponen. Devuelve las que entraron a la mano. */
function sacar(s, j, n, ev) {
  const nuevas = [];
  while (n > 0 && s.mazo.length) {
    const c = s.mazo.shift();
    if (esRojo3(c)) { s.rojos[j].push(c); ev.push({ t: "rojo", jugador: j, carta: c }); continue; }
    s.mano[j].push(c); nuevas.push(c); n--;
  }
  return nuevas;
}

function empezarMano(s, ahora, ev, primera = false) {
  if (!primera) s.reparte = 1 - s.reparte;
  s.manoN++;
  s.mazo = s.mazoFijo && s.manoN === 1 ? [...s.mazoFijo] : mezclar(s, mazoCompleto());
  s.pozo = []; s.mano = [[], []]; s.juegos = [[], []]; s.rojos = [[], []]; s.bajo = [false, false];
  s.recuento = null; s.listos = [false, false]; s.recuentoHasta = null; s.robadas = [];
  const ev2 = [];
  const mano = 1 - s.reparte;
  for (let k = 0; k < MANO; k++) for (const j of [mano, s.reparte]) s.mano[j].push(s.mazo.shift());
  // los 3 rojos de la mano van a la mesa y se reponen
  for (const j of [mano, s.reparte]) {
    const rojos = s.mano[j].filter(esRojo3);
    s.mano[j] = s.mano[j].filter((c) => !esRojo3(c));
    s.rojos[j].push(...rojos);
    sacar(s, j, rojos.length, ev2);
  }
  // el pozo arranca con una carta; si es libre o 3 rojo se da vuelta otra encima (y queda congelado)
  do s.pozo.push(s.mazo.shift()); while (s.mazo.length && (esLibre(s.pozo.at(-1)) || esRojo3(s.pozo.at(-1))));
  s.turno = mano; s.fase = "robar"; s.turnoDesde = ahora; s.accionDesde = ahora;
  ev.push({ t: "reparto", mano: s.manoN, reparte: s.reparte, rojos: [[...s.rojos[0]], [...s.rojos[1]]], pozo: [...s.pozo] });
}

/** Lo que suma cada uno en la mano que terminó. `cerro`: quién cerró (o null si se acabó el mazo). */
export function contarMano(s, cerro) {
  return [0, 1].map((j) => {
    const js = s.juegos[j];
    const cartas = js.reduce((t, g) => t + sumar(g.cartas), 0);
    const puras = js.filter(esPura).length, impuras = canastas(js) - puras;
    const nR = s.rojos[j].length;
    let rojos = nR === 4 ? 800 : nR * 100;
    if (!js.length) rojos = -rojos;
    const cierre = cerro === j ? 100 : 0;
    const mano = -sumar(s.mano[j]);
    const total = cartas + puras * 500 + impuras * 300 + rojos + cierre + mano;
    return { cartas, puras, impuras, rojos, nRojos: nR, cierre, mano, total };
  });
}

function cerrarMano(s, ahora, ev, cerro) {
  const r = contarMano(s, cerro);
  const antes = [...s.puntos];
  s.puntos = [s.puntos[0] + r[0].total, s.puntos[1] + r[1].total];
  s.recuento = { jugadores: r, cerro, antes, despues: [...s.puntos], mano: s.manoN };
  s.historial.push({ mano: s.manoN, total: [r[0].total, r[1].total], puntos: [...s.puntos], cerro });
  ev.push({ t: "recuento", recuento: copiar(s.recuento) });
  const [a, b] = s.puntos;
  if ((a >= s.meta || b >= s.meta) && a !== b) {
    s.fase = "fin";
    s.ganador = a > b ? 0 : 1;
    ev.push({ t: "fin", ganador: s.ganador });
  } else {
    s.fase = "recuento";
    s.listos = [false, false];
    s.recuentoHasta = ahora + s.pausaRecuento;
    s.turnoDesde = ahora;
  }
}

const rechazo = (estado, motivo) => ({ estado, eventos: [], rechazo: { motivo, mensaje: MENSAJES[motivo] } });

/** Saca `ids` de la mano (sin repetir). Devuelve la mano nueva o null si alguna no está. */
function sinCartas(mano, ids) {
  const resto = [...mano];
  for (const c of ids) {
    const k = resto.indexOf(c);
    if (k < 0) return null;
    resto.splice(k, 1);
  }
  return resto;
}
const listaDeIds = (a, max = 30) => Array.isArray(a) && a.length <= max && a.every(idValido);
function juegosBienFormados(js) {
  if (js === undefined) return true;
  return Array.isArray(js) && js.length <= 8 && js.every((g) => listaDeIds(g));
}

/**
 * Valida juegos nuevos de la mano: cada uno válido, sin número repetido ni ya bajado.
 * Devuelve el motivo del rechazo o null. Marca en `info.negros` si hay un juego de 3 negros.
 */
function validarNuevos(s, j, juegos, info) {
  const vistos = new Set(s.juegos[j].map((g) => g.rango));
  for (const g of juegos) {
    if (!juegoValido(g)) return analizar(g)?.rango === 3 ? "tres_negros" : "juego_invalido";
    const r = analizar(g).rango;
    if (vistos.has(r)) return "ya_tenes";
    vistos.add(r);
    if (r === 3) info.negros = true;
  }
  return null;
}

/** Después de bajar o agregar: si se quedó sin cartas cierra; si no puede cerrar, no puede quedar con 0 o 1. */
function revisarMano(s, j, info) {
  const n = s.mano[j].length, puede = canastas(s.juegos[j]) >= 2;
  if (info.negros && (!puede || n > 1)) return "tres_negros";
  if (n === 0 && !puede) return "no_podes_cerrar";
  if (n === 1 && !puede) return "una_sola";
  return null;
}
function marcarCanastas(s, j, antes, ev) {
  for (const g of s.juegos[j]) if (esCanasta(g) && !antes.has(g.rango)) ev.push({ t: "canasta", jugador: j, rango: g.rango, pura: esPura(g) });
}
const yaCanastas = (s, j) => new Set(s.juegos[j].filter(esCanasta).map((g) => g.rango));
function pasarTurno(s, j, ahora) {
  s.turno = 1 - j; s.fase = "robar"; s.turnoDesde = ahora; s.accionDesde = ahora; s.robadas = [];
}

/**
 * Acciones:
 *  { t: "robar" }                                   (2 del mazo; sin mazo, la mano termina)
 *  { t: "pozo", con: [2 ids de la mano], juegos?: [[ids], …] }   (la de arriba con dos de la mano; `juegos`: más juegos
 *                                                    nuevos para llegar al mínimo de la primera bajada)
 *  { t: "pozo", a: rango }                          (la de arriba a un juego propio; solo con el pozo sin congelar)
 *  { t: "bajar", juegos: [[ids], …] }               (juegos nuevos; la primera vez tienen que sumar el mínimo)
 *  { t: "agregar", rango, cartas: [ids] }           (a un juego propio ya bajado)
 *  { t: "tirar", carta }                            (termina el turno; si era la última, cierra)
 *  { t: "seguir" }                                  (en el recuento)
 */
export function aplicar(estado, jugador, accion, ahora = 0) {
  if (jugador !== 0 && jugador !== 1) throw new Error("jugador inválido");
  if (!accion || typeof accion !== "object") throw new Error("acción inválida");
  if (estado.fase === "fin") return rechazo(estado, "fin");
  const s = copiar(estado);
  delete s.eventosIniciales;
  const ev = [], j = jugador;

  if (accion.t === "seguir") {
    if (s.fase !== "recuento") return rechazo(estado, "no_jugando");
    if (s.listos[j]) return rechazo(estado, "ya_listo");
    s.listos[j] = true;
    ev.push({ t: "listo", jugador: j });
    if (s.listos[0] && s.listos[1]) empezarMano(s, ahora, ev);
    s.seq++;
    return { estado: s, eventos: ev };
  }

  // forma de cada acción (lo mal formado tira Error)
  switch (accion.t) {
    case "robar": break;
    case "pozo":
      if (accion.a !== undefined) { if (!Number.isInteger(accion.a) || accion.a < 1 || accion.a > 13) throw new Error("pozo mal formado"); }
      else if (!listaDeIds(accion.con, 2) || accion.con.length !== 2 || !juegosBienFormados(accion.juegos)) throw new Error("pozo mal formado");
      break;
    case "bajar": if (!juegosBienFormados(accion.juegos) || !accion.juegos.length) throw new Error("bajada mal formada"); break;
    case "agregar": if (!Number.isInteger(accion.rango) || !listaDeIds(accion.cartas) || !accion.cartas.length) throw new Error("agregar mal formado"); break;
    case "tirar": if (!idValido(accion.carta)) throw new Error("tirar mal formado"); break;
    default: throw new Error("acción desconocida");
  }
  const todas = [...(accion.con || []), ...(accion.juegos || []).flat(), ...(accion.cartas || [])];
  if (new Set(todas).size !== todas.length) throw new Error("carta repetida");

  if (s.fase !== "robar" && s.fase !== "jugar") return rechazo(estado, "no_jugando");
  if (s.turno !== j) return rechazo(estado, "no_es_tu_turno");
  const enRobar = s.fase === "robar";
  if ((accion.t === "robar" || accion.t === "pozo") && !enRobar) return rechazo(estado, "ya_robaste");
  if (accion.t !== "robar" && accion.t !== "pozo" && enRobar) return rechazo(estado, "primero_robar");

  if (accion.t === "robar") {
    if (!s.mazo.length) {
      ev.push({ t: "mazo_vacio" });
      cerrarMano(s, ahora, ev, null);
      s.seq++;
      return { estado: s, eventos: ev };
    }
    s.robadas = sacar(s, j, 2, ev);
    ev.push({ t: "robo", jugador: j, n: s.robadas.length, quedan: s.mazo.length });
    if (!s.mazo.length && s.mano[j].length < 2 && canastas(s.juegos[j]) < 2) {
      // el mazo se terminó en 3 rojos y quedó con una carta sin poder cerrar: la mano termina
      ev.push({ t: "mazo_vacio" });
      cerrarMano(s, ahora, ev, null);
      s.seq++;
      return { estado: s, eventos: ev };
    }
    s.ultimo = { jugador: j, t: "robar" };
    s.fase = "jugar"; s.accionDesde = ahora;
    s.seq++;
    return { estado: s, eventos: ev };
  }

  if (accion.t === "pozo") {
    if (!s.pozo.length) return rechazo(estado, "pozo_vacio");
    if (pozoTapado(s.pozo)) return rechazo(estado, "pozo_tapado");
    const tope = s.pozo.at(-1), r = rango(tope), frio = congelado(s.pozo);
    const antes = yaCanastas(s, j), info = {};
    let usadas = [], bajadas = [];
    if (accion.a !== undefined) {
      if (frio) return rechazo(estado, "pozo_congelado");
      const g = s.juegos[j].find((x) => x.rango === accion.a);
      if (!g || accion.a !== r) return rechazo(estado, g ? "pozo_no_sirve" : "no_tenes");
      g.cartas.push(tope);
      if (!juegoValido(g.cartas)) return rechazo(estado, "pozo_no_sirve");
    } else {
      const con = accion.con;
      if (con.some((c) => !s.mano[j].includes(c))) return rechazo(estado, "no_esta");
      if (frio && con.some((c) => esLibre(c) || rango(c) !== r)) return rechazo(estado, "pozo_congelado");
      if (!con.some((c) => !esLibre(c) && rango(c) === r)) return rechazo(estado, "pozo_no_sirve");
      const g = s.juegos[j].find((x) => x.rango === r);
      const cartas = [...(g ? g.cartas : []), tope, ...con];
      if (!juegoValido(cartas)) return rechazo(estado, "pozo_no_sirve");
      const nuevos = accion.juegos || [];
      const m = validarNuevos(s, j, nuevos, info);
      if (m) return rechazo(estado, m);
      if (nuevos.some((x) => analizar(x).rango === r)) return rechazo(estado, "ya_tenes");
      if (!s.bajo[j] && sumar([tope, ...con, ...nuevos.flat()]) < minimo(s.puntos[j])) return rechazo(estado, "minimo");
      const resto = sinCartas(s.mano[j], [...con, ...nuevos.flat()]);
      if (!resto) return rechazo(estado, "no_esta");
      s.mano[j] = resto;
      if (g) g.cartas.push(tope, ...con); else s.juegos[j].push({ rango: r, cartas: [tope, ...con] });
      for (const x of nuevos) s.juegos[j].push({ rango: analizar(x).rango, cartas: [...x] });
      usadas = con; bajadas = nuevos;
    }
    // el resto del pozo va a la mano (un 3 rojo que hubiera adentro, a la mesa)
    const resto = s.pozo.slice(0, -1);
    s.pozo = [];
    const aMano = resto.filter((c) => !esRojo3(c));
    for (const c of resto) if (esRojo3(c)) { s.rojos[j].push(c); ev.push({ t: "rojo", jugador: j, carta: c }); }
    s.mano[j].push(...aMano);
    s.robadas = aMano;
    s.bajo[j] = true;
    const m = revisarMano(s, j, info);
    if (m) return rechazo(estado, m);
    ev.push({ t: "pozo", jugador: j, tope, n: resto.length + 1, con: [...usadas], juegos: bajadas.map((x) => [...x]), a: accion.a ?? null });
    marcarCanastas(s, j, antes, ev);
    s.ultimo = { jugador: j, t: "pozo", tope, n: resto.length + 1 };
    s.fase = "jugar"; s.accionDesde = ahora;
    if (!s.mano[j].length) { ev.push({ t: "cierre", jugador: j }); cerrarMano(s, ahora, ev, j); }
    s.seq++;
    return { estado: s, eventos: ev };
  }

  if (accion.t === "bajar") {
    const info = {}, antes = yaCanastas(s, j);
    const m = validarNuevos(s, j, accion.juegos, info);
    if (m) return rechazo(estado, m);
    if (!s.bajo[j] && sumar(accion.juegos.flat()) < minimo(s.puntos[j])) return rechazo(estado, "minimo");
    const resto = sinCartas(s.mano[j], accion.juegos.flat());
    if (!resto) return rechazo(estado, "no_esta");
    s.mano[j] = resto;
    for (const g of accion.juegos) s.juegos[j].push({ rango: analizar(g).rango, cartas: [...g] });
    const m2 = revisarMano(s, j, info);
    if (m2) return rechazo(estado, m2);
    s.bajo[j] = true;
    ev.push({ t: "bajar", jugador: j, juegos: accion.juegos.map((g) => [...g]) });
    marcarCanastas(s, j, antes, ev);
    s.ultimo = { jugador: j, t: "bajar" };
    s.accionDesde = ahora;
    if (!s.mano[j].length) { ev.push({ t: "cierre", jugador: j }); cerrarMano(s, ahora, ev, j); }
    s.seq++;
    return { estado: s, eventos: ev };
  }

  if (accion.t === "agregar") {
    const g = s.juegos[j].find((x) => x.rango === accion.rango);
    if (!g) return rechazo(estado, "no_tenes");
    const resto = sinCartas(s.mano[j], accion.cartas);
    if (!resto) return rechazo(estado, "no_esta");
    if (!juegoValido([...g.cartas, ...accion.cartas])) return rechazo(estado, "juego_invalido");
    const antes = yaCanastas(s, j);
    s.mano[j] = resto;
    g.cartas.push(...accion.cartas);
    const m = revisarMano(s, j, {});
    if (m) return rechazo(estado, m);
    ev.push({ t: "agregar", jugador: j, rango: g.rango, cartas: [...accion.cartas] });
    marcarCanastas(s, j, antes, ev);
    s.ultimo = { jugador: j, t: "agregar" };
    s.accionDesde = ahora;
    if (!s.mano[j].length) { ev.push({ t: "cierre", jugador: j }); cerrarMano(s, ahora, ev, j); }
    s.seq++;
    return { estado: s, eventos: ev };
  }

  // tirar
  const k = s.mano[j].indexOf(accion.carta);
  if (k < 0) return rechazo(estado, "no_esta");
  if (s.mano[j].length === 1 && canastas(s.juegos[j]) < 2) return rechazo(estado, "no_podes_cerrar");
  s.mano[j].splice(k, 1);
  s.pozo.push(accion.carta);
  ev.push({ t: "tirar", jugador: j, carta: accion.carta, congela: esLibre(accion.carta) });
  s.ultimo = { jugador: j, t: "tirar", carta: accion.carta };
  if (!s.mano[j].length) { ev.push({ t: "cierre", jugador: j }); cerrarMano(s, ahora, ev, j); }
  else pasarTurno(s, j, ahora);
  s.seq++;
  return { estado: s, eventos: ev };
}

/** Cierra el recuento si nadie tocó «Seguir» a tiempo. */
export function reloj(estado, ahora) {
  if (estado.fase !== "recuento" || estado.recuentoHasta === null || ahora < estado.recuentoHasta) return { estado, eventos: [] };
  const s = copiar(estado);
  delete s.eventosIniciales;
  const ev = [];
  empezarMano(s, ahora, ev);
  s.seq++;
  return { estado: s, eventos: ev };
}

/**
 * Un resumen de lo que puede hacer `jugador` (no es la lista completa: bajar admite muchísimas combinaciones).
 * Robar, levantar el pozo con dos naturales o con un juego propio, agregar naturales sueltas y tirar cada carta.
 */
export function acciones(estado, jugador) {
  if (estado.fase === "recuento") return estado.listos[jugador] ? [] : [{ t: "seguir" }];
  if (estado.turno !== jugador || (estado.fase !== "robar" && estado.fase !== "jugar")) return [];
  const mano = estado.mano[jugador], out = [];
  if (estado.fase === "robar") {
    out.push({ t: "robar" });
    if (!pozoTapado(estado.pozo)) {
      const r = rango(estado.pozo.at(-1));
      const nat = mano.filter((c) => !esLibre(c) && rango(c) === r);
      if (nat.length >= 2) out.push({ t: "pozo", con: nat.slice(0, 2) });
      if (!congelado(estado.pozo) && estado.juegos[jugador].some((g) => g.rango === r)) out.push({ t: "pozo", a: r });
    }
    return out;
  }
  for (const g of estado.juegos[jugador]) for (const c of mano) if (!esLibre(c) && rango(c) === g.rango) out.push({ t: "agregar", rango: g.rango, cartas: [c] });
  for (const c of mano) out.push({ t: "tirar", carta: c });
  return out;
}

/** Lo que ve `jugador`: sin la mano del rival ni el mazo. El pozo: la de arriba y cuántas hay. */
export function vista(estado, jugador) {
  const pozo = estado.pozo;
  return {
    juego: "canasta", yo: jugador, nombres: [...estado.nombres],
    fase: estado.fase, ganador: estado.ganador, meta: estado.meta,
    puntos: [...estado.puntos], minimos: estado.puntos.map(minimo), bajo: [...estado.bajo],
    manoN: estado.manoN, reparte: estado.reparte,
    turno: estado.turno, turnoDesde: estado.turnoDesde, accionDesde: estado.accionDesde,
    mano: [...estado.mano[jugador]],
    robadas: estado.turno === jugador ? [...estado.robadas] : [],
    enMano: [estado.mano[0].length, estado.mano[1].length],
    mazo: estado.mazo.length,
    pozo: { tope: pozo.length ? pozo.at(-1) : null, n: pozo.length, congelado: congelado(pozo), tapado: pozoTapado(pozo),
      libres: pozo.filter((c) => esLibre(c) || esRojo3(c)).slice(0, 4) },
    juegos: [0, 1].map((k) => estado.juegos[k].map((g) => ({ rango: g.rango, cartas: [...g.cartas] }))),
    rojos: [[...estado.rojos[0]], [...estado.rojos[1]]],
    recuento: estado.recuento ? copiar(estado.recuento) : null,
    listos: [...estado.listos], recuentoHasta: estado.recuentoHasta,
    historial: copiar(estado.historial),
    ultimo: estado.ultimo ? copiar(estado.ultimo) : null,
    seq: estado.seq,
  };
}

export const juego = {
  id: "canasta", nombre: "Canasta", jugadores: [2, 2],
  nuevaPartida, aplicar, vista, acciones, reloj,
};
