/**
 * Validación Zod de los parámetros del sistema (D9). El rango y el tipo salen
 * del propio parámetro que devuelve el servidor; el backend vuelve a validar.
 */
import { z } from "zod";

import type { ParametroDTO } from "../../application/dtos/parametro-dto";
import {
  CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
  CLAVE_FE_DE_VIDA_RECORDATORIOS,
} from "../../domain/value-objects/claves-parametros";

const MAX_DIAS_RECORDATORIO = 365;
const MAX_RECORDATORIOS = 10;

export const valorParametroSchema = z.object({
  valor: z
    .string()
    .trim()
    .min(1, "El valor no puede quedar vacío.")
    .max(255, "El valor no puede superar 255 caracteres."),
});

export type ValorParametroForm = z.infer<typeof valorParametroSchema>;

/** Devuelve el mensaje de error o `null` si el valor es válido para el parámetro. */
export function validarValorParametro(parametro: ParametroDTO, valor: string): string | null {
  if (parametro.clave === CLAVE_CARNETIZACION_MI_CARNET_USUARIOS) {
    const limpio = (valor ?? "").trim();
    return limpio.length > 255 ? "El valor no puede superar 255 caracteres." : null;
  }
  const base = valorParametroSchema.safeParse({ valor });
  if (!base.success) {
    return base.error.issues[0]?.message ?? "Valor inválido.";
  }
  const texto = base.data.valor;

  if (parametro.tipo === "booleano") {
    return texto === "true" || texto === "false"
      ? null
      : "Seleccione verdadero o falso.";
  }
  if (parametro.opciones.length > 0) {
    const permitido =
      texto === parametro.valor || parametro.opciones.some((o) => o.valor === texto);
    return permitido ? null : "Seleccione una de las opciones.";
  }
  if (parametro.tipo === "entero") {
    if (!/^-?\d+$/.test(texto)) return "Escriba un número entero.";
    const numero = Number(texto);
    if (parametro.minimo !== null && numero < parametro.minimo) {
      return `El valor mínimo es ${parametro.minimo}.`;
    }
    if (parametro.maximo !== null && numero > parametro.maximo) {
      return `El valor máximo es ${parametro.maximo}.`;
    }
    return null;
  }
  if (parametro.clave === CLAVE_FE_DE_VIDA_RECORDATORIOS) {
    const partes = texto.split(",").map((parte) => parte.trim()).filter(Boolean);
    if (!partes.length) return "Indique al menos un día.";
    const dias = new Set<number>();
    for (const parte of partes) {
      if (!/^\d+$/.test(parte)) return "Separe los días con comas, por ejemplo 30,15,7.";
      const dia = Number(parte);
      if (dia < 1 || dia > MAX_DIAS_RECORDATORIO) {
        return `Cada día debe estar entre 1 y ${MAX_DIAS_RECORDATORIO}.`;
      }
      dias.add(dia);
    }
    if (dias.size > MAX_RECORDATORIOS) {
      return `No se pueden configurar más de ${MAX_RECORDATORIOS} días.`;
    }
  }
  return null;
}

/**
 * Texto legible de un valor: la etiqueta de su opción («1 año», «Nunca») o, si el
 * valor guardado no está en la lista, «N días (personalizado)».
 */
export function etiquetaValorParametro(parametro: ParametroDTO, valor: string): string {
  if (parametro.opciones.length === 0) return valor;
  const opcion = parametro.opciones.find((o) => o.valor === valor);
  if (opcion) return opcion.etiqueta;
  return /^\d+$/.test(valor) ? `${valor} días (personalizado)` : valor;
}

/** Normaliza el texto que se envía al servidor (días ordenados y sin repetir). */
export function normalizarValorParametro(parametro: ParametroDTO, valor: string): string {
  const texto = valor.trim();
  if (parametro.clave !== CLAVE_FE_DE_VIDA_RECORDATORIOS) return texto;
  const dias = [...new Set(
    texto.split(",").map((parte) => Number(parte.trim())).filter((n) => Number.isInteger(n) && n > 0),
  )].sort((a, b) => b - a);
  return dias.join(",");
}
