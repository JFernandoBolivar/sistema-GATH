/**
 * @deprecated Consolidado en F2.12 (MED-10). Importar de `@/shared/validation/regex`
 * en código nuevo. Este archivo se conserva como re-export para no romper los imports
 * existentes; se elimina en la Fase 4 cuando cada módulo migre sus schemas.
 */
export {
  REGEX_LETTERS,
  REGEX_NUMBERS,
  REGEX_ALPHANUMERIC,
  REGEX_LETTERS_STRICT,
  REGEX_EMAIL,
  REGEX_PHONE_VENEZUELA,
  REGEX_PHONE_VENEZUELA_FIJO,
} from "@/shared/validation/regex";
