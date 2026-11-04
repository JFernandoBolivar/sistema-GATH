"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  textoDeProgreso,
  type OpcionesExportacion,
  type ProgresoExportacion,
} from "./exportaciones-asincronas";

/**
 * Estado de una exportación asíncrona para un formulario de reporte.
 *
 * `iniciar()` devuelve las opciones que se pasan a `postReport` (señal de
 * cancelación y callback de progreso); al desmontar la página se aborta la
 * consulta de estado para que no siga en segundo plano.
 */
export function useProgresoExportacion() {
  const [progreso, setProgreso] = useState<ProgresoExportacion | null>(null);
  const controlador = useRef<AbortController | null>(null);

  useEffect(() => () => controlador.current?.abort(), []);

  const iniciar = useCallback((): OpcionesExportacion => {
    controlador.current?.abort();
    const nuevo = new AbortController();
    controlador.current = nuevo;
    setProgreso(null);
    return { signal: nuevo.signal, onProgreso: setProgreso };
  }, []);

  return { progreso, texto: textoDeProgreso(progreso), iniciar };
}
