/**
 * Regex globales reutilizables del kernel de dominio (F2.12, skill
 * `validacion-input-protegido`). Viven en `shared/domain` porque son puros
 * (cero dependencias de React / Next / I/O): la capa `domain` de los módulos
 * puede importarlos sin violar R1. Todo schema Zod en `ui/schema/` y toda
 * Server Action que re-valide datos de entrada también debe importar de aquí —
 * cero regex inline.
 *
 * `@/shared/validation` re-exporta desde este módulo para preservar la ruta
 * histórica; el fuente canónico es `shared/domain/validation`.
 */

// --- Identificación venezolana ---

/** Cédula de identidad: V/E/J/P/G + 6 a 9 dígitos. */
export const CEDULA = /^[VEJPG]\d{6,9}$/;
export const CEDULA_MSG = "Debe ser una letra (V/E/J/P/G) seguida de 6 a 9 dígitos";

/** RIF: letra (J/G/V/E) + guión + 8 dígitos + guión + 1 dígito verificador. */
export const RIF = /^[JPGVE]-\d{8}-\d$/;
export const RIF_MSG = "Formato inválido. Ejemplo: J-12345678-9";

// --- Contacto ---

/** Email estándar. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MSG = "Correo electrónico inválido";

/** Identificador de login: correo electrónico, usuario institucional o cédula venezolana */
export const USUARIO_LOGIN = /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9._-]{3,50})$/;
export const USUARIO_LOGIN_MSG = "Ingrese un usuario válido, correo institucional o cédula";

/** Teléfono móvil Venezuela: prefijo válido + 7 dígitos. */
export const PHONE_VE = /^(0414|0412|0416|0422|0424|0426|0415)\d{7}$/;
export const PHONE_VE_MSG = "Teléfono inválido. Formato: 04121234567";

/** Teléfono fijo Venezuela: código de área + 7 dígitos. */
export const PHONE_VE_FIJO =
  /^(0212|0234|0235|0239|0241|0242|0243|0244|0246|0247|0248|0251|0252|0254|0255|0257|0258|0261|0263|0264|0268|0269|0271|0273|0274|0275|0276|0277|0278|0281|0282|0283|0285|0286|0287|0288|0289|0291|0293|0294|0295)\d{7}$/;
export const PHONE_VE_FIJO_MSG = "Teléfono fijo inválido";

// --- Texto general ---

/** Nombres/apellidos: letras (con acentos y ñ) y espacios. */
export const NAME = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]{2,100}$/;
export const NAME_MSG = "Solo letras y espacios (2 a 100 caracteres)";

/** Texto seguro para descripciones/observaciones: sin HTML ni caracteres de control. */
export const SAFE_TEXT = /^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-,.#;:()/ºª!?@]+$/;
export const SAFE_TEXT_MSG = "Contiene caracteres no permitidos";

// --- Seguridad ---

/** Contraseña: mayúscula + minúscula + número + carácter especial, mínimo 8. */
export const PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
export const PASSWORD_MSG =
  "Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial";

/** Sin etiquetas HTML ni XML. */
export const NO_HTML = /^[^<>&"]*$/;
export const NO_HTML_MSG = 'No se permiten caracteres HTML (< > & ")';

// --- Numéricos ---

/** Solo dígitos (uno o más). */
export const DIGITS = /^\d+$/;
export const DIGITS_MSG = "Solo números";

// --- Fechas ---

/** Fecha ISO: YYYY-MM-DD. */
export const DATE_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const DATE_ISO_MSG = "Fecha inválida. Formato: YYYY-MM-DD";

export const REGEX = {
  CEDULA,
  CEDULA_DIGITOS: DIGITS,
  RIF,
  EMAIL,
  USUARIO_LOGIN,
  PHONE_VE,
  TELEFONO: PHONE_VE,
  PHONE_VE_FIJO,
  NAME,
  SOLO_LETRAS: NAME,
  SAFE_TEXT,
  PASSWORD,
  NO_HTML,
  DIGITS,
  DATE_ISO,
  FECHA_ISO: DATE_ISO,
};

/** Mensajes de error reutilizables para schemas Zod y Server Actions (F2.12). */
export const ERROR = {
  REQUIRED: "Este campo es requerido",
  MIN_LENGTH: (min: number) => `Mínimo ${min} caracteres`,
  MAX_LENGTH: (max: number) => `Máximo ${max} caracteres`,
  INVALID_EMAIL: "Correo electrónico inválido",
  INVALID_USUARIO: "Ingrese un usuario válido, correo institucional o cédula",
  INVALID_PASSWORD:
    "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial",
  INVALID_CEDULA: "Cédula inválida. Debe ser V/E/J/P/G seguido de 6 a 9 dígitos",
  INVALID_RIF: "RIF inválido. Formato: J-12345678-9",
  INVALID_PHONE: "Teléfono inválido. Formato: 04121234567",
  INVALID_DATE: "Fecha inválida. Formato: YYYY-MM-DD",
  INVALID_NUMBER: "Debe ser un número",
  ONLY_LETTERS: "Solo se permiten letras",
  ONLY_DIGITS: "Solo se permiten números",
  NO_HTML: "No se permiten etiquetas HTML",
  PASSWORDS_DONT_MATCH: "Las contraseñas no coinciden",
} as const;
