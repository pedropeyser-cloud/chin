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
  },
};

export const PERSONAJES = Object.fromEntries(Object.entries(DE_CHIN).map(([k, p]) => [k, { nombre: p.nombre, cara: p.cara, lema: p.lema, frases: FRASES[k] }]));
export const personaje = (dificultad) => PERSONAJES[dificultad] || PERSONAJES.rapido;
