"use server";

import { auth } from "#/auth";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import {
  verificarConstancia,
  type ResultadoVerificacion,
} from "../../application/use-cases/verificar-constancia";
import { PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import { repoVerificacionConstanciaApi as repo } from "../repositories/repo-verificacion-constancia-api";

/**
 * Verificación de la ficha que abre el QR. Abierta a visitantes sin sesión: solo con sesión y el permiso
 * de verificación se consulta la vista interna; el servidor lo vuelve a exigir.
 */
export async function verificarConstanciaAction(codigo: string): Promise<ResultadoVerificacion> {
  const sesion = await auth();
  const puedeVerInterna = tienePermiso(
    sesion?.user?.permisos,
    PERMISOS_FE_DE_VIDA.verificarConstancia,
  );
  return verificarConstancia(repo, codigo, puedeVerInterna);
}
