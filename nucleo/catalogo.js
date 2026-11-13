// La pulpería de la plataforma: lo que se consigue con la gloria (la MISMA gloria del truco: perfiles.puntos).
// Son umbrales: «ponerlo» no descuenta nada. Lo elegido va a perfil.estilo (cara, dorso, pano) y se ve en las mesas.
// Los umbrales de lo que ya existía en el truco (dorsos rayado/luna/celeste/oro, paños verde/rojo/azul/marmol) son
// los mismos; los 4 propios de la plataforma (dorso tinta y brasa, paño noche y ceniza) los controla la base con
// plataforma/supabase/esquema.sql. Si se cambia un umbral, cambiarlo también ahí (validar_cosmeticos).

export const DORSOS = {
  clasico: { nombre: "El de siempre", p: 0 },
  rayado: { nombre: "Rayado", p: 3 },
  tinta: { nombre: "Tinta", p: 6, propio: true },
  luna: { nombre: "Luna", p: 12 },
  brasa: { nombre: "Brasa", p: 26, propio: true },
  celeste: { nombre: "Celeste y blanco", p: 33 },
  oro: { nombre: "De oro", p: 60 },
};
export const PANOS = {
  casa: { nombre: "Paño de la casa", p: 0, a: "#253731", b: "#1c2a26" },
  verde: { nombre: "Paño verde", p: 5, a: "#2c5a3a", b: "#1c3a26" },
  noche: { nombre: "Paño de noche", p: 14, a: "#1c2640", b: "#0e1220", propio: true },
  rojo: { nombre: "Paño de cantina", p: 18, a: "#6a2424", b: "#3e1717" },
  ceniza: { nombre: "Paño ceniza", p: 40, a: "#3c3a36", b: "#23221f", propio: true },
  azul: { nombre: "Paño de medianoche", p: 48, a: "#243a63", b: "#141f3a" },
  marmol: { nombre: "Mármol negro", p: 80, a: "#2a2c30", b: "#141518" },
};
export const CARAS = [0, 1, 2, 3, 4, 5];

export const gloriaDe = (perfil) => perfil?.puntos || 0;
export const alcanza = (perfil, p) => !!perfil && gloriaDe(perfil) >= p;

/** Lo que usa la mesa: solo lo que esa gloria alcanza (lo demás cae al de siempre). */
export function estiloParaMesa(perfil) {
  const e = perfil?.estilo || {};
  const out = {};
  if (Number.isInteger(e.cara) && e.cara >= 0 && e.cara < 6) out.cara = e.cara;
  if (DORSOS[e.dorso] && e.dorso !== "clasico" && alcanza(perfil, DORSOS[e.dorso].p)) out.dorso = e.dorso;
  if (PANOS[e.pano] && e.pano !== "casa" && alcanza(perfil, PANOS[e.pano].p)) out.pano = e.pano;
  return out;
}

/** Forma de cabeza (0 a 5): la elegida o una fija por usuario (así cada uno tiene su cara aunque no elija). */
export function formaDe(perfil, defecto = 0) {
  const f = perfil?.estilo?.cara;
  if (Number.isInteger(f) && f >= 0 && f < 6) return f;
  if (!perfil?.usuario) return defecto;
  let h = 0; for (const c of perfil.usuario) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 6;
}

/** El próximo desbloqueo por gloria (para «te faltan N»). */
export function proximo(puntos) {
  const todos = [
    ...Object.entries(DORSOS).map(([k, x]) => ({ tipo: "dorso", k, ...x })),
    ...Object.entries(PANOS).map(([k, x]) => ({ tipo: "pano", k, ...x })),
  ].filter((x) => x.p > (puntos || 0)).sort((a, b) => a.p - b.p);
  return todos[0] || null;
}
