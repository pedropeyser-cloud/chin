// Mazo francés de la canasta, «naipe de almacén» (variante C «Etiqueta» de htmls/naipe-direcciones.html, elegida por Pedro).
// Módulo sin DOM: solo devuelve strings SVG. El dorso NO se dibuja acá: el juego usa dorso() de ./cartas.js.
// Ids: `${rango}-${palo}-${copia}` (rango 1..13, 1 = as, 11 J, 12 Q, 13 K; copia "a" | "b") y "comodin-1".."comodin-4".
import { dorso, sol } from "./cartas.js";

export const PALOS_FR = ["pica", "corazon", "diamante", "trebol"];
export const esRojo = palo => palo === "corazon" || palo === "diamante";

const NOMBRE_PALO = { pica: "pica", corazon: "corazón", diamante: "diamante", trebol: "trébol" };
const NOMBRE_RANGO = { 1: "as", 11: "jota", 12: "reina", 13: "rey" };

const RE_CARTA = /^(1[0-3]|[1-9])-(pica|corazon|diamante|trebol)(?:-(a|b))?$/;
const RE_COMODIN = /^comodin(?:-([1-4]))?$/;

/** { rango: 1..13 | 0 (comodín), palo: string | null, copia } o null si el id no es válido. Sin copia, copia = null. */
export function partes(id) {
  if (typeof id !== "string") return null;
  let m = RE_CARTA.exec(id);
  if (m) return { rango: +m[1], palo: m[2], copia: m[3] || null };
  m = RE_COMODIN.exec(id);
  if (m) return { rango: 0, palo: null, copia: m[1] || null };
  return null;
}
export const idValido = id => partes(id) !== null;

export const nombreCarta = id => {
  const p = partes(id);
  if (!p) return "";
  if (p.rango === 0) return "comodín";
  return `${NOMBRE_RANGO[p.rango] || p.rango} de ${NOMBRE_PALO[p.palo]}`;
};

export const MAZO_FR = (() => {
  const ids = [];
  for (const copia of ["a", "b"]) for (const p of PALOS_FR) for (let n = 1; n <= 13; n++) ids.push(`${n}-${p}-${copia}`);
  for (let k = 1; k <= 4; k++) ids.push(`comodin-${k}`);
  return ids;
})();

// ───────────────────────── paleta y palos ─────────────────────────
const W = 600, H = 860;
const K = { papel: "#ebe4d4", tinta: "#14171c", brasa: "#b4501a", ambar: "#f0a93b", ambarP: "#b8621b", ovalo: "#e2d6bd", rayo: "#d4c6a6", acero: "#9aa0a8" };

// palos franceses en una caja de 100 centrada en 0
const PALO = {
  pica: "M0,-46 C-8,-32 -46,-12 -46,10 C-46,27 -33,35 -21,35 C-12,35 -6,30 -3,24 Q-4,38 -15,46 L15,46 Q4,38 3,24 C6,30 12,35 21,35 C33,35 46,27 46,10 C46,-12 8,-32 0,-46 Z",
  corazon: "M0,40 C-12,28 -46,6 -46,-16 C-46,-34 -33,-44 -19,-44 C-9,-44 -3,-38 0,-30 C3,-38 9,-44 19,-44 C33,-44 46,-34 46,-16 C46,6 12,28 0,40 Z",
  diamante: "M0,-46 Q13,-21 34,0 Q13,21 0,46 Q-13,21 -34,0 Q-13,-21 0,-46 Z",
  trebol: "M-19,-24 a19,19 0 1,0 38,0 a19,19 0 1,0 -38,0 Z M-40,8 a19,19 0 1,0 38,0 a19,19 0 1,0 -38,0 Z M2,8 a19,19 0 1,0 38,0 a19,19 0 1,0 -38,0 Z |M-10,-10 L10,-10 L10,14 L-10,14 Z|M-3,10 Q-4,36 -15,46 L15,46 Q4,36 3,10 Z"
};
const colorDe = p => esRojo(p) ? K.brasa : K.tinta;
const palo = (p, c) => PALO[p].split("|").map(d => `<path d="${d}" fill="${c}"/>`).join("");

