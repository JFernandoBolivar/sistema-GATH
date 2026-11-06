"use client";

/**
 * Carga el expediente de UN trabajador (activo o pasivo) garantizando que lo
 * que se pinta corresponde siempre a la cédula vigente.
 *
 * Seguridad de datos: nunca debe verse (ni usarse para guardar) la ficha de
 * otra persona. Por eso:
 * - `empleado` se deriva de la cédula pedida: al cambiar de persona vale
 *   `null` en el mismo render, sin esperar a ningún efecto.
 * - Cada petición se descarta si ya no es la vigente (cambió la cédula, se
 *   cerró la hoja o llegó una recarga posterior).
 * - Aunque la petición sea la vigente, el resultado solo se acepta si su
 *   cédula coincide con la pedida.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";
import { getEmpleadoPorCedulaAction } from "../infrastructure/actions/personal-actions";

const MENSAJE_FALLO = "No fue posible cargar el expediente.";
const MENSAJE_CEDULA_DISTINTA = "El expediente recibido no corresponde a la cédula solicitada.";

interface ExpedienteCargado {
  cedula: string;
  empleado: EmpleadoDTO;
  /** Número de carga que lo produjo; cambia en cada recarga exitosa. */
  revision: number;
}

interface CargaTerminada {
  cedula: string;
  recarga: number;
}

export interface UseExpedienteVigenteOpciones {
  /** Cédula del trabajador a mostrar; `null` si no hay ninguno seleccionado. */
  cedula: string | null;
  /** La hoja está abierta. Cerrada, se descarta todo lo cargado. */
  activo: boolean;
  /** Se llama (solo para la petición vigente) cuando la carga falla. */
  onError?: (mensaje: string) => void;
}

export interface UseExpedienteVigenteResultado {
  /** Expediente de la cédula vigente, o `null` mientras carga / si falló. */
  empleado: EmpleadoDTO | null;
  /** `true` mientras la cédula vigente aún no tiene respuesta. */
  cargando: boolean;
  /** Cambia con cada carga exitosa; sirve de `key` para reiniciar formularios. */
  revision: number;
  /** Vuelve a pedir el expediente de la cédula vigente (tras guardar). */
  recargar: () => void;
}

function mismaCedula(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function esError(valor: unknown): valor is { error: string } {
  return typeof valor === "object" && valor !== null && "error" in valor;
}

export function useExpedienteVigente({
  cedula,
  activo,
  onError,
}: UseExpedienteVigenteOpciones): UseExpedienteVigenteResultado {
  const [cargado, setCargado] = useState<ExpedienteCargado | null>(null);
  const [terminada, setTerminada] = useState<CargaTerminada | null>(null);
  const [recarga, setRecarga] = useState(0);
  const onErrorRef = useRef(onError);
  const revisionRef = useRef(0);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  // Al cerrar la hoja o cambiar de persona no se conserva nada de la anterior.
  useEffect(
    () => () => {
      setCargado(null);
      setTerminada(null);
    },
    [activo, cedula],
  );

  useEffect(() => {
    if (!activo || !cedula) return;
    let vigente = true;
    const fin = () => {
      if (vigente) setTerminada({ cedula, recarga });
    };
    getEmpleadoPorCedulaAction(cedula)
      .then((valor) => {
        if (!vigente) return;
        if (esError(valor)) {
          onErrorRef.current?.(valor.error);
          return;
        }
        const empleado = valor as EmpleadoDTO | null;
        if (!empleado || !mismaCedula(empleado.cedula, cedula)) {
          onErrorRef.current?.(MENSAJE_CEDULA_DISTINTA);
          return;
        }
        revisionRef.current += 1;
        setCargado({ cedula, empleado, revision: revisionRef.current });
      })
      .catch(() => {
        if (vigente) onErrorRef.current?.(MENSAJE_FALLO);
      })
      .finally(fin);
    return () => {
      vigente = false;
    };
  }, [activo, cedula, recarga]);

  const vigenteCargado =
    activo && cedula !== null && cargado !== null && mismaCedula(cargado.cedula, cedula)
      ? cargado
      : null;
  const terminadaVigente =
    activo && cedula !== null && terminada?.cedula === cedula && terminada.recarga === recarga;

  const recargar = useCallback(() => setRecarga((n) => n + 1), []);

  return {
    empleado: vigenteCargado?.empleado ?? null,
    cargando: activo && cedula !== null && !terminadaVigente,
    revision: vigenteCargado?.revision ?? 0,
    recargar,
  };
}
