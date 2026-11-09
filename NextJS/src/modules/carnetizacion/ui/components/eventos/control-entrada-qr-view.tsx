"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  Clock,
  Keyboard,
  Maximize2,
  Minimize2,
  QrCode,
  Scan,
  Usb,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import {
  checkInAccesoAction,
  getEventosAction,
  getZonasEventoAction,
} from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type {
  CheckInResponse,
  Evento,
  EventoZona,
} from "@/modules/carnetizacion/domain/entities/evento";

interface ControlEntradaQrViewProps {
  initialEventoId?: string;
  embeddedInHub?: boolean;
}

// Reproducción de sonido sintetizado mediante Web Audio API (cero dependencias externas de audio)
function reproducirTono(tipo: "permitido" | "ya_ingreso" | "denegado") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const ahora = ctx.currentTime;

    if (tipo === "permitido") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ahora); // Tono agudo A5
      gain.gain.setValueAtTime(0.3, ahora);
      gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.18);
      osc.start(ahora);
      osc.stop(ahora + 0.18);
    } else if (tipo === "ya_ingreso") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ahora);
      osc.frequency.setValueAtTime(330, ahora + 0.1);
      gain.gain.setValueAtTime(0.3, ahora);
      gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.25);
      osc.start(ahora);
      osc.stop(ahora + 0.25);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ahora);
      gain.gain.setValueAtTime(0.3, ahora);
      gain.gain.exponentialRampToValueAtTime(0.01, ahora + 0.3);
      osc.start(ahora);
      osc.stop(ahora + 0.3);
    }
  } catch {
    // Si el navegador bloquea audio sin interacción de usuario, no bloquea la UI
  }
}

