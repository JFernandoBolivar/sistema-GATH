// Solo letras (incluye español: tildes, ñ, Ü) y espacios
export const REGEX_LETTERS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

// Solo números (dígitos del 0 al 9)
export const REGEX_NUMBERS = /^\d+$/;

// Alfanumérico (letras y números, sin espacios)
export const REGEX_ALPHANUMERIC = /^[a-zA-Z0-9]+$/;

// Solo letras (A-Z, a-z) sin espacios ni tildes (estricto)
export const REGEX_LETTERS_STRICT = /^[a-zA-Z]+$/;
// Regex estándar para validación de emails
export const REGEX_EMAIL =
  /^$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Valida prefijos específicos y que el resto sean exactamente 7 números
export const REGEX_PHONE_VENEZUELA =
  /^$|^(0414|0412|0416|0422|0424|0426|0415)\d{7}$/;
export const REGEX_PHONE_VENEZUELA_FIJO =
  /^$|^(0212|0234|0235|0239|0241|0242|0243|0244|0246|0247|0248|0251|0252|0254|0255|0257|0258|0261|0263|0264|0268|0269|0271|0273|0274|0275|0276|0277|0278|0281|0282|0283|0285|0286|0287|0288|0289|0291|0293|0294|0295)\d{7}$/;