const circ = (x, y, r) => `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
const elip = (x, y, rx, ry) => `M${x - rx},${y} a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 ${-2 * rx},0 Z`;
const flor = (x, y, r) => { let d = ""; for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5 - Math.PI / 2; d += circ(+(x + Math.cos(a) * r * 1.15).toFixed(1), +(y + Math.sin(a) * r * 1.15).toFixed(1), +(r * .8).toFixed(1)); } return d; };
const f1 = n => +n.toFixed(1);
// punto sobre un arco de centro (cx,cy), radio r, ángulo en grados (0 = derecha, 90 = abajo)
const arco = (cx, cy, r, g) => [f1(cx + r * Math.cos(g * Math.PI / 180)), f1(cy + r * Math.sin(g * Math.PI / 180))];

// ───────────────────────── cómo se pinta cada rol ─────────────────────────
// [relleno, trazo, multiplicador del grosor]
const ROL = {
  piel: [K.papel, K.tinta, 1], pelo: [K.tinta, K.tinta, 1], acento: [K.ambar, K.tinta, 1], ropa: [K.brasa, K.tinta, 1],
  detalle: ["none", K.papel, 1], linea: ["none", K.tinta, 1], punto: [K.tinta, "none", 1], ojo: [K.ambar, K.tinta, 1],
  cola: ["none", K.tinta, 3.1],
  brasa: [K.brasa, K.tinta, 1], madera: [K.ambarP, K.tinta, 1], papelf: [K.papel, K.tinta, 1], hierro: [K.acero, K.tinta, 1], tintaf: [K.tinta, K.tinta, 1],
  fino: ["none", K.tinta, .5], finoP: ["none", K.papel, .5], finoA: ["none", K.ambar, .6], grueso: ["none", K.tinta, 1.7], gruesoB: ["none", K.brasa, 1.7], gruesoM: ["none", K.ambarP, 1.7],
  ambarlin: ["none", K.ambar, 1], fondo: [K.ovalo, "none", 1]
};
function pintar(lista, sw) {
  return lista.map(([d, rol]) => {
    const [f, s, m] = ROL[rol];
    return `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="${f1(sw * m)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join("");
}

// ───────────────────────── personajes (los mismos en los 4 palos) ─────────────────────────
// Caja de dibujo: origen en el pecho, cabeza arriba (y negativo). Se ven de y = -263 a y = 104.
const rombos = (y, r, desde, hasta, paso) => { let d = ""; for (let x = desde; x <= hasta; x += paso) if (Math.abs(x) > 50) d += `M${x - r},${y} L${x},${y - r} L${x + r},${y} L${x},${y + r} Z`; return d; };
const botones = (x, y0, n, sep) => { let d = ""; for (let k = 0; k < n; k++) d += circ(x, y0 + k * sep, 3.4); return d; };

