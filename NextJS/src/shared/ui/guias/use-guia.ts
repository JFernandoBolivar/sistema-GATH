"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import type { DefinicionGuia, PasoGuia } from "./tipos-guia";
import { consultarGuiasVistasAction, marcarGuiaVistaAction } from "./guias-actions";

export interface UseGuiaOptions {
  guia: DefinicionGuia;
  autoIniciar?: boolean;
  /** Retraso en ms antes de autoiniciar (permite que los componentes terminen de montarse). */
  delayAutoIniciarMs?: number;
  /** Función opcional para omitir pasos dinámicamente según permisos o condición. */
  filtroPaso?: (paso: PasoGuia) => boolean;
}

export interface UseGuiaReturn {
  iniciarGuia: () => void;
  detenerGuia: () => void;
  activa: boolean;
  yaVista: boolean;
  cargando: boolean;
  pasosDisponibles: PasoGuia[];
}

export function useGuia({
  guia,
  autoIniciar = true,
  delayAutoIniciarMs = 600,
  filtroPaso,
}: UseGuiaOptions): UseGuiaReturn {
  const [activa, setActiva] = useState(false);
  const [yaVista, setYaVista] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [pasosDisponibles, setPasosDisponibles] = useState<PasoGuia[]>([]);

  const driverRef = useRef<Driver | null>(null);
  const completadaRef = useRef(false);
  const cerradaVoluntariamenteRef = useRef(false);
  const animandoRef = useRef(false);

  // Obtener estado de visualización desde el servidor (por cuenta)
  useEffect(() => {
    let montado = true;
    async function verificar() {
      try {
        const res = await consultarGuiasVistasAction();
        if (montado && res.ok) {
          const versionVista = res.vistas[guia.id] ?? 0;
          const vista = versionVista >= guia.version;
          setYaVista(vista);
        }
      } catch {
        // En caso de fallo de red, se mantiene false
      } finally {
        if (montado) {
          setCargando(false);
        }
      }
    }
    void verificar();
    return () => {
      montado = false;
    };
  }, [guia.id, guia.version]);

  // Filtrar pasos cuyos elementos existan en el DOM y pasen el filtro
  const resolverPasosValidos = useCallback((): PasoGuia[] => {
    if (typeof document === "undefined") return [];

    return guia.pasos.filter((p) => {
      if (filtroPaso && !filtroPaso(p)) {
        return false;
      }
      try {
        const el = document.querySelector(p.selector);
        return el !== null;
      } catch {
        return false;
      }
    });
  }, [guia.pasos, filtroPaso]);

  // Actualizar lista de pasos disponibles
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPasosDisponibles(resolverPasosValidos());
    }
  }, [resolverPasosValidos]);

  // Marcar en el servidor solo si se completó o se cerró a propósito
  const registrarVistaServidor = useCallback(async () => {
    try {
      await marcarGuiaVistaAction(guia.id, guia.version);
      setYaVista(true);
    } catch {
      // Ignorar fallos de red al registrar
    }
  }, [guia.id, guia.version]);

  // Función para arrancar la guía
  const iniciarGuia = useCallback(() => {
    const pasosValidos = resolverPasosValidos();
    if (pasosValidos.length === 0) {
      // Regla: Si no queda ningún paso en pantalla, no arrancar ni marcar vista
      return;
    }

    // Limpiar instancia previa si existiera
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }

    completadaRef.current = false;
    cerradaVoluntariamenteRef.current = false;
    animandoRef.current = false;

    const driveSteps: DriveStep[] = pasosValidos.map((p, idx) => {
      const esUltimo = idx === pasosValidos.length - 1;
      return {
        element: p.selector,
        popover: {
          title: p.titulo,
          description: p.descripcion,
          side: p.posicion ?? "bottom",
          align: p.alineacion ?? "start",
          popoverClass: "gath-guia-popover",
          progressText: `${idx + 1} de ${pasosValidos.length}`,
          showProgress: true,
          prevBtnText: "← Anterior",
          nextBtnText: esUltimo ? "Entendido ✓" : "Siguiente →",
          doneBtnText: "Entendido ✓",
        },
      };
    });

    const driverInstance = driver({
      steps: driveSteps,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: "gath-guia-popover",
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente →",
      prevBtnText: "← Anterior",
      doneBtnText: "Entendido ✓",
      onHighlightStarted: () => {
        // Ignorar interacciones o clics espurios durante la animación
        animandoRef.current = true;
      },
      onHighlighted: () => {
        animandoRef.current = false;
      },
      onCloseClick: () => {
        // Cierre voluntario por el usuario
        cerradaVoluntariamenteRef.current = true;
        driverInstance.destroy();
      },
      onDestroyStarted: () => {
        if (driverInstance.isLastStep()) {
          completadaRef.current = true;
        }
      },
      onDestroyed: () => {
        setActiva(false);
        animandoRef.current = false;

        // Solo marcar vista si completó todos los pasos o cerró voluntariamente
        if (completadaRef.current || cerradaVoluntariamenteRef.current) {
          void registrarVistaServidor();
        }

        // Limpiar cualquier residuo del DOM que pudiera dejar driver.js
        const overlay = document.querySelector(".driver-overlay");
        if (overlay) overlay.remove();
        const popover = document.querySelector(".driver-popover");
        if (popover) popover.remove();
        document.body.classList.remove("driver-active", "driver-fade");
      },
    });

    driverRef.current = driverInstance;
    setActiva(true);
    driverInstance.drive();
  }, [resolverPasosValidos, registrarVistaServidor]);

  const detenerGuia = useCallback(() => {
    if (driverRef.current) {
      cerradaVoluntariamenteRef.current = true;
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  // Autoiniciar una sola vez cuando el servidor confirma que NO ha sido vista
  useEffect(() => {
    if (!autoIniciar || cargando || yaVista) {
      return;
    }

    const timer = setTimeout(() => {
      iniciarGuia();
    }, delayAutoIniciarMs);

    return () => {
      clearTimeout(timer);
    };
  }, [autoIniciar, cargando, yaVista, delayAutoIniciarMs, iniciarGuia]);

  // Destruir al salir de la pantalla (desmontar), sin dejar fondo oscuro ni marcar vista si salió a mitad
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        // Salir a mitad NO marca como vista: dejamos cerradaVoluntariamente y completada en false
        driverRef.current.destroy();
        driverRef.current = null;
      }
      // Asegurar que no quede el fondo oscuro ni clases en body
      if (typeof document !== "undefined") {
        const overlay = document.querySelector(".driver-overlay");
        if (overlay) overlay.remove();
        const popover = document.querySelector(".driver-popover");
        if (popover) popover.remove();
        document.body.classList.remove("driver-active", "driver-fade");
      }
    };
  }, []);

  return {
    iniciarGuia,
    detenerGuia,
    activa,
    yaVista,
    cargando,
    pasosDisponibles,
  };
}
