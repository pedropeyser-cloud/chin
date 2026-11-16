// Los tres bots de CHIN, uno por dificultad (2026-11-16): nombre, cara y frases propias.
// Hablan en un globito junto a su cara en momentos puntuales, sin tapar el juego (ver `decir` en local.js).
// Don Tranqui: pachorriento, de mate y siesta. Rata: canchero, chicanero, se agranda. El Relámpago: seco, de pocas palabras.

export const PERSONAJES = {
  tranquilo: {
    nombre: "Don Tranqui", cara: 3, lema: "te da tiempo",
    frases: {
      empieza: ["Despacito, que no hay apuro.", "Dejame cebar uno y arrancamos.", "A ver qué me tocó…"],
      gana_chin: ["¡Uh, chin! Ni me di cuenta.", "Mirá vos, lo vi yo primero.", "Hasta un reloj parado acierta dos veces."],
      pierde_chin: ["Y bueno, la siesta pesa.", "Ahí se me fue, estaba mirando el mate.", "Muy rápido para mí, che."],
      trabado: ["Uh, se trabó. Tocá el mazo, dale."],
      gana: ["¡Gané! No lo puedo creer ni yo.", "Despacio se llega lejos, viste."],
      pierde: ["Bien jugado, pibe. Otro mate y la revancha.", "Me ganaste limpito."],
    },
  },
  rapido: {
    nombre: "Rata", cara: 4, lema: "no se duerme",
    frases: {
      empieza: ["Vamos, que no tengo toda la noche.", "Preparate que hoy estoy finito.", "¿Ya estás? Yo hace rato."],
      gana_chin: ["¡Chin! Ni lo viste venir.", "Más rápido que vos, mirá.", "Llevate esas, regalito de la casa."],
      pierde_chin: ["Ah, bueno, se despertó.", "Suerte de principiante.", "Esa te la dejé, eh."],
      trabado: ["Trabadísimo. Tocá el mazo, que no muerdo."],
      gana: ["¿Viste? Cancha es cancha.", "Volvé cuando entrenes."],
      pierde: ["Bueno, bueno… hoy tenés el día.", "La próxima no te la dejo."],
    },
  },
  implacable: {
    nombre: "El Relámpago", cara: 5, lema: "casi no falla",
    frases: {
      empieza: ["Listo.", "Cuando quieras.", "Concentrate."],
      gana_chin: ["Chin.", "Tarde.", "Lento."],
      pierde_chin: ["Bien visto.", "Hm. Rápido.", "Esa fue tuya."],
      trabado: ["Mazo."],
      gana: ["Otra vez será.", "Practicá."],
      pierde: ["Me ganaste. Respeto.", "Pocas veces pasa."],
    },
  },
};

export const personaje = (dificultad) => PERSONAJES[dificultad] || PERSONAJES.rapido;