const PJ = {
  gaucho: [
    ["M-150,120 Q-140,0 -44,-22 L44,-22 Q140,0 150,120 Z", "ropa"],
    // pliegues del poncho
    ["M-108,6 Q-100,50 -108,112 M108,6 Q100,50 108,112 M-70,-4 Q-64,50 -70,114 M70,-4 Q64,50 70,114", "fino"],
    // guarda del poncho: dos listas y una hilera de rombos
    ["M-140,12 Q0,-4 140,12 M-148,58 Q0,40 148,58", "detalle"],
    [rombos(34, 9, -126, 126, 21), "acento"],
    ["M-20,-40 L-20,-14 L20,-14 L20,-40 Z", "piel"],
    ["M-46,-24 L46,-24 L0,34 Z", "acento"], [circ(0, -20, 10), "acento"],
    ["M-14,-4 L0,22 L14,-4", "fino"],
    ["M-48,-96 q-16,2 -11,22 q4,12 13,8 Z M48,-96 q16,2 11,22 q-4,12 -13,8 Z", "piel"],
    [elip(0, -88, 46, 58), "piel"],
    // barbijo (tiento del sombrero)
    ["M-52,-120 Q-58,-60 -30,-34 M52,-120 Q58,-60 30,-34", "fino"],
    ["M-58,-142 L-50,-196 Q0,-210 50,-196 L58,-142 Z", "pelo"],
    ["M-40,-186 Q0,-196 40,-186", "finoP"],
    ["M-57,-150 L57,-150 L56,-164 L-56,-164 Z", "acento"],
    ["M-40,-150 L-40,-164 M-20,-150 L-20,-164 M0,-150 L0,-164 M20,-150 L20,-164 M40,-150 L40,-164", "fino"],
    ["M-128,-140 Q0,-172 128,-140 Q0,-118 -128,-140 Z", "pelo"],
    ["M-100,-140 Q0,-160 100,-140", "finoP"],
    ["M-30,-108 L-10,-104 M10,-104 L30,-108", "linea"],
    [circ(-19, -93, 5.5) + circ(19, -93, 5.5), "punto"],
    ["M0,-96 L-7,-72 L5,-70", "linea"],
    ["M-30,-62 Q-16,-70 -4,-62 M30,-62 Q16,-70 4,-62", "fino"],
    ["M-32,-56 Q-16,-70 0,-60 Q16,-70 32,-56 Q30,-48 22,-50 Q10,-58 0,-54 Q-10,-58 -22,-50 Q-30,-48 -32,-56 Z", "pelo"]
  ],
  patrona: [
    ["M-66,-150 L-70,-196 Q-58,-214 -46,-206 Q-36,-232 -18,-224 Q0,-246 18,-224 Q36,-232 46,-206 Q58,-214 70,-196 L66,-150 Z", "acento"],
    ["M-150,120 Q-136,0 -40,-28 L0,26 L40,-28 Q136,0 150,120 Z", "ropa"],
    ["M-112,10 Q-104,56 -112,112 M112,10 Q104,56 112,112 M-76,-6 Q-70,50 -76,114 M76,-6 Q70,50 76,114", "fino"],
    // chal con flecos
    ["M-120,30 L-40,110 M120,30 L40,110 M-30,0 L0,40 L30,0", "detalle"],
    ["M-132,30 l-8,14 M-118,42 l-8,14 M-104,54 l-8,14 M-90,66 l-8,14 M132,30 l8,14 M118,42 l8,14 M104,54 l8,14 M90,66 l8,14", "finoA"],
    [flor(-86, 52, 11) + flor(88, 56, 11), "acento"],
    [circ(-86, 52, 4) + circ(88, 56, 4), "brasa"],
    ["M-18,-40 L-18,-20 L0,26 L18,-20 L18,-40 Z", "piel"],
    // cuello de encaje
    ["M-34,-30 Q-36,-16 -26,-20 Q-24,-8 -14,-12 Q-8,0 0,-6 Q8,0 14,-12 Q24,-8 26,-20 Q36,-16 34,-30 Q0,-20 -34,-30 Z", "papelf"],
    [circ(0, -170, 26), "pelo"],
    ["M-14,-176 Q0,-190 14,-176", "finoP"],
    [elip(0, -90, 44, 56), "piel"],
    ["M-50,-80 Q-62,-162 0,-164 Q62,-162 50,-80 Q46,-120 24,-134 Q0,-122 -24,-134 Q-46,-120 -50,-80 Z", "pelo"],
    ["M0,-164 Q-4,-146 -2,-132", "finoP"],
    [flor(38, -140, 8), "acento"], [circ(38, -140, 3), "brasa"],
    [circ(-46, -62, 8) + circ(46, -62, 8), "acento"],
    ["M-28,-106 Q-17,-112 -6,-106 M6,-106 Q17,-112 28,-106 M-24,-98 L-29,-103 M24,-98 L29,-103", "linea"],
    [circ(-17, -92, 5) + circ(17, -92, 5), "punto"],
    ["M0,-90 L-5,-74 L3,-73", "linea"],
    ["M-30,-72 Q-24,-78 -18,-72 M18,-72 Q24,-78 30,-72", "fino"],
    ["M-13,-58 Q-6,-64 0,-60 Q6,-64 13,-58 Q0,-48 -13,-58 Z", "acento"]
  ],
  pulpero: [
    ["M-152,120 Q-142,-4 -42,-28 L42,-28 Q142,-4 152,120 Z", "ropa"],
    ["M-112,6 Q-104,52 -112,112 M112,6 Q104,52 112,112", "fino"],
    ["M-42,-28 L-22,6 L0,-16 L22,6 L42,-28 M-50,4 L-36,-26 M50,4 L36,-26", "detalle"],
    ["M-56,4 L56,4 L64,120 L-64,120 Z", "acento"],
    // delantal: tira, bolsillos y botones
    ["M-56,16 L56,16", "fino"],
    ["M-46,34 L-14,34 L-14,62 L-46,62 Z M14,34 L46,34 L46,62 L14,62 Z", "fino"],
    [botones(0, 28, 4, 22), "punto"],
    ["M-24,40 L24,40 L24,74 L-24,74 Z", "linea"],
    ["M-22,-44 L-22,-22 L22,-22 L22,-44 Z", "piel"],
    ["M-54,-94 q-16,2 -11,22 q4,12 13,8 Z M54,-94 q16,2 11,22 q-4,12 -13,8 Z", "piel"],
    [elip(0, -86, 52, 58), "piel"],
    ["M-60,-118 Q-74,-172 0,-176 Q74,-172 60,-118 Q0,-134 -60,-118 Z", "pelo"],
    ["M-30,-150 Q-14,-162 4,-158 M20,-156 Q38,-152 48,-140", "finoP"],
    ["M2,-176 L8,-190", "linea"],
    // lápiz en la oreja
    ["M40,-132 L88,-108 L84,-100 L36,-124 Z", "acento"],
    ["M84,-108 L92,-104 L88,-98 L84,-100 Z", "brasa"],
    ["M-38,-112 L-10,-106 L-10,-100 L-38,-104 Z M38,-112 L10,-106 L10,-100 L38,-104 Z", "pelo"],
    [circ(-22, -91, 5) + circ(22, -91, 5), "punto"],
    ["M0,-96 Q-14,-72 -2,-68", "linea"],
    ["M-48,-54 Q-28,-76 0,-62 Q28,-76 48,-54 Q56,-40 44,-40 Q24,-56 0,-50 Q-24,-56 -44,-40 Q-56,-40 -48,-54 Z", "pelo"],
    ["M-36,-56 Q-20,-64 -6,-58 M36,-56 Q20,-64 6,-58", "finoP"]
  ],
  gato: [
    ["M-46,-30 Q-96,50 -70,120 L70,120 Q96,50 46,-30 Z", "pelo"],
    ["M-40,40 Q-52,70 -50,104 M40,40 Q52,70 50,104", "finoP"],
    ["M-30,120 L-30,94 M30,120 L30,94", "detalle"],
    ["M-48,-92 L-44,-142 L-12,-112 Z M48,-92 L44,-142 L12,-112 Z", "pelo"],
    ["M-40,-100 L-39,-128 L-22,-112 Z M40,-100 L39,-128 L22,-112 Z", "brasa"],
    [elip(0, -70, 56, 46), "pelo"],
    ["M-36,-78 Q-23,-93 -10,-78 Q-23,-67 -36,-78 Z M36,-78 Q23,-93 10,-78 Q23,-67 36,-78 Z", "ojo"],
    ["M-23,-86 L-23,-71 M23,-86 L23,-71", "linea"],
    ["M-7,-60 L7,-60 L0,-52 Z", "acento"],
    ["M0,-52 L0,-44 M-9,-44 Q0,-38 9,-44", "finoP"],
    ["M-12,-52 L-48,-58 M-12,-47 L-46,-40 M12,-52 L48,-58 M12,-47 L46,-40", "detalle"],
    ["M-36,-30 Q0,-8 36,-30", "gruesoB"],
    [circ(0, -16, 7), "acento"],
    ["M-3,-16 L3,-16", "linea"]
  ]
};
// la cola del gato va aparte (cambia de lado entre las dos versiones)
const COLA = [["M66,110 Q140,104 128,24 Q122,-6 100,6", "cola"]];

