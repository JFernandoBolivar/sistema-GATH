"use client";

import { useEffect, useState, useTransition } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ZodTypeAny } from "zod";
import type { SeccionVentana2 } from "../../domain/ventana2";
import { hora, marcarErroresServidor, validarEstricto, type GuardarSeccion } from "./comun";

interface Opciones<T extends FieldValues> {
  form: UseFormReturn<T>;
  estricto: ZodTypeAny;
  seccion: SeccionVentana2;
  guardar: GuardarSeccion;
  /** Cuerpo del PUT a partir de los valores del formulario. */
  cuerpo: (valores: T) => Record<string, unknown>;
  onContinuar: () => void;
  validarAlEntrar?: boolean;
}

/** Ciclo de guardado común de las secciones por lista: validar, enviar el borrador, marcar errores del servidor y avanzar. */
export function useGuardadoSeccion<T extends FieldValues>({ form, estricto, seccion, guardar, cuerpo, onContinuar, validarAlEntrar }: Opciones<T>) {
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardadoA, setGuardadoA] = useState<string | null>(null);

  useEffect(() => {
    if (validarAlEntrar) validarEstricto(form, estricto);
    // Solo al llegar desde la lista de pendientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarSeccion(avanzar: boolean) {
    setError(null);
    if (avanzar) {
      if (!validarEstricto(form, estricto)) {
        setError("Completa los datos marcados en rojo para continuar.");
        return;
      }
    } else if (!(await form.trigger())) {
      setError("Revisa los campos marcados en rojo.");
      return;
    }
    const valores = form.getValues();
    iniciar(async () => {
      const r = await guardar(cuerpo(valores));
      if (!r.ok) {
        setError(marcarErroresServidor(form, seccion, r.errores) ? "Revisa los campos marcados en rojo." : r.mensaje);
        return;
      }
      setGuardadoA(hora(new Date()));
      if (avanzar) onContinuar();
    });
  }

  return { guardando, error, guardadoA, guardarSeccion };
}
