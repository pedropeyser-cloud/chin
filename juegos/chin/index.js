// CHIN, completo, con el shape del contrato de plataforma (docs/contrato-juego.md).
import * as motor from "./motor.js";
import { bot } from "./bot.js";
import { montarMesa } from "./mesa.js";
import { crearLocal } from "./local.js";

export const chin = {
  ...motor.juego,
  bot,
  descripcion: "Escalera para arriba o para abajo en dos pilas. Mismo número arriba: CHIN.",
  estado: "listo",
  /**
   * ctx: { fuente?, dificultad?, formato? (1|3), semilla? (desafío del día), salir, otraDificultad?, alFin?, pieFin? }
   * Sin `fuente` juega contra el bot en este navegador.
   */
  montar(contenedor, ctx = {}) {
    const fuente = ctx.fuente || crearLocal({ dificultad: ctx.dificultad, nombre: ctx.nombre, estilo: ctx.estilo, formato: ctx.formato, semilla: ctx.semilla });
    ctx.alCrear?.(fuente);
    const desmontar = montarMesa(contenedor, { fuente, salir: ctx.salir, otraDificultad: ctx.otraDificultad, alFin: ctx.alFin, pieFin: ctx.pieFin });
    return () => { desmontar(); fuente.destruir(); };
  },
};
