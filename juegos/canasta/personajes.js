// Los tres bots de la canasta: los mismos de CHIN (nombre, cara y lema), con frases de canasta.
// Hablan en un globito junto a su cara en momentos puntuales (ver `decir` en local.js).
import { PERSONAJES as DE_CHIN } from "../chin/personajes.js";

const FRASES = {
  tranquilo: {
    empieza: ["Mezclá bien, que son dos mazos.", "A cinco mil, despacito.", "Uh, qué manito larga."],
    canasta: ["¡Canasta! Mirá vos.", "Se me armó solita.", "Siete juntitas, qué lindo."],
    canasta_rival: ["Linda canasta, eh.", "Uy, ya tenés una.", "Bien armada."],
    pozo: ["Me llevo el pozo, con permiso.", "Ah, todo esto para mí."],
    pozo_rival: ["Te llevaste medio mazo.", "Ese pozo lo quería yo."],
    cierre: ["Me voy, me voy.", "Cierro, que se enfría el mate."],
    cierre_rival: ["¿Ya te fuiste? Me agarraste con todo en la mano."],
    gana: ["¡Gané! No lo puedo creer ni yo.", "Despacio se llega lejos, viste."],
    pierde: ["Bien jugado. Otro mate y la revancha.", "Me ganaste limpito."],
  },
  rapido: {
    empieza: ["Dale, que no tengo toda la noche.", "Repartí, campeón.", "Hoy te congelo el pozo."],
    canasta: ["¡Canasta! Anotá, anotá.", "Otra más para la colección.", "Siete y a cobrar."],
    canasta_rival: ["Suerte de principiante.", "Bueno, una sola no hace verano.", "Bah."],
    pozo: ["Pozo para la casa.", "Gracias por juntármelo.", "Todo esto es mío."],
    pozo_rival: ["Llevátelo, igual no te alcanza.", "Te lo dejé a propósito."],
    cierre: ["¡Me voy! Contá lo que te quedó.", "Chau, cerré."],
    cierre_rival: ["Te fuiste justo cuando la tenía.", "Bueno, bueno…"],
    gana: ["¿Viste? Cancha es cancha.", "Volvé cuando entrenes."],
    pierde: ["Hoy tenés el día.", "La próxima no te la dejo."],
  },
  implacable: {
    empieza: ["Listo.", "Repartí.", "A cinco mil."],
    canasta: ["Canasta.", "Una.", "Cerrada."],
    canasta_rival: ["Bien.", "Hm.", "Anotala."],
    pozo: ["Pozo.", "Lo esperaba."],
    pozo_rival: ["Bien visto."],
    cierre: ["Me voy.", "Cierro."],
    cierre_rival: ["Bien cerrado."],
    gana: ["Otra vez será.", "Contá las cartas."],
    pierde: ["Me ganaste. Respeto.", "Pocas veces pasa."],
  },
};

export const PERSONAJES = Object.fromEntries(Object.entries(DE_CHIN).map(([k, p]) => [k, { nombre: p.nombre, cara: p.cara, lema: p.lema, frases: FRASES[k] }]));
export const personaje = (dificultad) => PERSONAJES[dificultad] || PERSONAJES.rapido;
