"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
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
}

export function ControlEntradaQrView({ initialEventoId }: ControlEntradaQrViewProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>(initialEventoId || "");
  const [zonas, setZonas] = useState<EventoZona[]>([]);
  // Radix no permite un SelectItem con value="" (lanza un error en cliente).
  // Se usa un centinela estable y se traduce a "sin zona" al enviar.
  const [zonaId, setZonaId] = useState<string>("todas");
  const [codigoInput, setCodigoInput] = useState("");
  const [resultado, setResultado] = useState<CheckInResponse | null>(null);
  const [historialReciente, setHistorialReciente] = useState<CheckInResponse[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de eventos activos
  useEffect(() => {
    getEventosAction()
      .then((lista) => {
        setEventos(lista);
        if (!eventoId && lista.length > 0) {
          setEventoId(lista[0].id);
        }
      })
      .catch(() => setError("No fue posible cargar los eventos."));
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
        .catch(() => setError("No fue posible cargar las zonas del evento."));
    }
  }, [eventoId]);

  const procesarCheckIn = (codigoParaValidar: string) => {
    const code = codigoParaValidar.trim();
    if (!code) return;

    startTransition(async () => {
      try {
        setError(null);
        const resp = await checkInAccesoAction({
          codigo_o_hash: code,
          evento_id: eventoId || undefined,
          zona_id: zonaId === "todas" ? undefined : zonaId,
        });

        setResultado(resp);
        setHistorialReciente((prev) => [resp, ...prev.slice(0, 9)]);
        setCodigoInput("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error procesando acceso");
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    procesarCheckIn(codigoInput);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Selector de Evento y Punto de Control */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            📲 Control de Entrada con QR
          </CardTitle>
          <CardDescription>
            Validación de acceso para eventos y categorías autorizadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Evento</label>
              <Select value={eventoId} onValueChange={setEventoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un evento" />
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Punto / Puerta</label>
              <Select value={zonaId} onValueChange={setZonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cualquier zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las zonas</SelectItem>
                  {zonas.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entrada manual o lector de código de barras / QR */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Escanea el QR o ingresa código (ej: INV-0001)..."
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value)}
                autoFocus
                className="text-lg py-6 font-mono"
              />
              <Button type="submit" size="lg" disabled={isPending || !codigoInput.trim()}>
                {isPending ? "Validando..." : "Validar"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {/* Tarjeta de Feedback Canónico */}
      {resultado && (
        <div
          className={`p-6 rounded-2xl border-2 transition-all shadow-md ${
            resultado.resultado === "ACCESO_PERMITIDO"
              ? "bg-emerald-50 border-emerald-500 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-600 dark:text-emerald-100"
              : resultado.resultado === "YA_INGRESO"
              ? "bg-amber-50 border-amber-500 text-amber-950 dark:bg-amber-950/40 dark:border-amber-600 dark:text-amber-100"
              : "bg-red-50 border-red-500 text-red-950 dark:bg-red-950/40 dark:border-red-600 dark:text-red-100"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">
              {resultado.resultado === "ACCESO_PERMITIDO"
                ? "✅"
                : resultado.resultado === "YA_INGRESO"
                ? "⚠️"
                : "⛔"}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold uppercase tracking-wide">
                  {resultado.resultado === "ACCESO_PERMITIDO"
                    ? "Acceso Permitido"
                    : resultado.resultado === "YA_INGRESO"
                    ? "Ya Ingresó"
                    : "No Válida"}
                </span>
                {resultado.categoria_nombre && (
                  <Badge variant="outline" className="font-bold">
                    {resultado.categoria_nombre}
                  </Badge>
                )}
              </div>

              <p className="text-base font-semibold">{resultado.mensaje}</p>

              {resultado.nombre_completo && (
                <div className="pt-2 text-sm space-y-1 opacity-90">
                  <div className="font-bold text-lg">{resultado.nombre_completo}</div>
                  <div>
                    {resultado.documento_identidad || "Sin documento"} •{" "}
                    {resultado.organizacion || "Invitado"}
                  </div>
                  <div className="text-xs">
                    Zona: <strong>{resultado.zona_nombre || "General"}</strong>
                    {resultado.mesa && ` • Mesa: ${resultado.mesa}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial Reciente */}
      {historialReciente.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">
              Últimos accesos validados en esta sesión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {historialReciente.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border text-xs"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {h.resultado === "ACCESO_PERMITIDO"
                      ? "🟢"
                      : h.resultado === "YA_INGRESO"
                      ? "🟡"
                      : "🔴"}
                  </span>
                  <span className="font-medium">{h.nombre_completo || "Asistente"}</span>
                  <span className="text-muted-foreground">({h.categoria_nombre || "General"})</span>
                </div>
                <div className="text-muted-foreground font-mono">
                  {h.hora_ingreso_formateada || h.resultado}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
