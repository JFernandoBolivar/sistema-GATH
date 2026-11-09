/**
 * Value Objects de credenciales (paso 1 del checklist §II.8). Valida su
 * invariante en la construcción y es inmutable. Cero regex inline: los formatos
 * provienen de `@/shared/validation/regex` y los mensajes de `messages.ts`.
 *
 * Nota de dominio: el usuario de GATH se autentica por correo institucional — el
 * endpoint legado del backend recibe `{ correo, password }` (ver auth.config.ts).
 */
import { EMAIL, EMAIL_MSG, NO_HTML, NO_HTML_MSG, ERROR } from "@/shared/domain/validation";

export type UsuarioVO = {
  readonly value: string;
};

/** Construye un UsuarioVO válido (correo institucional normalizado). */
export function crearUsuarioVO(valor: string): UsuarioVO {
  const normalizado = valor.trim().toLowerCase();
  if (!normalizado || !EMAIL.test(normalizado)) {
    throw new Error(EMAIL_MSG);
  }
  return { value: normalizado };
}

export type PasswordVO = {
  readonly value: string;
};

/**
 * Construye un PasswordVO de una **contraseña existente** (login o contraseña
 * actual). No impone la longitud mínima de la política: la clave inicial de una
 * cuenta es la cédula y hay cédulas de 5 o 6 dígitos. Solo exige presencia,
 * cota máxima y ausencia de HTML/caracteres de control.
 */
export function crearPasswordExistenteVO(valor: string): PasswordVO {
  if (!valor || valor.trim().length === 0) {
    throw new Error(ERROR.REQUIRED);
  }
  if (valor.length > 128) {
    throw new Error(ERROR.MAX_LENGTH(128));
  }
  if (!NO_HTML.test(valor)) {
    throw new Error(NO_HTML_MSG);
  }
  return { value: valor };
}

/**
 * Construye un PasswordVO de una **contraseña nueva**. Exige la longitud mínima
 * de la política (8) y la máxima (32); además no admite HTML/caracteres de
 * control.
 */
export function crearPasswordVO(valor: string): PasswordVO {
  if (!valor || valor.trim().length === 0) {
    throw new Error(ERROR.REQUIRED);
  }
  if (valor.length < 8 || valor.length > 32) {
    throw new Error(`${ERROR.MIN_LENGTH(8)} y ${ERROR.MAX_LENGTH(32).toLowerCase()}`);
  }
  if (!NO_HTML.test(valor)) {
    throw new Error(NO_HTML_MSG);
  }
  return { value: valor };
}
