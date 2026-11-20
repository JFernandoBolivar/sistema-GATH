/** Modo de espejado del reverso al imprimir un lote (B-6). */
export type ModoDuplex = "ninguno" | "largo" | "corto";

export const MODOS_DUPLEX: ReadonlyArray<{
  valor: ModoDuplex;
  etiqueta: string;
  ayuda: string;
}> = [
  {
    valor: "largo",
    etiqueta: "Doble cara · borde largo",
    ayuda: "Lo habitual en hojas verticales: la impresora voltea por el lado largo.",
  },
  {
    valor: "corto",
    etiqueta: "Doble cara · borde corto",
    ayuda: "La impresora voltea por el lado corto de la hoja.",
  },
  {
    valor: "ninguno",
    etiqueta: "Una cara o sin espejado",
    ayuda: "Para imprimir frentes y reversos por separado sin invertir la hoja.",
  },
];

export const MODO_DUPLEX_POR_DEFECTO: ModoDuplex = "largo";
