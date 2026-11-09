"use server";

import { getEmpleadoPorCedulaAction as getEmpleadoAction } from "@/modules/personal/infrastructure/actions/personal-actions";

export async function getEmpleadoPorCedulaAction(cedula: string) {
  return getEmpleadoAction(cedula);
}
