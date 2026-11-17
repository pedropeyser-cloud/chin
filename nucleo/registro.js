// Catálogo de juegos de la plataforma. Sumar un juego = agregar su carpeta en juegos/<id>/ y una fila acá.
// estado: "listo" (se juega acá) | "enlace" (vive en otra dirección) | "pronto" (anunciado, no se puede jugar).
// `abrir` trae las pantallas del juego recién cuando se lo toca (import dinámico): { menu(app, ctx), entrar(app, codigo, ctx), cerrar() }.
export const JUEGOS = [
  {
    id: "chin", nombre: "CHIN", jugadores: [2, 2], estado: "listo",
    descripcion: "Dos pilas, dos mazos, un solo grito. Gana el que más rápido canta.",
    abrir: () => import("../juegos/chin/flujo.js"),
  },
  {
    id: "escoba", nombre: "Escoba de 15", jugadores: [2, 2], estado: "listo",
    descripcion: "Levantá cartas que sumen 15 con la tuya. Si dejás la mesa vacía, escoba.",
    abrir: () => import("../juegos/escoba/flujo.js"),
  },
  {
    id: "canasta", nombre: "Canasta", jugadores: [2, 2], estado: "listo",
    descripcion: "Juntá siete iguales y armá canastas. Con dos, te vas.",
    abrir: () => import("../juegos/canasta/flujo.js"),
  },
  {
    id: "truco", nombre: "Truco", jugadores: [2, 6], estado: "enlace",
    descripcion: "El truco argentino con amigos: 1 contra 1 y mesas de 4 y 6 con señas.",
    url: "https://pedropeyser-cloud.github.io/truco/",
  },
];
export const juegoPorId = (id) => JUEGOS.find((j) => j.id === id) || null;
