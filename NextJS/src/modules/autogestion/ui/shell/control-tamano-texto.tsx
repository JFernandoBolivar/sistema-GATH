"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TamanoTexto = "normal" | "lg" | "xl";

const ORDEN: TamanoTexto[] = ["normal", "lg", "xl"];
const CLASES: Record<TamanoTexto, string | null> = {
  normal: null,
  lg: "text-scale-lg",
  xl: "text-scale-xl",
};
const CLAVE = "gath-tamano-texto";

function aplicar(tamano: TamanoTexto): void {
  const raiz = document.documentElement;
  raiz.classList.remove("text-scale-lg", "text-scale-xl");
  const clase = CLASES[tamano];
  if (clase) raiz.classList.add(clase);
}

function leer(): TamanoTexto | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return ORDEN.find((t) => t === valor) ?? null;
  } catch {
    return null; // almacenamiento bloqueado: solo se pierde la preferencia
  }
}

function guardar(tamano: TamanoTexto): void {
  try {
    window.localStorage.setItem(CLAVE, tamano);
  } catch {
    // Sin almacenamiento: el cambio sigue vigente en la sesión.
  }
}

/**
 * Control A+/A- del tamaño de texto (PLAN_REDISENO §4.1). La preferencia es solo una comodidad del
 * navegador; los pasivos arrancan en tamaño ampliado cuando no han elegido otro.
 */
export function ControlTamanoTexto({
  condicionTrabajador,
}: {
  condicionTrabajador?: string | null;
}) {
  const [tamano, setTamano] = useState<TamanoTexto>("normal");

  useEffect(() => {
    const inicial = leer() ?? (condicionTrabajador === "PASIVO" ? "lg" : "normal");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la preferencia guardada, solo disponible en el cliente
    setTamano(inicial);
    aplicar(inicial);
  }, [condicionTrabajador]);

  function cambiar(delta: 1 | -1) {
    const siguiente = ORDEN[Math.min(Math.max(ORDEN.indexOf(tamano) + delta, 0), ORDEN.length - 1)];
    setTamano(siguiente);
    aplicar(siguiente);
    guardar(siguiente);
  }

  return (
    <div role="group" aria-label="Tamaño del texto" className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/15 hover:text-white"
        aria-label="Reducir el tamaño del texto"
        disabled={tamano === "normal"}
        onClick={() => cambiar(-1)}
      >
        <Minus aria-hidden />
      </Button>
      <span aria-hidden className="text-sm font-bold">
        A
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/15 hover:text-white"
        aria-label="Aumentar el tamaño del texto"
        disabled={tamano === "xl"}
        onClick={() => cambiar(1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
