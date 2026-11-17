// CANASTA, con el shape del contrato de plataforma (docs/contrato-juego.md).
import * as motor from "./motor.js";
import { bot } from "./bot.js";
import { montarMesa } from "./mesa.js";
import { crearLocal } from "./local.js";

export const canasta = {
  ...motor.juego,
  bot,
  descripcion: "Juntá siete iguales y armá canastas. Con dos, te vas.",
  estado: "listo",
  /** ctx: { fuente?, dificultad?, nombre?, estilo?, salir, otraDificultad?, alFin?, alCrear? }. Sin `fuente` juega contra el bot. */
  montar(contenedor, ctx = {}) {
    const fuente = ctx.fuente || crearLocal({ dificultad: ctx.dificultad, nombre: ctx.nombre, estilo: ctx.estilo, semilla: ctx.semilla });
    ctx.alCrear?.(fuente);
    const desmontar = montarMesa(contenedor, { fuente, salir: ctx.salir, otraDificultad: ctx.otraDificultad, alFin: ctx.alFin });
    return () => { desmontar(); fuente.destruir(); };
  },
};
