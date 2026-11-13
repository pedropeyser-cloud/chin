// CHIN, completo, con el shape del contrato de plataforma (docs/contrato-juego.md).
import * as motor from "./motor.js";
import { bot } from "./bot.js";
import { montarMesa } from "./mesa.js";
import { crearLocal } from "./local.js";

export const chin = {
  ...motor.juego,
  bot,
  descripcion: "Dos pilas, dos mazos, un solo grito. Gana el que más rápido canta CHIN.",
  estado: "listo",
  /** ctx: { fuente?, dificultad?, salir, otraDificultad } — sin `fuente` juega contra el bot en este navegador. */
  montar(contenedor, ctx = {}) {
    const fuente = ctx.fuente || crearLocal({ dificultad: ctx.dificultad, nombre: ctx.nombre, estilo: ctx.estilo });
    ctx.alCrear?.(fuente);
    const desmontar = montarMesa(contenedor, { fuente, salir: ctx.salir, otraDificultad: ctx.otraDificultad, alFin: ctx.alFin });
    return () => { desmontar(); fuente.destruir(); };
  },
};
