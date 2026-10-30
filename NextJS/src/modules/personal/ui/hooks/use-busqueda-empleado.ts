"use client";

/**
 * Búsqueda de un trabajador por cédula usando el módulo `personal` (G7).
 *
 * Reemplaza a `useEmployeeSearch` + `getInfoRac.getEmployeeInfo` del legado
 * `(protected)/dashboard`: la acción `getEmpleadoPorCedulaAction` devuelve el
 * expediente completo (`EmpleadoDTO`) y su resultado se cachea con SWR, igual
 * que hacía el hook anterior.
 */
import { useCallback, useState } from "react";
import useSWR from "swr";

import type { EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { getEmpleadoPorCedulaAction } from "../../infrastructure/actions/personal-actions";

interface ResultadoBusquedaEmpleado {
  empleado: EmpleadoDTO | null;
  cargando: boolean;
  yaBusco: boolean;
  error: string | null;
  buscar: (cedula: string) => void;
  limpiar: () => void;
}

function esEmpleado(valor: unknown): valor is EmpleadoDTO {
  return !!valor && typeof valor === "object" && "cedula" in valor;
}

function mensajeDeError(valor: unknown): string | null {
  if (!valor || typeof valor !== "object" || !("error" in valor)) return null;
  const mensaje = (valor as { error?: unknown }).error;
  return typeof mensaje === "string" && mensaje ? mensaje : "Trabajador no encontrado";
}

export function useBusquedaEmpleado(): ResultadoBusquedaEmpleado {
  const [cedula, setCedula] = useState<string | null>(null);
  const { data, isLoading } = useSWR(cedula ? ["empleado-por-cedula", cedula] : null, () =>
    getEmpleadoPorCedulaAction(cedula!),
  );

  const buscar = useCallback((nueva: string) => setCedula(nueva.trim()), []);
  const limpiar = useCallback(() => setCedula(null), []);

  return {
    empleado: esEmpleado(data) ? data : null,
    cargando: isLoading,
    yaBusco: !!cedula && !isLoading,
    error: mensajeDeError(data),
    buscar,
    limpiar,
  };
}