// ───────────────────────── objetos de cada figura y palo ─────────────────────────
// Cada objeto se dibuja en una caja de unos 100 centrada en 0 y se posa en un costado del óvalo, tapando el filete (queda «pegado» en la etiqueta).
const mano = (x, y) => [circ(x, y, 9.5), "piel"];

function objFacon() {
  return [
    ["M0,-60 L8,-44 L8,6 L-8,6 L-8,-44 Z", "hierro"], ["M0,-46 L0,0", "fino"],
    ["M-19,6 L19,6 L19,15 L-19,15 Z", "acento"],
    ["M-7,15 L7,15 L8,46 Q0,52 -8,46 Z", "madera"], ["M-7,25 L7,25 M-7,35 L7,35", "fino"],
    mano(0, 34)
  ];
}
function objGuitarra() {
  return [
    ["M-5,-6 L-5,-54 L5,-54 L5,-6 Z", "tintaf"],
    ["M-8,-54 L8,-54 L8,-68 L-8,-68 Z", "tintaf"], ["M-12,-62 l4,0 M8,-62 l4,0", "grueso"],
    ["M0,-4 C-26,-8 -30,16 -22,24 C-34,34 -28,56 0,56 C28,56 34,34 22,24 C30,16 26,-8 0,-4 Z", "acento"],
    [circ(0, 30, 8), "tintaf"],
    ["M-12,45 L12,45", "grueso"],
    ["M-1.6,-52 L-1.6,45 M1.6,-52 L1.6,45", "finoP"],
    ["M-22,12 Q0,6 22,12", "fino"],
    mano(0, -22)
  ];
}
function objMate() {
  return [
    ["M-24,-8 Q-28,34 -10,44 Q0,48 10,44 Q28,34 24,-8 Z", "madera"],
    ["M-23,12 Q0,22 23,12", "detalle"], ["M-22,26 Q0,34 22,26", "detalle"],
    [elip(0, -8, 24, 7), "tintaf"],
    ["M-17,-10 Q0,-26 17,-10 Q0,-4 -17,-10 Z", "fino"],
    ["M8,-12 L30,-54", "hierro"], ["M8,-12 L30,-54", "fino"], ["M27,-52 Q36,-60 40,-54", "grueso"],
    ["M-10,-26 Q-18,-38 -9,-48 M2,-28 Q-6,-40 3,-52", "fino"],
    mano(-24, 16)
  ];
}
function objRebenque() {
  return [
    ["M0,-8 C22,-30 -12,-42 18,-56 C28,-60 34,-52 30,-46", "cola"],
    ["M26,-52 L42,-62 L46,-52 L32,-42 Z", "brasa"],
    ["M-6,-6 L6,-6 L7,50 L-7,50 Z", "madera"],
    ["M-6,4 L6,10 M-6,14 L6,20 M-6,24 L6,30 M-6,34 L6,40", "fino"],
    ["M-9,-9 L9,-9 L9,-2 L-9,-2 Z", "acento"],
    ["M-8,50 Q0,62 8,50", "grueso"],
    mano(0, 28)
  ];
}
function objAbanico() {
  const c = [0, 32], R = 64;
  const a0 = arco(c[0], c[1], R, 200), a1 = arco(c[0], c[1], R, 340);
  const r2 = 46, b0 = arco(c[0], c[1], r2, 200), b1 = arco(c[0], c[1], r2, 340);
  let varillas = "";
  for (const g of [220, 240, 260, 280, 300, 320]) { const [x, y] = arco(c[0], c[1], R, g); varillas += `M${c[0]},${c[1]} L${x},${y} `; }
  return [
    [`M${c[0]},${c[1]} L${a0[0]},${a0[1]} A${R},${R} 0 0 1 ${a1[0]},${a1[1]} Z`, "papelf"],
    [`M${c[0]},${c[1]} L${b0[0]},${b0[1]} A${r2},${r2} 0 0 1 ${b1[0]},${b1[1]} Z`, "brasa"],
    [varillas, "fino"],
    [circ(0, -10, 5) + circ(-26, 0, 4) + circ(26, 0, 4), "acento"],
    ["M-5,32 L-4,56 L4,56 L5,32 Z", "madera"],
    mano(0, 54)
  ];
}
function objRosario() {
  let cuentas = "", gordas = "";
  for (let k = 0; k < 14; k++) {
    const g = k * 2 * Math.PI / 14 + Math.PI / 2;
    const px = f1(Math.cos(g) * 27), py = f1(-6 + Math.sin(g) * 33);
    if (k % 7 === 0 && k) gordas += circ(px, py, 6.5); else cuentas += circ(px, py, 5);
  }
  return [
    [elip(0, -6, 27, 33), "fino"],
    [cuentas, "acento"], [gordas, "brasa"],
    ["M0,27 L0,36", "fino"],
    ["M-4.5,34 L4.5,34 L4.5,64 L-4.5,64 Z", "madera"], ["M-14,44 L14,44 L14,51 L-14,51 Z", "madera"],
    [circ(0, 47.5, 3.5), "acento"],
    mano(0, -40)
  ];
}
function objCanasta() {
  return [
    ["M-33,-8 C-33,-62 33,-62 33,-8", "grueso"],
    [elip(-16, -12, 9, 12) + elip(0, -16, 9, 12) + elip(16, -12, 9, 12), "papelf"],
    ["M-30,-6 L30,-6 L24,44 L-24,44 Z", "madera"],
    ["M-28,6 L28,6 M-26,18 L26,18 M-25,30 L25,30 M-14,-4 L-10,44 M0,-4 L0,44 M14,-4 L10,44", "fino"],
    ["M-31,-8 L31,-8", "grueso"],
    ["M-18,20 L18,20 L18,30 L-18,30 Z", "brasa"],
    mano(0, -44)
  ];
}
function objPava() {
  return [
    ["M-26,2 C-56,-4 -56,38 -24,36", "cola"],
    ["M22,10 L50,-16 L56,-10 L28,26 Z", "tintaf"],
    ["M-26,-6 Q-30,42 -14,48 L14,48 Q30,42 26,-6 Q0,-16 -26,-6 Z", "tintaf"],
    ["M-15,6 Q-19,28 -11,40", "finoP"], ["M-27,18 Q0,26 27,18", "gruesoB"],
    ["M-10,-12 Q0,-18 10,-12 L8,-20 L-8,-20 Z", "tintaf"], [circ(0, -24, 5), "acento"],
    ["M52,-22 Q44,-34 53,-44 M60,-18 Q54,-28 62,-38", "fino"],
    mano(-42, 18)
  ];
}
function objBalanza() {
  return [
    ["M0,-44 L0,38", "grueso"], ["M-24,44 L24,44 L16,36 L-16,36 Z", "hierro"],
    ["M-50,-30 L50,-30", "grueso"], [circ(0, -52, 7), "acento"],
    ["M-50,-30 L-62,0 M-50,-30 L-38,0 M50,-30 L38,0 M50,-30 L62,0", "fino"],
    ["M-68,0 Q-50,18 -32,0 Z M32,0 Q50,18 68,0 Z", "hierro"],
    [circ(-50, -6, 7), "acento"], ["M43,-9 L57,-9 L55,0 L45,0 Z", "tintaf"],
    mano(0, -60)
  ];
}
function objLibreta() {
  return [
    ["M-28,-38 L28,-38 L28,40 L-28,40 Z", "papelf"],
    ["M-28,-38 L-16,-38 L-16,40 L-28,40 Z", "brasa"],
    ["M-9,-24 L19,-24 M-9,-13 L19,-13 M-9,-2 L19,-2 M-9,9 L13,9", "fino"],
    ["M-8,24 L-8,35 M-3,24 L-3,35 M2,24 L2,35 M7,24 L7,35 M-11,33 L11,26", "linea"],
    ["M-22,-30 L-22,-6", "finoA"],
    mano(24, 38)
  ];
}
function objDamajuana() {
  return [
    ["M-8,-60 L8,-60 L8,-40 L-8,-40 Z", "tintaf"], ["M-9,-68 L9,-68 L9,-60 L-9,-60 Z", "acento"],
    ["M-32,-26 C-52,-34 -52,-2 -36,-2", "grueso"],
    ["M-7,-42 Q-37,-34 -37,2 Q-37,42 0,46 Q37,42 37,2 Q37,-34 7,-42 Z", "madera"],
    ["M-30,-18 L30,18 M-34,-4 L24,26 M-22,-28 L34,6 M30,-18 L-30,18 M34,-4 L-24,26 M22,-28 L-34,6", "fino"],
    ["M-20,-8 L20,-8 L20,16 L-20,16 Z", "papelf"], ["M-13,0 L13,0 M-13,8 L8,8", "linea"],
    mano(-44, -16)
  ];
}
function objLapiz() {
  return [
    ["M-46,-42 L-8,-42 L-8,34 L-46,34 Z", "papelf"],
    ["M-40,-30 L-14,-30 M-40,-20 L-14,-20 M-40,-10 L-14,-10 M-40,0 L-20,0", "fino"],
    ["M-40,18 L-14,18", "grueso"], ["M-40,26 L-26,26", "fino"],
    ["M4,-52 L20,-52 L20,28 L12,42 L4,28 Z", "acento"], ["M4,28 L12,42 L20,28 Z", "papelf"], ["M9.5,37 L12,42 L14.5,37 Z", "tintaf"],
    ["M4,-52 L20,-52 L20,-42 L4,-42 Z", "brasa"], ["M4,-42 L20,-42 L20,-37 L4,-37 Z", "hierro"], ["M12,-36 L12,28", "fino"],
    mano(12, -14)
  ];
}
function objOvillo() {
  return [
    ["M24,16 Q52,28 38,46 Q22,60 46,62", "grueso"],
    [circ(0, 0, 28), "brasa"],
    ["M-22,-14 Q0,-26 22,-12 M-27,2 Q0,-10 27,4 M-20,18 Q4,6 25,16 M-8,-26 Q-18,0 -8,26 M8,-26 Q18,0 8,26", "finoP"]
  ];
}
function objPez() {
  return [
    ["M-44,0 Q-14,-30 24,-10 L46,-26 L42,0 L46,26 L24,10 Q-14,30 -44,0 Z", "papelf"],
    ["M-14,-18 Q-4,-30 10,-24 L4,-12 Z", "brasa"], ["M-30,-6 Q-24,0 -30,6", "fino"],
    ["M2,-14 Q8,0 2,14 M12,-12 Q18,0 12,12", "fino"],
    [circ(-30, -3, 3.2), "punto"],
    ["M30,-6 L42,-14 M30,6 L42,14", "fino"]
  ];
}

