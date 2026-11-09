/**
 * Teléfonos con código de país (D-13, FIX-TLF15).
 *
 * Regla única para todos los formularios: el número se guarda en formato
 * internacional E.164 (`+584121234567`) y se valida con las reglas de cada país
 * (cantidad de dígitos y tipo) de libphonenumber.
 * Para Venezuela acepta lo que la gente escribe: `0412-1234567`, `4121234567`, `0212 1234567` o `+58 412…`.
 * Para otros países: deriva dinámicamente ejemplo, longitud y validación de tipo (móvil vs fijo).
 * El backend aplica la misma regla (`core/domain/validacion_personas.py`).
 */
import { z } from "zod";
import {
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import examplesMobile from "libphonenumber-js/examples.mobile.json";

export type TipoTelefono = "movil" | "fijo" | "cualquiera";

/** Códigos de las operadoras móviles de Venezuela, con su operadora. */
export const OPERADORAS_VE: Record<string, string> = {
  "0412": "Digitel",
  "0414": "Movistar",
  "0416": "Movilnet",
  "0422": "Digitel",
  "0424": "Movistar",
  "0426": "Movilnet",
};

/** Códigos de área de la telefonía fija de Venezuela, con su zona. */
export const ZONAS_VE: Record<string, string> = {
  "0212": "Caracas (Distrito Capital)",
  "0234": "Miranda",
  "0235": "Guárico",
  "0238": "Guárico",
  "0239": "Miranda",
  "0241": "Carabobo (Valencia)",
  "0242": "Carabobo (Puerto Cabello)",
  "0243": "Aragua (Maracay)",
  "0244": "Aragua",
  "0245": "Carabobo",
  "0246": "Guárico",
  "0247": "Apure",
  "0248": "Amazonas",
  "0249": "Carabobo",
  "0251": "Lara (Barquisimeto)",
  "0252": "Lara",
  "0253": "Lara",
  "0254": "Yaracuy",
  "0255": "Portuguesa",
  "0256": "Portuguesa",
  "0257": "Portuguesa",
  "0258": "Cojedes",
  "0259": "Falcón",
  "0261": "Zulia (Maracaibo)",
  "0262": "Zulia",
  "0263": "Zulia",
  "0264": "Zulia",
  "0265": "Zulia",
  "0266": "Zulia",
  "0267": "Zulia",
  "0268": "Falcón (Coro)",
  "0269": "Falcón (Punto Fijo)",
  "0271": "Zulia / Mérida / Trujillo",
  "0272": "Trujillo",
  "0273": "Barinas",
  "0274": "Mérida",
  "0275": "Mérida / Táchira",
  "0276": "Táchira (San Cristóbal)",
  "0277": "Táchira",
  "0278": "Barinas / Apure",
  "0279": "Falcón",
  "0281": "Anzoátegui (Barcelona)",
  "0282": "Anzoátegui",
  "0283": "Anzoátegui",
  "0284": "Bolívar",
  "0285": "Bolívar (Ciudad Bolívar)",
  "0286": "Bolívar (Guayana)",
  "0287": "Delta Amacuro",
  "0288": "Bolívar",
  "0289": "Bolívar",
  "0291": "Monagas (Maturín)",
  "0292": "Monagas",
  "0293": "Sucre (Cumaná)",
  "0294": "Sucre",
  "0295": "Nueva Esparta",
};

export const PREFIJOS_MOVIL_VE = Object.keys(OPERADORAS_VE);
export const PREFIJOS_FIJO_VE = Object.keys(ZONAS_VE);

/** Separa un número nacional venezolano en código (0412, 0212…) y los 7 dígitos restantes. */
export function separarPrefijoVE(nacional: string): { prefijo: string; numero: string } {
  const digitos = nacional.replace(/\D/g, "").replace(/^0/, "");
  const prefijo = `0${digitos.slice(0, 3)}`;
  const conocidos: readonly string[] = [...PREFIJOS_MOVIL_VE, ...PREFIJOS_FIJO_VE];
  if (digitos.length >= 3 && conocidos.includes(prefijo)) {
    return { prefijo, numero: digitos.slice(3) };
  }
  return { prefijo: "", numero: digitos };
}

export const PAIS_POR_DEFECTO: CountryCode = "VE";

export type ResultadoTelefono = { ok: true; e164: string | null } | { ok: false; mensaje: string };

const SEPARADORES = /[\s().\-]/g;

export const MENSAJE_TELEFONO_OBLIGATORIO = "El teléfono es obligatorio";
const MENSAJE_SOLO_NUMEROS =
  "El teléfono solo admite números (y + al inicio para el código de país)";
const MENSAJE_VE = "Número venezolano inválido. Ejemplos: móvil 0412-1234567, fijo 0212-1234567";
const MENSAJE_NO_MOVIL =
  "Debe ser un número móvil (en Venezuela: 0412, 0414, 0416, 0422, 0424 o 0426)";

export function nombrePais(codigo: CountryCode): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/**
 * Obtiene los metadatos de ejemplo, longitud y prefijo inicial para un país (FIX-TLF15).
 */
export function obtenerEjemploTelefono(
  pais: CountryCode,
): { digitos: number; ejemplo: string; primerDigito: string } | null {
  try {
    const ex = getExampleNumber(pais, examplesMobile);
    if (!ex) return null;
    const digitos = ex.nationalNumber.length;
    const primerDigito = ex.nationalNumber[0] || "";
    const fmt = ex.formatNational();
    // Limpiar 0 inicial en formatos como "067 212 3456" para dejar "67 212 3456"
    const ejemplo = fmt.startsWith("0") && !fmt.startsWith("04") && !fmt.startsWith("02")
      ? fmt.slice(1).trim()
      : fmt;
    return { digitos, ejemplo, primerDigito };
  } catch {
    return null;
  }
}

/**
 * Genera el texto de ayuda según el país y tipo de teléfono seleccionado (FIX-TLF15).
 */
export function obtenerAyudaTelefono(
  pais: CountryCode = PAIS_POR_DEFECTO,
  tipo: TipoTelefono = "cualquiera",
): string {
  if (pais === "VE") {
    if (tipo === "movil") {
      return "Ejemplo: 0412-1234567, 0414-9876543 o 0416-5551234 (11 dígitos).";
    }
    if (tipo === "fijo") {
      return "Ejemplo: 0212-5551234 o 0241-8765432 (con código de área).";
    }
    return "Ejemplo: móvil 0412-1234567, fijo 0212-5551234.";
  }

  const nombre = nombrePais(pais);
  const prefijo = `+${getCountryCallingCode(pais)}`;
  const ex = obtenerEjemploTelefono(pais);

  if (!ex) {
    return `Escriba el número de ${nombre} (${prefijo}) con su código de área local.`;
  }

  if (tipo === "movil") {
    return `Ejemplo para celular de ${nombre} (${prefijo}): ${ex.ejemplo} (${ex.digitos} dígitos).`;
  }
  return `Ejemplo para ${nombre} (${prefijo}): ${ex.ejemplo} (${ex.digitos} dígitos).`;
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
  const destino = numero?.country ?? pais;
  const nombreDestino = nombrePais(destino);
  const prefijoDestino = `+${getCountryCallingCode(destino)}`;

  if (!numero || !numero.isValid()) {
    if (destino === "VE") {
      return { ok: false, mensaje: MENSAJE_VE };
    }
    const ex = obtenerEjemploTelefono(destino);
    if (ex) {
      return {
        ok: false,
        mensaje: `Número inválido para ${nombreDestino} (${prefijoDestino}): se esperan ${ex.digitos} dígitos.`,
      };
    }
    return {
      ok: false,
      mensaje: `Número inválido para ${nombreDestino} (${prefijoDestino}). Revise la cantidad de dígitos.`,
    };
  }

  const clase = numero.getType();

  if (tipo === "movil") {
    if (clase === "FIXED_LINE") {
      if (destino === "VE") {
        return {
          ok: false,
          mensaje:
            "Este número parece un teléfono fijo. Para celular de Venezuela se esperan 11 dígitos que empiezan por 04 (ej.: 0412-1234567).",
        };
      }
      const ex = obtenerEjemploTelefono(destino);
      if (ex) {
        return {
          ok: false,
          mensaje: `Este número parece un teléfono fijo. Para celular de ${nombreDestino} se esperan ${ex.digitos} dígitos que empiezan por ${ex.primerDigito} (ej.: ${ex.ejemplo}).`,
        };
      }
      return { ok: false, mensaje: MENSAJE_NO_MOVIL };
    }

    if (clase !== "MOBILE" && clase !== "FIXED_LINE_OR_MOBILE") {
      return { ok: false, mensaje: MENSAJE_NO_MOVIL };
    }
  }

  if (tipo === "fijo") {
    if (clase === "MOBILE") {
      if (destino === "VE") {
        return {
          ok: false,
          mensaje:
            "Este número parece un teléfono celular. Para teléfono de habitación en Venezuela use un código de área (ej.: 0212-1234567).",
        };
      }
      return {
        ok: false,
        mensaje: `Este número parece un teléfono celular. Para teléfono de habitación de ${nombreDestino} use un número fijo.`,
      };
    }
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
