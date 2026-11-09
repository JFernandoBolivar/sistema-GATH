/**
 * @deprecated Consolidado en F2.12 (MED-10). Importar de `@/shared/validation/regex`
 * en código nuevo. Este archivo se conserva como re-export para no romper los imports
 * existentes; se elimina en la Fase 4 cuando cada módulo migre sus schemas.
 */
import {
  NAME,
  DIGITS,
  SAFE_TEXT,
  EMAIL,
  PHONE_VE,
  PHONE_VE_FIJO,
} from "@/shared/validation/regex";

export const REGEX_LETTERS = NAME;
export const REGEX_NUMBERS = DIGITS;
export const REGEX_ALPHANUMERIC = SAFE_TEXT;
export const REGEX_LETTERS_STRICT = NAME;
export const REGEX_EMAIL = EMAIL;
export const REGEX_PHONE_VENEZUELA = PHONE_VE;
export const REGEX_PHONE_VENEZUELA_FIJO = PHONE_VE_FIJO;