// quién lleva qué en cada palo: [objeto, lado, escala]
const OBJETOS = {
  gaucho:  { pica: [objFacon, "d", 1.2], corazon: [objGuitarra, "i", 1.0], diamante: [objMate, "d", 1.2], trebol: [objRebenque, "i", 1.15] },
  patrona: { pica: [objAbanico, "i", 1.2], corazon: [objRosario, "d", 1.05], diamante: [objCanasta, "i", 1.2], trebol: [objPava, "d", 1.15] },
  pulpero: { pica: [objBalanza, "d", 1.0], corazon: [objLibreta, "i", 1.15], diamante: [objDamajuana, "d", 1.1], trebol: [objLapiz, "i", 1.2] }
};
const FIGURA = { 11: ["gaucho", "el gaucho"], 12: ["patrona", "la patrona"], 13: ["pulpero", "el pulpero"] };

// ───────────────────────── piezas de la carta ─────────────────────────
const PIPS = {
  2: [[300, 230], [300, 630]], 3: [[300, 230], [300, 430], [300, 630]],
  4: [[200, 230], [400, 230], [200, 630], [400, 630]], 5: [[200, 230], [400, 230], [300, 430], [200, 630], [400, 630]],
  6: [[200, 230], [400, 230], [200, 430], [400, 430], [200, 630], [400, 630]],
  7: [[200, 230], [400, 230], [300, 330], [200, 430], [400, 430], [200, 630], [400, 630]],
  8: [[200, 230], [400, 230], [300, 330], [200, 430], [400, 430], [300, 530], [200, 630], [400, 630]],
  9: [[200, 230], [400, 230], [200, 363], [400, 363], [300, 430], [200, 497], [400, 497], [200, 630], [400, 630]],
  10: [[200, 230], [400, 230], [300, 296], [200, 363], [400, 363], [200, 497], [400, 497], [300, 564], [200, 630], [400, 630]]
};
const RANGO = { 1: "A", 11: "J", 12: "Q", 13: "K" };

