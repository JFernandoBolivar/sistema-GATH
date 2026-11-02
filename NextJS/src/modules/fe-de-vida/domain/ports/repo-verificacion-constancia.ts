import type { ConstanciaVerificadaEntity } from "../entities/verificacion-constancia";

/** Puerto de la verificación de constancias. Un código desconocido lanza un error con `status` 404. */
export interface RepoVerificacionConstancia {
  /** Sin sesión: solo constancias válidas, cédula enmascarada. */
  verificarPublica(codigo: string): Promise<ConstanciaVerificadaEntity>;
  /** Con sesión y permiso de verificación: datos completos. */
  verificarInterna(codigo: string): Promise<ConstanciaVerificadaEntity>;
}
