// Los tres bots de la escoba: los mismos de CHIN (nombre, cara y lema), con frases de escoba.
// Hablan en un globito junto a su cara en momentos puntuales (ver `decir` en local.js).
import { PERSONAJES as DE_CHIN } from "../chin/personajes.js";

const FRASES = {
  tranquilo: {
    empieza: ["Repartí vos, que yo cebo.", "A quince, despacito.", "A ver qué me tocó…"],
    escoba: ["¡Uh, escoba! Ni la estaba buscando.", "Mirá vos, barrí la mesa.", "Escobita de la siesta."],
    escoba_rival: ["Uy, me barriste.", "Ahí te la dejé servida, ¿no?", "Bien ahí, pibe."],
    siete_oro: ["El siete bello se viene conmigo.", "Ese siete lo quería yo."],
    siete_oro_rival: ["Ah, el siete de oro… qué le vamos a hacer."],
    soplo: ["¡Soplo! Ahí había quince, eh.", "Esa la vi hasta yo."],
    soplado: ["¡Uh, no la vi! Bien soplado.", "Me agarraste dormido."],
    gana: ["¡Gané! No lo puedo creer ni yo.", "Despacio se llega lejos, viste."],
    pierde: ["Bien jugado. Otro mate y la revancha.", "Me ganaste limpito."],
    // de a 4, cuando es tu compañero
    socio_empieza: ["Vamos, socio, despacito.", "Yo cebo, vos barré."],
    socio_escoba: ["¡Bien ahí, socio!", "¡Esa es, compañero!", "Mirá vos, ¡qué escobita!"],
    socio_soplo: ["¡Eso, socio! Bien visto.", "Ni yo la había visto."],
    socio_soplado: ["Uh, socio, nos soplaron.", "Tranqui, que la recuperamos."],
    socio_gana: ["¡Ganamos, socio! Otro mate.", "Qué pareja, eh."],
    socio_pierde: ["Bien jugado igual, socio.", "La próxima la ganamos."],
  },
  rapido: {
    empieza: ["Dale, que no tengo toda la noche.", "Cortá y repartí, campeón.", "Hoy te barro la mesa."],
    escoba: ["¡Escoba! Anotá, anotá.", "Barridita, ¿viste?", "Limpiecita la mesa."],
    escoba_rival: ["Suerte de principiante.", "Esa te la dejé, eh.", "Bueno, bueno…"],
    siete_oro: ["El siete de oro, regalito de la casa.", "Este va para mi bolsillo."],
    siete_oro_rival: ["Llevátelo, ya lo recupero."],
    soplo: ["¡Soplo! Despertate.", "¿No viste los quince? Gracias.", "Soplo y me las llevo."],
    soplado: ["Esa la dejé a propósito.", "Bueno, bueno, la viste.", "¡Uh! Rata soplada."],
    gana: ["¿Viste? Cancha es cancha.", "Volvé cuando entrenes."],
    pierde: ["Hoy tenés el día.", "La próxima no te la dejo."],
    socio_empieza: ["Dale, socio, que los barremos.", "Vos tirá, que yo cuento."],
    socio_escoba: ["¡Bien ahí, socio! Anotá.", "¡Eso! Barrida en pareja.", "¡Así se juega, compañero!"],
    socio_soplo: ["¡Soplo, socio! Despiertos estamos.", "Esa estaba servida. Bien."],
    socio_soplado: ["¡Socio! ¿No viste los quince?", "Despertate, que nos soplan."],
    socio_gana: ["¡Ganamos! Cancha es cancha.", "Qué pareja, socio."],
    socio_pierde: ["Hoy no se dio, socio.", "La revancha es nuestra."],
  },
  implacable: {
    empieza: ["Listo.", "Repartí.", "A quince."],
    escoba: ["Escoba.", "Mesa limpia.", "Una más."],
    escoba_rival: ["Bien.", "Hm.", "Anotala."],
    siete_oro: ["Mío.", "El siete."],
    siete_oro_rival: ["Bien visto."],
    soplo: ["Soplo.", "Había quince.", "Contá."],
    soplado: ["Bien visto.", "Error mío."],
    gana: ["Otra vez será.", "Contá las cartas."],
    pierde: ["Me ganaste. Respeto.", "Pocas veces pasa."],
    socio_empieza: ["Vamos, socio.", "Contá conmigo."],
    socio_escoba: ["Bien ahí, socio.", "Escoba nuestra.", "Bien jugado."],
    socio_soplo: ["Bien visto, socio.", "Así."],
    socio_soplado: ["Contá, socio.", "Había quince."],
    socio_gana: ["Ganamos, socio.", "Buena pareja."],
    socio_pierde: ["Perdimos. Revancha.", "Se nos escapó."],
  },
};

export const PERSONAJES = Object.fromEntries(Object.entries(DE_CHIN).map(([k, p]) => [k, { nombre: p.nombre, cara: p.cara, lema: p.lema, frases: FRASES[k] }]));
export const personaje = (dificultad) => PERSONAJES[dificultad] || PERSONAJES.rapido;

/**
 * De a 4: quién de los bots dice algo con cada evento. `esBot(j)` dice si el asiento j es un bot; los bots de la pareja
 * de una persona le hablan como compañero («bien ahí, socio»). Devuelve [{ j, momento, chance }] (el que habla decide
 * después si hay lugar: un dicho cada 4 s, salvo al final).
 */
export function charla4(ev, esBot) {
  const out = [];
  const socio = (j) => (j + 2) % 4;
  const rivalBot = (j) => [1, 3].map((k) => (j + k) % 4).find(esBot);
  for (const e of ev) {
    if (e.t === "jugada" && (e.escoba || (e.levanta.length && e.levanta.concat(e.carta).includes("7-oro")))) {
      const m = e.escoba ? "escoba" : "siete_oro";
      if (esBot(e.jugador)) out.push({ j: e.jugador, momento: m, chance: 0.6 });
      else if (esBot(socio(e.jugador))) out.push({ j: socio(e.jugador), momento: "socio_escoba", chance: 0.75 });
      const r = rivalBot(e.jugador);
      if (r !== undefined) out.push({ j: r, momento: `${m}_rival`, chance: 0.35 });
    } else if (e.t === "soplo") {
      if (esBot(e.jugador)) out.push({ j: e.jugador, momento: "soplo", chance: 0.8 });
      else if (esBot(socio(e.jugador))) out.push({ j: socio(e.jugador), momento: "socio_soplo", chance: 0.7 });
      if (esBot(e.de)) out.push({ j: e.de, momento: "soplado", chance: 0.6 });
      else if (esBot(socio(e.de))) out.push({ j: socio(e.de), momento: "socio_soplado", chance: 0.7 });
    } else if (e.t === "fin") {
      // habla un bot de cada pareja: el compañero de una persona lo dice como socio
      for (const p of [0, 1]) {
        const bots = [p, p + 2].filter(esBot);
        if (!bots.length) continue;
        const j = bots[0], gano = e.ganador === p, conPersona = bots.length === 1;
        out.push({ j, momento: conPersona ? (gano ? "socio_gana" : "socio_pierde") : (gano ? "gana" : "pierde"), chance: 1 });
      }
    } else if (e.t === "revancha") {
      const j = [0, 1, 2, 3].find((k) => esBot(k) && !esBot(socio(k))) ?? [0, 1, 2, 3].find(esBot);
      if (j !== undefined) out.push({ j, momento: esBot(socio(j)) ? "empieza" : "socio_empieza", chance: 0.8 });
    }
  }
  return out;
}
