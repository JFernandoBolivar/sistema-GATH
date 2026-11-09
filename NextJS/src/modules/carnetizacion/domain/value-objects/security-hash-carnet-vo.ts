/**
 * Value Object security hash del carnet. Formato alineado al legado
 * (`security_hash`): cadena de 32 caracteres hexadecimales (hash MD5) o la
 * cadena "synced". Impone el invariante en la construcción.
 */
export type SecurityHashCarnetVO = {
  readonly value: string;
};

const HASH_HEX = /^[0-9a-f]{32}$/;

export function crearSecurityHashCarnetVO(valor: string): SecurityHashCarnetVO {
  const normalizado = valor.trim().toLowerCase();
  if (!normalizado) {
    throw new Error("El security hash del carnet es requerido");
  }
  if (!HASH_HEX.test(normalizado) && normalizado !== "synced") {
    throw new Error("Security hash inválido: debe ser 32 caracteres hexadecimales");
  }
  return { value: normalizado };
}
