// Perfil, gloria y partidas de la plataforma en Supabase (el MISMO proyecto del truco: un solo perfil y una sola gloria).
// Sin configuración (nube-config.js vacío) no hace nada y los juegos siguen igual, sin cuenta.
// Para probar sin base: window.__NUBE_FALSA puede reemplazar estas funciones (scripts/nube-falsa.js).
import { NUBE } from "./nube-config.js";

let cli = null, usuario = null, perfil = null;
const oyentes = { sesion: [] };
const emitir = (t, x) => oyentes[t].forEach((f) => { try { f(x); } catch (e) { console.error(e); } });
export const on = (t, f) => oyentes[t].push(f);

export const activa = () => !!window.__NUBE_FALSA || !!(NUBE.url && NUBE.clave && window.supabase);
export const miPerfil = () => perfil;
export const miUsuario = () => usuario;
export const normalizarUsuario = (s) => String(s || "").trim().toLowerCase().normalize("NFC").replace(/\s+/g, "");

/** Arranca: recupera la sesión (también la que vuelve de Google en la URL) y el perfil. */
export async function iniciar() {
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.iniciar({ emitir, fijar: (u, p) => { usuario = u; perfil = p; } });
  if (!activa()) return;
  cli = window.supabase.createClient(NUBE.url, NUBE.clave, {
    auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  cli.auth.onAuthStateChange((_ev, sesion) => { setTimeout(() => cambioSesion(sesion), 0); });
  const { data } = await cli.auth.getSession();
  await cambioSesion(data.session);
}

async function cambioSesion(sesion) {
  const u = sesion?.user || null;
  if (u?.id === usuario?.id && perfil) return;
  usuario = u; perfil = null;
  if (u) {
    const { data } = await cli.from("perfiles").select("*").eq("id", u.id).maybeSingle();
    perfil = data || null;
  }
  emitir("sesion", { usuario, perfil });
}

export async function entrarConGoogle() {
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.entrarConGoogle();
  // vuelve a la misma dirección (con ?sala= si lo invitaron)
  const { error } = await cli.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } });
  if (error) throw error;
}
export async function salir() {
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.salir();
  await cli.auth.signOut();
}

/** Primer ingreso: elige su usuario (3 a 16: letras, números, punto, guion). Es el mismo del truco. */
export async function crearPerfil(nombre) {
  const u = normalizarUsuario(nombre);
  if (!/^[a-z0-9_.ñ-]{3,16}$/.test(u)) throw new Error("De 3 a 16 letras o números, sin espacios.");
  if (window.__NUBE_FALSA) { perfil = await window.__NUBE_FALSA.crearPerfil(u); emitir("sesion", { usuario, perfil }); return perfil; }
  const { data, error } = await cli.from("perfiles").insert({ id: usuario.id, usuario: u }).select().single();
  if (error) throw new Error(error.code === "23505" ? "Ese usuario ya existe. Probá otro."
    : /no se puede usar/.test(error.message) ? "Ese usuario no se puede usar. Elegí otro." : "No se pudo guardar. Probá de nuevo.");
  perfil = data; emitir("sesion", { usuario, perfil });
  return perfil;
}

export async function refrescarPerfil() {
  if (!perfil || window.__NUBE_FALSA) return perfil;
  const { data } = await cli.from("perfiles").select("*").eq("id", perfil.id).maybeSingle();
  if (data) { perfil = data; emitir("sesion", { usuario, perfil }); }
  return perfil;
}

/** Guarda lo que eligió para su cara y su mesa (perfil.estilo). La base controla los umbrales de gloria. */
export async function guardarEstilo(estilo) {
  if (!perfil) return;
  if (window.__NUBE_FALSA) { perfil = { ...perfil, estilo }; emitir("sesion", { usuario, perfil }); return; }
  const { data, error } = await cli.from("perfiles").update({ estilo: estilo || {} }).eq("id", perfil.id).select().single();
  if (error) throw new Error(error.message.replace(/^.*?: /, ""));
  perfil = data; emitir("sesion", { usuario, perfil });
}

