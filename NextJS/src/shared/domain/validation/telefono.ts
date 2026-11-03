/**
 * Teléfonos con código de país (D-13, aprobado 2026-11-03).
 *
 * Regla única para todos los formularios: el número se guarda en formato
 * internacional E.164 (`+584121234567`) y se valida con las reglas de cada país
 * (cantidad de dígitos y tipo) de libphonenumber. Para Venezuela acepta lo que la
 * gente escribe: `0412-1234567`, `4121234567`, `0212 1234567` o `+58 412…`.
 * El backend aplica la misma regla (`core/domain/validacion_personas.py`).
 */
import { z } from "zod";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export type TipoTelefono = "movil" | "cualquiera";
export const PAIS_POR_DEFECTO: CountryCode = "VE";

export type ResultadoTelefono = { ok: true; e164: string | null } | { ok: false; mensaje: string };

const SEPARADORES = /[\s().\-]/g;

export const MENSAJE_TELEFONO_OBLIGATORIO = "El teléfono es obligatorio";
const MENSAJE_SOLO_NUMEROS =
  "El teléfono solo admite números (y + al inicio para el código de país)";
const MENSAJE_VE = "Número venezolano inválido. Ejemplos: móvil 0412-1234567, fijo 0212-1234567";
const MENSAJE_NO_MOVIL =
  "Debe ser un número móvil (en Venezuela: 0412, 0414, 0416, 0422, 0424 o 0426)";

function nombrePais(codigo: CountryCode): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/** Valida y normaliza a E.164. Vacío es válido (`e164: null`): la obligatoriedad la decide el formulario. */
export function normalizarTelefono(
  valor: string | null | undefined,
  {
    tipo = "cualquiera",
    pais = PAIS_POR_DEFECTO,
  }: { tipo?: TipoTelefono; pais?: CountryCode } = {},
): ResultadoTelefono {
  const limpio = (valor ?? "").trim().replace(SEPARADORES, "");
  if (!limpio) return { ok: true, e164: null };
  if (!/^\+?\d+$/.test(limpio)) return { ok: false, mensaje: MENSAJE_SOLO_NUMEROS };

  const numero = parsePhoneNumberFromString(limpio, pais);
  if (!numero || !numero.isValid()) {
    const destino = numero?.country ?? pais;
    return {
      ok: false,
      mensaje:
        destino === "VE"
          ? MENSAJE_VE
          : `Número inválido para ${nombrePais(destino)} (+${getCountryCallingCode(destino)}). Revise la cantidad de dígitos.`,
    };
  }
  if (tipo === "movil") {
    const clase = numero.getType();
    if (clase !== "MOBILE" && clase !== "FIXED_LINE_OR_MOBILE")
      return { ok: false, mensaje: MENSAJE_NO_MOVIL };
  }
  return { ok: true, e164: numero.number };
}

/** Para mostrar: `+58 412 1234567`. Si el valor guardado no es un teléfono válido, se muestra tal cual. */
export function formatearTelefono(valor: string | null | undefined): string {
  const texto = (valor ?? "").trim();
  if (!texto) return "";
  const numero = parsePhoneNumberFromString(texto.replace(SEPARADORES, ""), PAIS_POR_DEFECTO);
  return numero?.isValid() ? numero.formatInternational() : texto;
}

/** Separa un valor guardado (E.164 o legado venezolano) en país y número nacional para editarlo. */
export function separarTelefono(valor: string | null | undefined): {
  pais: CountryCode;
  nacional: string;
} {
  const texto = (valor ?? "").trim().replace(SEPARADORES, "");
  if (!texto) return { pais: PAIS_POR_DEFECTO, nacional: "" };
  const numero = parsePhoneNumberFromString(texto, PAIS_POR_DEFECTO);
  if (numero?.country) return { pais: numero.country, nacional: String(numero.nationalNumber) };
  return { pais: PAIS_POR_DEFECTO, nacional: texto.replace(/\D/g, "") };
}

/** Si el texto viene con «+código», devuelve su país y número nacional (para el selector). */
export function paisDesdeInternacional(
  texto: string,
): { pais: CountryCode; nacional: string } | null {
  const limpio = texto.trim().replace(SEPARADORES, "");
  if (!limpio.startsWith("+")) return null;
  const numero = parsePhoneNumberFromString(limpio.replace(/[^\d+]/g, ""));
  if (!numero?.country) return null;
  return { pais: numero.country, nacional: String(numero.nationalNumber) };
}

/** Une país y número nacional en el valor que guarda el formulario (E.164 si es posible). */
export function unirTelefono(pais: CountryCode, nacional: string): string {
  const digitos = nacional.replace(/\D/g, "");
  if (!digitos) return "";
  const numero = parsePhoneNumberFromString(digitos, pais);
  return numero ? numero.number : `+${getCountryCallingCode(pais)}${digitos}`;
}

export interface PaisTelefono {
  codigo: CountryCode;
  nombre: string;
  prefijo: string;
}

let paisesCache: PaisTelefono[] | null = null;

/** Países con su código, ordenados por nombre y con Venezuela primero. */
export function paisesTelefono(): PaisTelefono[] {
  if (paisesCache) return paisesCache;
  const lista = getCountries()
    .map((codigo) => ({
      codigo,
      nombre: nombrePais(codigo),
      prefijo: `+${getCountryCallingCode(codigo)}`,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const ve = lista.findIndex((p) => p.codigo === PAIS_POR_DEFECTO);
  if (ve > 0) lista.unshift(...lista.splice(ve, 1));
  paisesCache = lista;
  return lista;
}

/** Campo zod de teléfono: valida con la regla por país; acepta vacío salvo que sea `requerido`. */
export function telefonoZod({
  requerido = false,
  tipo = "cualquiera",
}: { requerido?: boolean; tipo?: TipoTelefono } = {}) {
  return z
    .string()
    .trim()
    .optional()
    .nullable()
    .superRefine((valor, ctx) => {
      if (!valor) {
        if (requerido)
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_TELEFONO_OBLIGATORIO });
        return;
      }
      const resultado = normalizarTelefono(valor, { tipo });
      if (!resultado.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: resultado.mensaje });
    });
}
