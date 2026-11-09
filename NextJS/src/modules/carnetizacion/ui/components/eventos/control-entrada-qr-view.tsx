"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Keyboard,
  Maximize2,
  Minimize2,
  QrCode,
  Scan,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
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

export function ControlEntradaQrView({ initialEventoId, embeddedInHub = false }: ControlEntradaQrViewProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>(initialEventoId || "");
  const [zonas, setZonas] = useState<EventoZona[]>([]);
  const [zonaId, setZonaId] = useState<string>("todas");

  // Estado del escáner y cámara
  const [camaraActiva, setCamaraActiva] = useState(false);
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
        // Si el intervalo entre pulsaciones es mayor a 80ms, reiniciar buffer (tipeo humano lento)
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
        "No se pudo acceder a la cámara trasera. Asegúrese de otorgar permisos o use lector USB / entrada manual.",
      );
      setCamaraActiva(false);
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

  return (
    <div className={`space-y-6 ${embeddedInHub ? "" : "max-w-5xl mx-auto pb-12"}`}>
      {/* 1. Selector de Evento y Punto de Control */}
      <Card className="border-border/60 shadow-xs bg-card">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Evento Seleccionado
                </label>
                <Select value={eventoId} onValueChange={setEventoId}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Seleccione un evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventos.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Punto de Control / Puerta
                </label>
                <Select value={zonaId} onValueChange={setZonaId}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Cualquier puerta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">
                      Todas las puertas / zonas
                    </SelectItem>
                    {zonas.map((z) => (
                      <SelectItem key={z.id} value={z.id} className="text-xs">
                        {z.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Controles de Utilidad (Pantalla completa, audio) */}
            <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAudioHabilitado((prev) => !prev)}
                className="h-10 text-xs px-3"
                title={audioHabilitado ? "Silenciar tonos de confirmación" : "Activar tonos sonoros"}
              >
                {audioHabilitado ? (
                  <Volume2 className="size-4 text-primary" />
                ) : (
                  <VolumeX className="size-4 text-muted-foreground" />
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={togglePantallaCompleta}
                className="h-10 text-xs px-3"
                title="Modo Pantalla Completa para Garitas"
              >
                {pantallaCompleta ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Cuadrícula de Operación: Visor de Cámara y Panel de Dictamen Inequívoco */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Visor de Cámara + Lector USB */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-[4/3] flex flex-col items-center justify-center border-2 border-slate-800 shadow-2xl">
            {/* Contenedor del scanner Html5Qrcode */}
            <div
              id={scannerContainerId}
              className={`size-full flex items-center justify-center ${camaraActiva ? "block" : "hidden"}`}
            />

            {/* Overlay visual cuando no está activa la cámara o mientras se activa */}
            {!camaraActiva && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-4">
                <div className="relative size-48 border-2 border-dashed border-emerald-500/80 rounded-2xl flex items-center justify-center overflow-hidden">
                  <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981]" />
                  <QrCode className="size-20 text-slate-700/60" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Cámara en espera
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Inicie la cámara trasera continua o use el lector USB/Bluetooth directamente.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={iniciarCamara}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs min-h-11 px-5 shadow-sm"
                >
                  <Camera className="size-4 mr-2" />
                  Activar Cámara Trasera
                </Button>
              </div>
            )}

            {/* Barra Inferior del Visor */}
            <div className="absolute bottom-3 inset-x-3 bg-slate-900/85 backdrop-blur border border-white/10 p-2.5 rounded-xl flex items-center justify-between text-xs text-slate-200">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${camaraActiva ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`}
                />
                <span className="text-[11px] font-medium">
                  {camaraActiva ? "Cámara Activa (Autoenfoque continuo)" : "Cámara Inactiva"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  Lector USB: Escuchando
                </span>
                {camaraActiva && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={detenerCamara}
                    className="h-7 text-[10px] text-slate-300 hover:text-white px-2"
                  >
                    Detener
                  </Button>
                )}
              </div>
            </div>
          </div>

          {errorCamara && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs flex items-center gap-2">
              <CameraOff className="size-4 shrink-0" />
              <span>{errorCamara}</span>
            </div>
          )}

          {/* Simulador de Pruebas Rápidas para Operador y Verificación */}
          <Card className="border-border/60 shadow-xs bg-card">
            <CardContent className="p-3.5 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block">
                Simular respuestas del punto de control:
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("permitido")}
                  className="text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  Simular Acceso Permitido
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("ya_ingreso")}
                  className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10 font-semibold"
                >
                  <AlertTriangle className="size-3.5 mr-1" />
                  Simular «Ya Ingresó»
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => simularRespuesta("denegado")}
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10 font-semibold"
                >
                  <XCircle className="size-3.5 mr-1" />
                  Simular No Válida
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Entrada Manual Plegable (Contingencia) */}
          <Card className="border-border/60 shadow-xs bg-card">
            <div
              className="p-3.5 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setMostrarEntradaManual((prev) => !prev)}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Keyboard className="size-4 text-primary" />
                <span>Entrada manual de código o lector USB</span>
              </div>
              <Button variant="ghost" size="sm" className="size-7 p-0">
                {mostrarEntradaManual ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>

            {mostrarEntradaManual && (
              <CardContent className="pt-0 pb-4 px-3.5 border-t border-border/40">
                <form onSubmit={handleManualSubmit} className="space-y-3 pt-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ingrese código de credencial o hash (ej: GAF-0042)..."
                      value={codigoInput}
                      onChange={(e) => setCodigoInput(e.target.value)}
                      className="font-mono text-sm h-10"
                    />
                    <Button
                      type="submit"
                      disabled={isPending || !codigoInput.trim()}
                      className="min-h-10 text-xs font-semibold px-4"
                    >
                      {isPending ? "Validando…" : "Validar"}
                    </Button>
                  </div>
                  {errorAcceso && <p className="text-xs text-destructive font-medium">{errorAcceso}</p>}
                </form>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Columna Derecha (5 cols): Tarjeta de Dictamen Inequívoco Grande */}
        <div className="lg:col-span-5 space-y-4">
          {resultado ? (
            <div
              className={`p-6 rounded-2xl border-2 transition-all shadow-md space-y-4 ${
                resultado.resultado === "ACCESO_PERMITIDO"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100"
                  : resultado.resultado === "YA_INGRESO"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-100"
                  : "bg-destructive/10 border-destructive text-destructive"
              }`}
            >
              {/* Encabezado del Dictamen */}
              <div className="flex items-center gap-3">
                <div
                  className={`size-12 rounded-xl flex items-center justify-center font-black text-xl shadow-md text-white shrink-0 ${
                    resultado.resultado === "ACCESO_PERMITIDO"
                      ? "bg-emerald-600"
                      : resultado.resultado === "YA_INGRESO"
                      ? "bg-amber-600"
                      : "bg-destructive"
                  }`}
                >
                  {resultado.resultado === "ACCESO_PERMITIDO" ? (
                    <CheckCircle2 className="size-7" />
                  ) : resultado.resultado === "YA_INGRESO" ? (
                    <AlertTriangle className="size-7" />
                  ) : (
                    <XCircle className="size-7" />
                  )}
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block opacity-90">
                    {resultado.resultado === "ACCESO_PERMITIDO"
                      ? "Verificación de Identidad"
                      : resultado.resultado === "YA_INGRESO"
                      ? "Alerta de Duplicidad"
                      : "Acceso Denegado"}
                  </span>
                  <h3 className="text-2xl font-black leading-tight">
                    {resultado.resultado === "ACCESO_PERMITIDO"
                      ? "ACCESO PERMITIDO"
                      : resultado.resultado === "YA_INGRESO"
                      ? "YA HABÍA INGRESADO"
                      : "CREDENCIAL NO VÁLIDA"}
                  </h3>
                </div>
              </div>

              {/* Mensaje principal */}
              <p className="text-sm font-semibold border-t border-current/15 pt-2">
                {resultado.mensaje}
              </p>

              {/* Detalles del Titular */}
              {resultado.nombre_completo && (
                <div className="p-4 rounded-xl bg-background/80 border border-current/20 space-y-2 text-xs text-foreground">
                  <div>
                    <span className="text-muted-foreground block font-medium">
                      Titular de la Credencial
                    </span>
                    <span className="text-base font-bold text-foreground block">
                      {resultado.nombre_completo}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                    <div>
                      <span className="text-muted-foreground block">Documento</span>
                      <span className="font-bold text-foreground font-mono">
                        {resultado.documento_identidad || "Sin documento"}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block">Categoría</span>
                      <span className="font-bold text-primary">
                        {resultado.categoria_nombre || "Invitado General"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-border/50 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground block">Zona Autorizada</span>
                      <span className="font-semibold text-foreground">
                        {resultado.zona_nombre || "General"}
                      </span>
                    </div>

                    {resultado.mesa && (
                      <div>
                        <span className="text-muted-foreground block">Ubicación / Mesa</span>
                        <span className="font-semibold text-foreground">{resultado.mesa}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pie de tiempo */}
              <div className="text-[11px] font-mono flex items-center justify-between opacity-80 pt-1">
                <span>Registro: {resultado.hora_ingreso_formateada || "En vivo"}</span>
                <span>Bip sonoro: {audioHabilitado ? "Activo" : "Silenciado"}</span>
              </div>
            </div>
          ) : (
            <Card className="border-border/60 shadow-xs bg-card p-8 text-center space-y-3">
              <div className="size-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Scan className="size-7" />
              </div>
              <h4 className="text-sm font-bold text-foreground">En espera de escaneo</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Aproxime el código QR al visor de cámara o active el lector USB de garita para verificar el ingreso.
              </p>
            </Card>
          )}

          {/* Historial de Accesos Recientes en Sesión */}
          {historialReciente.length > 0 && (
            <Card className="border-border/60 shadow-xs bg-card">
              <CardHeader className="pb-2 pt-3 px-4 border-b border-border/40">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  Últimos accesos en esta sesión
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 space-y-1.5 max-h-56 overflow-y-auto">
                {historialReciente.map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/40 text-xs bg-muted/20"
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      {h.resultado === "ACCESO_PERMITIDO" ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : h.resultado === "YA_INGRESO" ? (
                        <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-destructive shrink-0" />
                      )}
                      <span className="font-semibold text-foreground truncate">
                        {h.nombre_completo || h.codigo_credencial || "Asistente"}
                      </span>
                      {h.categoria_nombre && (
                        <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                          {h.categoria_nombre}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {h.hora_ingreso_formateada || "Reciente"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