// Ancho de avance de cada carácter de Caveat 700 a 150 px (medido con canvas en Chrome, 2026-11-17). Sin DOM no se puede medir al vuelo.
const ANCHO_CAVEAT = { "0": 67.5, "1": 67.5, "2": 67.5, "3": 67.5, "4": 67.5, "5": 65.1, "6": 70.6, "7": 66.9, "8": 67.5, "9": 65.7, A: 76.6, J: 47.3, Q: 73.8, K: 76.2 };
const TAM = 150, LS = -2;
const anchoTexto = t => [...t].reduce((s, ch) => s + (ANCHO_CAVEAT[ch] ?? 68), 0) + (t.length - 1) * LS;

function indice(n, p, vc) {
  const t = RANGO[n] || String(n), c = p ? colorDe(p) : K.tinta;
  let s = "";
  if (n > 0) {
    const w = anchoTexto(t);
    const y = 32 + TAM * .74, cy = y - TAM * .36;
    s += `<text x="34" y="${f1(y)}" font-family="Caveat, cursive" font-weight="700" font-size="${TAM}" letter-spacing="${LS}" fill="${c}">${t}</text>`;
    s += `<g transform="translate(${f1(34 + w + 7 + 36)},${f1(cy)}) scale(.78)">${palo(p, c)}</g>`;  // el palo pegado al número (36 = su semiancho)
  } else {
    s += `<g transform="translate(92,${f1(32 + TAM * .74 - TAM * .36)}) scale(1.05)">${sol(vc, 9)}</g>`;  // comodín: el sol, sin número
  }
  return s + `<g transform="rotate(180 300 430)">${s}</g>`;
}