function dispararVibracion(tipo: "permitido" | "ya_ingreso" | "denegado") {
  if (typeof window === "undefined" || !navigator.vibrate) return;
  try {
    if (tipo === "permitido") {
      navigator.vibrate(100);
    } else if (tipo === "ya_ingreso") {
      navigator.vibrate([100, 50, 100]);
    } else {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Silencioso
  }
}

const TONO_DICTAMEN = {
  ACCESO_PERMITIDO: {
    panel: "border-success/30 bg-success-soft",
    icono: "text-success",
    etiqueta: "Verificación de identidad",
    testigo: "ACCESO PERMITIDO",
  },
  YA_INGRESO: {
    panel: "border-warning/30 bg-warning-soft",
    icono: "text-warning",
    etiqueta: "Alerta de duplicidad",
    testigo: "YA HABÍA INGRESADO",
  },
  NO_VALIDA: {
    panel: "border-danger/30 bg-danger-soft",
    icono: "text-danger",
    etiqueta: "Acceso denegado",
    testigo: "CREDENCIAL NO VÁLIDA",
  },
} as const;

export function ControlEntradaQrView({ initialEventoId, embeddedInHub = false }: ControlEntradaQrViewProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>(initialEventoId || "");
  const [zonas, setZonas] = useState<EventoZona[]>([]);
  const [zonaId, setZonaId] = useState<string>("todas");

  // Estado del escáner y cámara
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [iniciandoCamara, setIniciandoCamara] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [audioHabilitado, setAudioHabilitado] = useState(true);

  // Entrada manual o lector USB
  const [mostrarEntradaManual, setMostrarEntradaManual] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [resultado, setResultado] = useState<CheckInResponse | null>(null);
  const [historialReciente, setHistorialReciente] = useState<CheckInResponse[]>([]);
  const [isPending, startTransition] = useTransition();
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  // Referencias para escáner y teclado pasivo USB
  const html5QrCodeRef = useRef<unknown>(null);
  const scannerContainerId = "qr-reader-container";
  const ultimoCodigoEscaneadoRef = useRef<string>("");
  const ultimoTimestampEscaneoRef = useRef<number>(0);
  const bufferTecladoRef = useRef<string>("");
  const ultimoKeyTimestampRef = useRef<number>(0);
  const procesarCheckInRef = useRef<(codigo: string) => void>(() => {});

  // Cargar lista de eventos activos
  useEffect(() => {
    getEventosAction()
      .then((lista) => {
        setEventos(lista);
        if (!eventoId && lista.length > 0) {
          setEventoId(lista[0].id);
        }
      })
      .catch(() => setErrorAcceso("No fue posible cargar los eventos."));
  }, [eventoId]);

  // Cargar zonas del evento seleccionado
  useEffect(() => {
    if (eventoId) {
      getZonasEventoAction(eventoId)
        .then((zns) => {
          setZonas(zns);
          if (zns.length > 0) {
            setZonaId(zns[0].id);
          } else {
            setZonaId("todas");
          }
        })
        .catch(() => setErrorAcceso("No fue posible cargar las zonas del evento."));
    }
  }, [eventoId]);

  // Listener para Lector USB/Bluetooth pasivo (captura ráfaga de teclas terminada en Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está tipeando activamente en un input o textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const ahora = Date.now();
      const diferencia = ahora - ultimoKeyTimestampRef.current;
      ultimoKeyTimestampRef.current = ahora;

      if (e.key === "Enter") {
        const codigo = bufferTecladoRef.current.trim();
        bufferTecladoRef.current = "";
        if (codigo.length >= 3) {
          procesarCheckInRef.current(codigo);
        }
      } else if (e.key.length === 1) {
        // Si el intervalo entre pulsaciones es mayor a 120ms, reiniciar buffer (tipeo humano lento)
        if (diferencia > 120 && bufferTecladoRef.current.length > 0) {
          bufferTecladoRef.current = "";
        }
        bufferTecladoRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Inicializar escáner de cámara Html5Qrcode
  const iniciarCamara = async () => {
    try {
      setErrorCamara(null);
      setIniciandoCamara(true);
      const { Html5Qrcode } = await import("html5-qrcode");

      if (html5QrCodeRef.current) {
        try {
          const scanner = html5QrCodeRef.current as { stop: () => Promise<void> };
          await scanner.stop();
        } catch {
          // Ya detenido
        }
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          const ahora = Date.now();
          // Debounce de 1.8s para evitar lecturas duplicadas continuas del mismo QR
          if (
            decodedText === ultimoCodigoEscaneadoRef.current &&
            ahora - ultimoTimestampEscaneoRef.current < 1800
          ) {
            return;
          }
          ultimoCodigoEscaneadoRef.current = decodedText;
          ultimoTimestampEscaneoRef.current = ahora;
          procesarCheckInRef.current(decodedText);
        },
        () => {
          // Lectura de frame sin QR detectado (esperado)
        },
      );

      setCamaraActiva(true);
    } catch (err) {
      console.warn("No fue posible inicializar la cámara:", err);
      setErrorCamara(
        "No se pudo acceder a la cámara. Otorgue el permiso del navegador o use el lector USB o la entrada manual.",
      );
      setCamaraActiva(false);
    } finally {
      setIniciandoCamara(false);
    }
  };

  const detenerCamara = async () => {
    if (html5QrCodeRef.current) {
      try {
        const scanner = html5QrCodeRef.current as { stop: () => Promise<void>; clear: () => void };
        await scanner.stop();
        scanner.clear();
      } catch {
        // Silencioso
      }
      html5QrCodeRef.current = null;
    }
    setCamaraActiva(false);
  };

  // Detener cámara al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          const scanner = html5QrCodeRef.current as { stop: () => Promise<void> };
          scanner.stop().catch(() => {});
        } catch {}
      }
    };
  }, []);

  const togglePantallaCompleta = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setPantallaCompleta(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setPantallaCompleta(false)).catch(() => {});
    }
  };

  const procesarCheckIn = (codigoParaValidar: string) => {
    const code = codigoParaValidar.trim();
    if (!code) return;

    startTransition(async () => {
      try {
        setErrorAcceso(null);
        const resp = await checkInAccesoAction({
          codigo_o_hash: code,
          evento_id: eventoId || undefined,
          zona_id: zonaId === "todas" ? undefined : zonaId,
        });

        setResultado(resp);
        setHistorialReciente((prev) => [resp, ...prev.slice(0, 9)]);
        setCodigoInput("");

        // Feedback sonoro y háptico
        if (resp.resultado === "ACCESO_PERMITIDO") {
          if (audioHabilitado) reproducirTono("permitido");
          dispararVibracion("permitido");
        } else if (resp.resultado === "YA_INGRESO") {
          if (audioHabilitado) reproducirTono("ya_ingreso");
          dispararVibracion("ya_ingreso");
        } else {
          if (audioHabilitado) reproducirTono("denegado");
          dispararVibracion("denegado");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error procesando acceso";
        setErrorAcceso(msg);
        if (audioHabilitado) reproducirTono("denegado");
        dispararVibracion("denegado");
      }
    });
  };
  procesarCheckInRef.current = procesarCheckIn;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    procesarCheckIn(codigoInput);
  };

  // Simulador de pruebas rápidas (Permitido, Ya ingresó, Denegado) para demostración y verificación
  const simularRespuesta = (tipo: "permitido" | "ya_ingreso" | "denegado") => {
    const ahoraStr = new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    let mockResp: CheckInResponse;

    if (tipo === "permitido") {
      mockResp = {
        resultado: "ACCESO_PERMITIDO",
        mensaje: "Acceso autorizado para este evento y punto de control.",
        invitado_id: "mock-1",
        nombre_completo: "BOLÍVAR HERNÁNDEZ, JOSÉ FERNANDO",
        documento_identidad: "V-18456789",
        organizacion: "Gerencia de Operaciones y Redes",
        categoria_nombre: "Funcionario Oficial",
        zona_nombre: "Puerta Principal · Garita A",
        mesa: "Mesa 04",
        codigo_credencial: "GAF-2026-0042",
        hora_ingreso_formateada: ahoraStr,
      };
      if (audioHabilitado) reproducirTono("permitido");
      dispararVibracion("permitido");
    } else if (tipo === "ya_ingreso") {
      mockResp = {
        resultado: "YA_INGRESO",
        mensaje: `Esta credencial ya registró su ingreso a las ${ahoraStr}.`,
        invitado_id: "mock-2",
        nombre_completo: "RAMÍREZ, ODALIS",
        documento_identidad: "V-10510831",
        organizacion: "Personal Pasivo / Jubilado",
        categoria_nombre: "Invitada Especial",
        zona_nombre: "Puerta Principal · Garita A",
        codigo_credencial: "GAF-2026-0041",
        hora_ingreso_formateada: ahoraStr,
      };
      if (audioHabilitado) reproducirTono("ya_ingreso");
      dispararVibracion("ya_ingreso");
    } else {
      mockResp = {
        resultado: "NO_VALIDA",
        mensaje: "La credencial no existe en el sistema o corresponde a un evento distinto.",
        invitado_id: "",
        nombre_completo: "",
        documento_identidad: "",
        organizacion: "",
        categoria_nombre: "",
        zona_nombre: "",
        codigo_credencial: "INV-ERR-9999",
        hora_ingreso_formateada: ahoraStr,
      };
      if (audioHabilitado) reproducirTono("denegado");
      dispararVibracion("denegado");
    }

    setResultado(mockResp);
    setHistorialReciente((prev) => [mockResp, ...prev.slice(0, 9)]);
  };

  const tono = resultado ? TONO_DICTAMEN[resultado.resultado] ?? TONO_DICTAMEN.NO_VALIDA : null;

  return (
    <div className={cn("space-y-6", !embeddedInHub && "mx-auto max-w-6xl pb-10")}>
      {/* Configuración del punto de control */}
      <Card className="border-border bg-card shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="control-evento" className="block text-sm font-medium text-foreground">
                  Evento
                </label>
                <Select value={eventoId} onValueChange={setEventoId}>
                  <SelectTrigger id="control-evento" className="h-11 w-full text-sm">
                    <SelectValue placeholder="Seleccione un evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventos.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="control-zona" className="block text-sm font-medium text-foreground">
                  Punto de Control / Puerta
                </label>
                <Select value={zonaId} onValueChange={setZonaId}>
                  <SelectTrigger id="control-zona" className="h-11 w-full text-sm">
                    <SelectValue placeholder="Cualquier puerta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las puertas / zonas</SelectItem>
                    {zonas.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={audioHabilitado ? "secondary" : "outline"}
                onClick={() => setAudioHabilitado((prev) => !prev)}
                className="min-h-11 px-3"
                aria-pressed={audioHabilitado}
                title={audioHabilitado ? "Silenciar tonos de confirmación" : "Activar tonos de confirmación"}
              >
                {audioHabilitado ? (
                  <Volume2 className="size-4" aria-hidden />
                ) : (
                  <VolumeX className="size-4" aria-hidden />
                )}
                <span className="hidden sm:inline">Sonido</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={togglePantallaCompleta}
                className="min-h-11 px-3"
                aria-pressed={pantallaCompleta}
                title="Modo pantalla completa para garitas"
              >
                {pantallaCompleta ? (
                  <Minimize2 className="size-4" aria-hidden />
                ) : (
                  <Maximize2 className="size-4" aria-hidden />
                )}
                <span className="hidden sm:inline">Pantalla completa</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Lector */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="border-border bg-card shadow-none">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Lector de credenciales</h2>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 font-medium",
                    camaraActiva
                      ? "border-success/40 bg-success-soft text-success"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      camaraActiva ? "animate-pulse bg-success" : "bg-muted-foreground",
                    )}
                    aria-hidden
                  />
                  {camaraActiva ? "En vivo" : "En espera"}
                </Badge>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                {/* El contenedor siempre está visible y con tamaño estable: Html5Qrcode
                    mide el ancho al iniciar y, si estuviera oculto, el video saldría 0×0. */}
                <div
                  id={scannerContainerId}
                  className="aspect-[4/3] w-full [&_canvas]:hidden [&_video]:size-full [&_video]:object-cover"
                />

                {!camaraActiva && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
                    <span className="flex size-20 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                      {iniciandoCamara ? (
                        <Camera className="size-9 animate-pulse" aria-hidden />
                      ) : (
                        <QrCode className="size-9" aria-hidden />
                      )}
                    </span>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">
                        {iniciandoCamara ? "Activando cámara…" : "Cámara en espera"}
                      </p>
                      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                        Active la cámara trasera o use el lector USB / Bluetooth. También puede
                        validar un código de forma manual.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={iniciarCamara}
                      disabled={iniciandoCamara}
                      className="min-h-11"
                    >
                      <Camera className="size-4" aria-hidden />
                      {iniciandoCamara ? "Activando…" : "Activar cámara"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Usb className="size-4 text-primary" aria-hidden />
                  Lector USB: escuchando{" "}
                  <span className="hidden sm:inline">· también acepta Bluetooth</span>
                </p>
                {camaraActiva && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={detenerCamara}
                    className="min-h-9"
                  >
                    <CameraOff className="size-4" aria-hidden />
                    Detener cámara
                  </Button>
                )}
              </div>

              {errorCamara && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning"
                >
                  <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{errorCamara}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Entrada manual plegable */}
          <Card className="border-border bg-card shadow-none">
            <button
              type="button"
              onClick={() => setMostrarEntradaManual((prev) => !prev)}
              aria-expanded={mostrarEntradaManual}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Keyboard className="size-4 text-primary" aria-hidden />
                Entrada manual de código o lector USB
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  mostrarEntradaManual && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {mostrarEntradaManual && (
              <CardContent className="border-t border-border px-4 pb-4 pt-3">
                <form onSubmit={handleManualSubmit} className="space-y-2">
                  <label htmlFor="control-codigo" className="sr-only">
                    Código de credencial
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="control-codigo"
                      placeholder="Ingrese código de credencial o hash (ej: GAF-0042)..."
                      value={codigoInput}
                      onChange={(e) => setCodigoInput(e.target.value)}
                      className="h-11 flex-1 font-mono text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={isPending || !codigoInput.trim()}
                      className="min-h-11 sm:w-auto"
                    >
                      {isPending ? "Validando…" : "Validar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El lector USB escribe el código y envía Enter; no necesita abrir esta sección
                    para usarlo.
                  </p>
                  {errorAcceso && (
                    <p role="alert" className="text-sm font-medium text-danger">
                      {errorAcceso}
                    </p>
                  )}
                </form>
              </CardContent>
            )}
          </Card>

          {/* Simulador de pruebas */}
          <Card className="border-border bg-muted/40 shadow-none">
            <CardContent className="space-y-2 p-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                Modo de prueba · simular respuestas del punto de control
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("permitido")}
                  className="min-h-9 border-success/30 text-success hover:bg-success-soft hover:text-success"
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  Simular Acceso Permitido
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("ya_ingreso")}
                  className="min-h-9 border-warning/30 text-warning hover:bg-warning-soft hover:text-warning"
                >
                  <AlertTriangle className="size-4" aria-hidden />
                  Simular «Ya Ingresó»
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("denegado")}
                  className="min-h-9 border-danger/30 text-danger hover:bg-danger-soft hover:text-danger"
                >
                  <XCircle className="size-4" aria-hidden />
                  Simular No Válida
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dictamen y actividad */}
        <div className="space-y-4 lg:col-span-5">
          {resultado && tono ? (
            <div
              className={cn("space-y-4 rounded-xl border p-5", tono.panel)}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card",
                    tono.icono,
                  )}
                >
                  {resultado.resultado === "ACCESO_PERMITIDO" ? (
                    <CheckCircle2 className="size-6" aria-hidden />
                  ) : resultado.resultado === "YA_INGRESO" ? (
                    <AlertTriangle className="size-6" aria-hidden />
                  ) : (
                    <XCircle className="size-6" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", tono.icono)}>{tono.etiqueta}</p>
                  <h3 className="text-xl font-bold leading-tight text-foreground">{tono.testigo}</h3>
                </div>
              </div>

              <p className="text-sm text-foreground">{resultado.mensaje}</p>

              {resultado.nombre_completo && (
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Titular de la credencial</p>
                    <p className="text-base font-semibold text-foreground">{resultado.nombre_completo}</p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Documento</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {resultado.documento_identidad || "Sin documento"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Categoría</dt>
                      <dd className="font-medium text-foreground">
                        {resultado.categoria_nombre || "Invitado general"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Zona autorizada</dt>
                      <dd className="font-medium text-foreground">
                        {resultado.zona_nombre || "General"}
                      </dd>
                    </div>
                    {resultado.mesa && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Ubicación / Mesa</dt>
                        <dd className="font-medium text-foreground">{resultado.mesa}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  Registro: {resultado.hora_ingreso_formateada || "en vivo"}
                </span>
                <span>{audioHabilitado ? "Sonido activo" : "Sonido silenciado"}</span>
              </div>
            </div>
          ) : (
            <Card className="border-border bg-card shadow-none">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Scan className="size-6" aria-hidden />
                </span>
                <h3 className="text-base font-semibold text-foreground">Esperando una credencial</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Escanee el QR con la cámara, pase la credencial por el lector USB o valide un
                  código manual.
                </p>
              </CardContent>
            </Card>
          )}

          {historialReciente.length > 0 && (
            <Card className="border-border bg-card shadow-none">
              <CardContent className="p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-primary" aria-hidden />
                  Últimos accesos de la sesión
                </h3>
                <ul className="divide-y divide-border">
                  {historialReciente.map((h, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        {h.resultado === "ACCESO_PERMITIDO" ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                        ) : h.resultado === "YA_INGRESO" ? (
                          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                        ) : (
                          <XCircle className="size-4 shrink-0 text-danger" aria-hidden />
                        )}
                        <span className="truncate text-sm font-medium text-foreground">
                          {h.nombre_completo || h.codigo_credencial || "Asistente"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {h.hora_ingreso_formateada || "Reciente"}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