// ---------- partidas de la plataforma ----------
// La propone el anfitrión y la confirma cada jugador (misma idea que el truco: una persona sola no anota resultados ajenos).
// datos = { id, juego, ganador: 0|1, restantes: cartas que le quedaban al perdedor, jugadores: [{ id, lado }] }
export async function registrarPartidaJuego(datos) {
  if (!perfil) return;
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.registrarPartidaJuego(datos);
  const { error } = await cli.rpc("registrar_partida_juego", { datos });
  if (error) throw new Error(error.message);
}
/** Cada jugador confirma lo que vio. Reintenta si la partida todavía no llegó a la base. */
export async function confirmarPartidaJuego(id, ganador) {
  if (!perfil) return;
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.confirmarPartidaJuego(id, ganador);
  for (let i = 0; i < 6; i++) {
    const { error } = await cli.rpc("confirmar_partida_juego", { partida_id: id, p_ganador: ganador });
    if (!error) { setTimeout(refrescarPerfil, 1500); return; }
    if (!/no existe/.test(error.message)) throw new Error(error.message);
    await new Promise((r) => setTimeout(r, 2500));
  }
}
/** Mis últimas partidas confirmadas de la plataforma. */
export async function misPartidasJuego(limite = 30) {
  if (!perfil) return [];
  if (window.__NUBE_FALSA?.misPartidasJuego) return window.__NUBE_FALSA.misPartidasJuego();
  const { data } = await cli.from("partida_juego_jugadores").select("partida, lado, gano, partidas_juego!inner(juego, jugada, confirmada)")
    .eq("jugador", perfil.id).eq("partidas_juego.confirmada", true).order("partida", { ascending: false }).limit(limite);
  return data || [];
}

// ---------- desafío del día de CHIN ----------
// Mismo reparto para todos contra el bot Rata. Jugarlo es libre; para la tabla hace falta cuenta y cuenta solo el
// primer intento del día (la base lo anota al empezar). `dia` = fecha de Argentina "AAAA-MM-DD".
/** Anota que empezó el desafío de hoy. Devuelve "ok" (cuenta para la tabla) o "ya" (ya lo jugó: es de práctica). */
export async function empezarDesafio(dia) {
  if (!perfil) return null;
  if (window.__NUBE_FALSA?.empezarDesafio) return window.__NUBE_FALSA.empezarDesafio(dia);
  const { data, error } = await cli.rpc("empezar_desafio_chin", { p_dia: dia });
  if (error) throw new Error(error.message);
  return data;
}
/** Cierra el intento de hoy. Devuelve el puesto si ganó (o null). */
export async function terminarDesafio(dia, ms, gano) {
  if (!perfil) return null;
  if (window.__NUBE_FALSA?.terminarDesafio) return window.__NUBE_FALSA.terminarDesafio(dia, ms, gano);
  const { data, error } = await cli.rpc("terminar_desafio_chin", { p_dia: dia, p_ms: Math.round(ms), p_gano: !!gano });
  if (error) throw new Error(error.message);
  return data;
}
/** La tabla del día: [{ usuario, ms }] del más rápido al más lento (la ve cualquiera, sin cuenta). */
export async function tablaDesafio(dia) {
  if (window.__NUBE_FALSA) return window.__NUBE_FALSA.tablaDesafio?.(dia) || [];
  if (!cli) return null;
  const { data, error } = await cli.rpc("tabla_desafio_chin", { p_dia: dia });
  if (error) throw new Error(error.message);
  return data || [];
}

/** Borra la cuenta y todo lo suyo (perfil, gloria, historial). No tiene vuelta atrás. Es la misma función del truco. */
export async function borrarMiCuenta() {
  if (window.__NUBE_FALSA) { perfil = null; emitir("sesion", { usuario: null, perfil: null }); return; }
  const { error } = await cli.rpc("borrar_mi_cuenta");
  if (error) throw new Error(/suspendido/.test(error.message) ? "Con el usuario suspendido no se puede borrar la cuenta. Probá cuando termine la suspensión." : "No se pudo borrar la cuenta. Probá de nuevo.");
  await cli.auth.signOut().catch(() => {});
  usuario = null; perfil = null; emitir("sesion", { usuario, perfil });
}

/** Manda un error del juego a la base (anda también sin cuenta). Lo usa vigia.js; nunca tira.
 *  Devuelve false solo si la nube todavía no arrancó (para que lo reintente); si no hay base, lo descarta. */
export async function reportarError(e) {
  if (window.__NUBE_FALSA || !activa()) return true;
  if (!cli) return false;
  try { await cli.from("errores").insert(e); } catch { /* nunca tira */ }
  return true;
}
