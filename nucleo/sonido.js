// Sonido de la plataforma: todo sintetizado con WebAudio (sin archivos, sin pago) + voces con la voz de Pedro
// cuando existan en audio/frases.json (clave → archivos). Sin la voz, cada frase tiene un sonido de reemplazo.
// El audio recién arranca con el primer toque (los navegadores lo exigen).

let ctx = null;
let mudo = false;
try { mudo = localStorage.getItem("chin.mudo") === "1"; } catch { /* sin almacenamiento */ }

function ac() {
  if (!ctx) {
    const A = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!A) return null;
    ctx = new A();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function ruido(c, dur) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function tono(c, { f0, f1 = f0, dur = 0.12, tipo = "sine", vol = 0.3, en = 0 }) {
  const t = c.currentTime + en;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

function soplido(c, { dur = 0.05, freq = 3000, vol = 0.25, en = 0 }) {
  const t = c.currentTime + en;
  const s = ruido(c, dur), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
}

const SONIDOS = {
  carta: (c) => soplido(c, { dur: 0.05, freq: 3200, vol: 0.22 }),                 // dar vuelta
  poner: (c) => { soplido(c, { dur: 0.04, freq: 1800, vol: 0.3 }); tono(c, { f0: 150, f1: 62, dur: 0.1, vol: 0.34 }); }, // cae con peso
  coincidencia: (c) => { tono(c, { f0: 95, f1: 55, dur: 0.38, vol: 0.5 }); tono(c, { f0: 660, f1: 990, dur: 0.22, tipo: "triangle", vol: 0.16, en: 0.02 }); },
  chin: (c) => {                                                                   // reemplazo del grito
    [523, 659, 784, 1047].forEach((f, k) => tono(c, { f0: f, dur: 0.22, tipo: "square", vol: 0.1, en: k * 0.045 }));
    soplido(c, { dur: 0.18, freq: 5000, vol: 0.2 });
  },
  perdiste: (c) => { tono(c, { f0: 330, f1: 220, dur: 0.3, tipo: "triangle", vol: 0.22 }); },
  llevar: (c) => { for (let k = 0; k < 4; k++) soplido(c, { dur: 0.05, freq: 2400 - k * 250, vol: 0.18, en: k * 0.07 }); },
  rechazo: (c) => { tono(c, { f0: 120, dur: 0.07, tipo: "sawtooth", vol: 0.18 }); tono(c, { f0: 100, dur: 0.09, tipo: "sawtooth", vol: 0.18, en: 0.09 }); },
  tic: (c) => tono(c, { f0: 880, dur: 0.07, tipo: "triangle", vol: 0.18 }),
  ya: (c) => { tono(c, { f0: 1175, dur: 0.22, tipo: "triangle", vol: 0.24 }); },
  gane: (c) => { [523, 659, 784, 1047].forEach((f, k) => tono(c, { f0: f, dur: 0.3, tipo: "triangle", vol: 0.2, en: k * 0.11 })); },
  perdi: (c) => { [392, 330, 262, 196].forEach((f, k) => tono(c, { f0: f, dur: 0.32, tipo: "triangle", vol: 0.2, en: k * 0.14 })); },
};

let frases = null;   // { clave: [archivos] } o {} si no hay voces todavía
async function cargarFrases() {
  if (frases) return frases;
  try {
    const r = await fetch("audio/frases.json", { cache: "no-cache" });
    frases = r.ok ? await r.json() : {};
  } catch { frases = {}; }
  return frases;
}

export const sonido = {
  get mudo() { return mudo; },
  setMudo(v) { mudo = !!v; try { localStorage.setItem("chin.mudo", mudo ? "1" : "0"); } catch { /* ok */ } },
  /** Despierta el audio (llamar desde un toque). */
  despertar() { ac(); cargarFrases(); },
  play(nombre) {
    if (mudo) return;
    const c = ac();
    if (c && SONIDOS[nombre]) SONIDOS[nombre](c);
  },
  /** Dice una frase con la voz de Pedro si existe; si no, suena el reemplazo `alternativa`. */
  async voz(clave, alternativa = clave) {
    if (mudo) return;
    const f = await cargarFrases();
    const lista = f[clave];
    if (lista && lista.length) {
      const a = new Audio("audio/" + lista[Math.floor(Math.random() * lista.length)]);
      a.play().catch(() => this.play(alternativa));
    } else this.play(alternativa);
  },
};
