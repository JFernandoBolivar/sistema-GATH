import type { CambioEntity, DecisionCampo } from "../entities/solicitud-actualizacion";

export type ResultadoDecision = "TOTAL" | "PARCIAL" | "RECHAZO";

/** Cambios que aún esperan decisión (los ya decididos no se envían de nuevo). */
export function cambiosPendientes(cambios: CambioEntity[]): CambioEntity[] {
  return cambios.filter((c) => c.decision === "PENDIENTE");
}

/** Un campo en conflicto (la ficha cambió tras la propuesta) solo puede rechazarse. */
export function puedeAprobarCambio(cambio: CambioEntity): boolean {
  return !cambio.conflicto;
}

/**
 * Verifica las decisiones antes de llamar al servidor:
 * - cubrir TODOS los cambios pendientes;
 * - rechazar un campo exige motivo;
 * - un campo en conflicto no puede aprobarse;
 * - si no se aprueba ninguno, el motivo general es obligatorio.
 */
export function validarDecisiones(
  cambios: CambioEntity[],
  decisiones: DecisionCampo[],
  motivoGeneral: string,
): string[] {
  const errores: string[] = [];
  const pendientes = cambiosPendientes(cambios);
  const porId = new Map(decisiones.map((d) => [d.cambioId, d]));

  const sinDecidir = pendientes.filter((c) => !porId.has(c.id)).length;
  if (sinDecidir > 0) {
    errores.push(
      sinDecidir === 1
        ? "Falta decidir 1 campo. Apruebe o rechace cada campo."
        : `Faltan ${sinDecidir} campos por decidir. Apruebe o rechace cada campo.`,
    );
  }
  for (const c of pendientes) {
    const d = porId.get(c.id);
    if (!d) continue;
    if (d.aprobado && !puedeAprobarCambio(c)) {
      errores.push(
        `El campo «${c.campo}» cambió en la ficha después de la propuesta: solo puede rechazarse.`,
      );
    }
    if (!d.aprobado && d.motivo.trim().length === 0) {
      errores.push(`Indique el motivo del rechazo del campo «${c.campo}».`);
    }
  }
  if (pendientes.length > 0 && decisiones.every((d) => !d.aprobado) && !motivoGeneral.trim()) {
    errores.push("Si no se aprueba ningún campo, indique el motivo general del rechazo.");
  }
  return errores;
}

export function resultadoDecision(decisiones: DecisionCampo[]): ResultadoDecision {
  const aprobadas = decisiones.filter((d) => d.aprobado).length;
  if (aprobadas === 0) return "RECHAZO";
  return aprobadas === decisiones.length ? "TOTAL" : "PARCIAL";
}

export const TEXTO_RESULTADO: Record<ResultadoDecision, string> = {
  TOTAL: "Aprobación total",
  PARCIAL: "Aprobación parcial",
  RECHAZO: "Rechazo de todos los campos",
};
