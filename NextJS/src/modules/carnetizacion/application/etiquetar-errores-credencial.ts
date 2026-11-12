/**
 * Antepone el nombre legible del campo a los errores de validación del backend
 * («Este campo no puede estar en blanco.» -> «Indique la cédula del trabajador.»),
 * para que el aviso diga QUÉ campo falla aunque se muestre en un toast general.
 */
const ETIQUETAS_BASE: Record<string, string> = {
  tipo_codigo: "el tipo de credencial",
  nombre: "el nombre",
  documento: "el documento de identidad",
  motivo: "el motivo",
  vigencia_desde: "la fecha de inicio de la vigencia",
  vigencia_hasta: "la fecha de fin de la vigencia",
  correo: "el correo",
  empresa: "la empresa",
  contrato: "el contrato",
  persona_visitada: "la persona visitada",
  empleado_cedula: "la cédula del trabajador",
  observaciones: "las observaciones",
};

const ETIQUETAS_TEMPORAL: Record<string, string> = {
  documento: "la cédula del trabajador",
  vigencia_hasta: "las horas de vigencia",
  nombre: "el nombre del trabajador",
};

export interface ErrorConCampos {
  error: string;
  errores?: Record<string, string[]>;
}

export function mensajeErrorCredencial(r: ErrorConCampos, temporal = false): string {
  const errores = r.errores;
  if (!errores) return r.error;
  const partes: string[] = [];
  for (const [campo, mensajes] of Object.entries(errores)) {
    const etiqueta = (temporal ? ETIQUETAS_TEMPORAL[campo] : undefined) ?? ETIQUETAS_BASE[campo];
    const texto = (mensajes ?? []).join(" ");
    if (!texto) continue;
    const vacio = /en blanco|requerido|obligatorio|nulo/i.test(texto);
    partes.push(
      etiqueta && vacio ? `Indique ${etiqueta}.` : etiqueta ? `${capitalizar(etiqueta)}: ${texto}` : texto,
    );
  }
  return partes.length ? partes.join(" ") : r.error;
}

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