const OV = { cx: 300, cy: 405, rx: 195, ry: 240 };  // el óvalo de la figura
const marco = () => `<rect x="16" y="16" width="568" height="828" rx="20" fill="none" stroke="${K.brasa}" stroke-width="5"/><rect x="28" y="28" width="544" height="804" rx="14" fill="none" stroke="${K.tinta}" stroke-width="2"/>`;
const ovaloMarco = () => `<ellipse cx="${OV.cx}" cy="${OV.cy}" rx="${OV.rx + 8}" ry="${OV.ry + 8}" fill="none" stroke="${K.brasa}" stroke-width="6"/><ellipse cx="${OV.cx}" cy="${OV.cy}" rx="${OV.rx}" ry="${OV.ry}" fill="none" stroke="${K.tinta}" stroke-width="3"/>`;
const fondoOvalo = () => `<rect x="${OV.cx - OV.rx}" y="${OV.cy - OV.ry}" width="${2 * OV.rx}" height="${2 * OV.ry}" fill="${K.ovalo}"/>`;

function banda(txt, marcas) {
  const t = txt.toUpperCase();
  const largo = t.length * 31 > 350 ? ` textLength="350" lengthAdjust="spacingAndGlyphs"` : "";
  let s = `<path d="M90,644 L510,644 L492,671 L510,698 L90,698 L108,671 Z" fill="${K.brasa}" stroke="${K.tinta}" stroke-width="3"/>`;
  s += `<path d="M106,650 L494,650 M106,692 L494,692" stroke="${K.papel}" stroke-width="1.5" opacity=".55"/>`;
  s += `<text x="300" y="683" text-anchor="middle" font-family="Bricolage, sans-serif" font-weight="700" font-size="38" letter-spacing="5"${largo} fill="${K.papel}">${t}</text>`;
  if (marcas) for (const x of [132, 468]) s += `<g transform="translate(${x},671) scale(.3)">${palo(marcas, K.ambar)}</g>`;
  return s;
}

// rayos finos de fondo para el óvalo del as (como el estallido de una lata)
function estallido() {
  let d = "";
  for (let k = 0; k < 36; k++) { const a = k * Math.PI / 18; d += `M${f1(300 + 80 * Math.cos(a))},${f1(405 + 80 * Math.sin(a))} L${f1(300 + 260 * Math.cos(a))},${f1(405 + 260 * Math.sin(a))} `; }
  return `<path d="${d}" stroke="${K.rayo}" stroke-width="3" fill="none"/>`;
}
const clipOvalo = () => `<clipPath id="ov__U__"><ellipse cx="${OV.cx}" cy="${OV.cy}" rx="${OV.rx}" ry="${OV.ry}"/></clipPath>`;

