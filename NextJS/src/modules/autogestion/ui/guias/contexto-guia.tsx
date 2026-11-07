"use client";

/**
 * O42: registro de la guía de la pantalla actual de Autogestión.
 *
 * Cada página registra cómo abrir su guía (driver.js o panel de fe de vida) y
 * el shell muestra un único botón «Ver guía» en la cabecera. Si la pantalla no
 * registra nada, el botón no aparece.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ContextoGuia {
  registrar: (id: string, abrir: () => void) => void;
  quitar: (id: string) => void;
  abrirActual: (() => void) | null;
}

const ContextoGuiaAutogestion = createContext<ContextoGuia | null>(null);

export function ProveedorGuiaAutogestion({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Map<string, () => void>>(() => new Map());

  const registrar = useCallback((id: string, abrir: () => void) => {
    setAcciones((previas) => {
      const siguientes = new Map(previas);
      siguientes.set(id, abrir);
      return siguientes;
    });
  }, []);

  const quitar = useCallback((id: string) => {
    setAcciones((previas) => {
      if (!previas.has(id)) return previas;
      const siguientes = new Map(previas);
      siguientes.delete(id);
      return siguientes;
    });
  }, []);

  // La última pantalla registrada es la que responde al botón; al desmontarse,
  // vuelve a quedar activa la anterior que siga montada.
  const abrirActual = useMemo(() => {
    let ultima: (() => void) | null = null;
    for (const accion of acciones.values()) ultima = accion;
    return ultima;
  }, [acciones]);

  const valor = useMemo(
    () => ({ registrar, quitar, abrirActual }),
    [registrar, quitar, abrirActual],
  );

  return (
    <ContextoGuiaAutogestion.Provider value={valor}>
      {children}
    </ContextoGuiaAutogestion.Provider>
  );
}

/**
 * Registra el abridor de la guía de la pantalla actual. `accion` puede ser
 * `null` cuando la pantalla no tiene guía o aún no está lista.
 */
export function useRegistrarGuia(accion: (() => void) | null | undefined) {
  const contexto = useContext(ContextoGuiaAutogestion);
  const registrar = contexto?.registrar;
  const quitar = contexto?.quitar;
  const id = useId();
  const accionRef = useRef(accion);
  const activa = typeof accion === "function";

  useEffect(() => {
    accionRef.current = accion;
  }, [accion]);

  useEffect(() => {
    if (!registrar || !quitar) return;
    if (!activa) {
      quitar(id);
      return;
    }
    registrar(id, () => accionRef.current?.());
    return () => quitar(id);
  }, [registrar, quitar, id, activa]);
}

export function useAbrirGuiaActual() {
  return useContext(ContextoGuiaAutogestion)?.abrirActual ?? null;
}
