/**
 * Reingreso de un jubilado o pensionado (C-9): qué ocurrirá al contratarlo según la opción que su expediente guardó al
 * abrirse (`captacion.reingreso_pasivo`). Un valor desconocido cuenta como «permitir», el comportamiento de siempre.
 */
const AL_CONTRATAR: Readonly<Record<string, string>> = {
  permitir: "Al contratarlo, su registro de pasivo se deja como está.",
  cerrar_al_contratar: "Al contratarlo, el sistema cerrará su condición de pasivo (egreso del pasivo) en la misma operación.",
  no_permitir: "Este expediente se abrió bajo la opción de no admitir pasivos.",
};

export function avisoReingresoPasivo(valor: string): string {
  return AL_CONTRATAR[valor] ?? AL_CONTRATAR.permitir;
}