const LEYENDA_AS = { pica: "almacén el sol", corazon: "yerba y galletita", diamante: "despacho de bebidas", trebol: "fiado no" };

function caraAs(p) {
  const c = colorDe(p);
  let s = clipOvalo() + `<g clip-path="url(#ov__U__)">${fondoOvalo()}${estallido()}</g>` + ovaloMarco();
  s += `<g transform="translate(300,402) scale(3.3)">${palo(p, c)}</g>`;
  if (p === "pica") s += `<g transform="translate(300,376) scale(1.1)">${sol(K.papel, 7)}</g>`;
  // dos palitos de ornamento arriba, en las esquinas del óvalo
  for (const [x, y] of [[180, 232], [420, 232]]) s += `<g transform="translate(${x},${y}) scale(.36)">${palo(p, c)}</g>`;
  return s + banda(LEYENDA_AS[p]);
}

function caraFigura(n, p) {
  const [pj, rotulo] = FIGURA[n];
  const [obj, lado, esc] = OBJETOS[pj][p];
  const c = colorDe(p);
  let s = clipOvalo() + `<g clip-path="url(#ov__U__)">${fondoOvalo()}`;
  // la marca del palo, grande y tenue detrás de la figura, y dos chicas arriba
  s += `<g transform="translate(196,252) scale(.4)">${palo(p, c)}</g><g transform="translate(404,252) scale(.4)">${palo(p, c)}</g>`;
  s += `<g transform="translate(300,520) scale(1.3)">${pintar(PJ[pj], 5.6)}</g></g>` + ovaloMarco();
  const x = lado === "d" ? 432 : 168, e = esc * 1.5;
  s += `<g transform="translate(${x},560) rotate(${lado === "d" ? 8 : -8}) scale(${f1(e)})">${pintar(obj(), 4.6 / e)}</g>`;
  return s + banda(rotulo, p);
}

function caraComodin(v) {
  const dos = v === 2;
  const cc = dos ? K.tinta : K.brasa;
  let s = clipOvalo() + `<g clip-path="url(#ov__U__)">${fondoOvalo()}`;
  s += `<g transform="translate(300,508) scale(1.3)">`;
  // luna (o estrellas, en la otra versión) detrás del gato
  const fondo = dos
    ? [[flor(-92, -176, 9) + flor(96, -130, 7), "acento"]]
    : [[circ(96, -176, 32), "acento"], [circ(110, -186, 27), "fondo"]];
  const cuerpo = [...fondo, ...COLA, ...PJ.gato];
  s += dos ? `<g transform="scale(-1,1)">${pintar(cuerpo, 5.6)}</g>` : pintar(cuerpo, 5.6);
  s += `</g></g>` + ovaloMarco();
  // lo que lleva el gato: un ovillo de lana (versión 1) o una sardina (versión 2)
  s += dos
    ? `<g transform="translate(436,566) rotate(-12) scale(1.4)">${pintar(objPez(), 4.6 / 1.4)}</g>`
    : `<g transform="translate(166,572) scale(1.4)">${pintar(objOvillo(), 4.6 / 1.4)}</g>`;
  void cc;
  return s + banda("comodín");
}

function caraPips(n, p) {
  const c = colorDe(p);
  let s = "";
  for (const [x, y] of PIPS[n]) s += `<g transform="translate(${x},${y}) ${y > 430 ? "rotate(180)" : ""}">${palo(p, c)}</g>`;
  return s;
}

// ───────────────────────── API ─────────────────────────
const cache = new Map();
let nUnico = 0;
function dibujar(pa) {
  const { rango: n, palo: p } = pa;
  let cuerpo, vc = K.brasa;
  if (n === 0) { const v = pa.copia && +pa.copia % 2 === 0 ? 2 : 1; vc = v === 2 ? K.tinta : K.brasa; cuerpo = caraComodin(v); }
  else if (n === 1) cuerpo = caraAs(p);
  else if (FIGURA[n]) cuerpo = caraFigura(n, p);
  else cuerpo = caraPips(n, p);
  return `<svg class="svg-carta" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="__N__"><rect width="${W}" height="${H}" rx="30" fill="${K.papel}"/>${marco()}${cuerpo}${indice(n, p, vc)}</svg>`;
}

/** SVG de la cara de la carta. Cada llamada devuelve ids de clipPath propios (la misma carta puede estar dos veces en pantalla). */
export function frente(id) {
  const pa = partes(id);
  if (!pa) return dorso();
  const clave = pa.rango === 0 ? `0-${pa.copia && +pa.copia % 2 === 0 ? 2 : 1}` : `${pa.rango}-${pa.palo}`;
  if (!cache.has(clave)) cache.set(clave, dibujar(pa));
  return cache.get(clave).replaceAll("__U__", "-" + ++nUnico).replace("__N__", nombreCarta(id));
}
