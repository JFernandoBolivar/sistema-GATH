"use client";

/**
 * Tarjeta «Restablecer contraseñas en bloque» (U2) de Parámetros. Calcula la vista
 * previa, pide escribir el número exacto para ejecutar y consulta el estado de la tarea
 * en segundo plano hasta que termine. Solo el superadministrador puede (403 → aviso).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { KeyRound, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type {
  AlcanceBloque,
  ClasificacionBloque,
  EstadoBloque,
  SolicitudBloque,
  VistaPreviaBloque,
} from "../../domain/entities/restablecimiento-bloque";
import {
  calcularRestablecimientoBloqueAction,
  ejecutarRestablecimientoBloqueAction,
  estadoRestablecimientoBloqueAction,
} from "../../infrastructure/actions/restablecimiento-bloque-actions";
import {
  ADVERTENCIA_TODOS,
  MOTIVO_BLOQUE_MIN,
  confirmacionCoincide,
  solicitudBloqueSchema,
} from "../schema/schema-restablecimiento-bloque";

export const INTERVALO_CONSULTA_MS = 2500;
export const MAX_CONSULTAS = 480; // ~20 min

interface ErrorAccion {
  error: string;
  status?: number;
}

function esError(valor: unknown): valor is ErrorAccion {
  return typeof valor === "object" && valor !== null && "error" in valor;
}

export function TarjetaRestablecimientoBloque() {
  const [clasificacion, setClasificacion] = useState<ClasificacionBloque>("AMBOS");
  const [alcance, setAlcance] = useState<AlcanceBloque>("SIN_PRIMER_INGRESO");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaBloque | null>(null);
  const [solicitudCalculada, setSolicitudCalculada] = useState<SolicitudBloque | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [ejecutando, setEjecutando] = useState(false);
  const [estado, setEstado] = useState<EstadoBloque | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activo = useRef(true);
  const consultarRef = useRef<
    | ((id: string, n: number, m: "calculo" | "ejecucion", s?: SolicitudBloque) => Promise<void>)
    | null
  >(null);

  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const resetearResultados = () => {
    setVistaPrevia(null);
    setSolicitudCalculada(null);
    setEstado(null);
    setError(null);
  };

  const manejarError = (e: ErrorAccion): void => {
    if (e.status === 403) {
      setSinPermiso(true);
      return;
    }
    if (e.status === 409) {
      setVistaPrevia(null);
      setSolicitudCalculada(null);
      setDialogoAbierto(false);
      setError(`${e.error} Vuelva a pulsar «Calcular».`);
      return;
    }
    setError(e.error);
  };

  const consultar = useCallback(
    async (
      taskId: string,
      intento: number,
      modo: "calculo" | "ejecucion",
      solicitud?: SolicitudBloque,
    ) => {
      if (!activo.current) return;
      const terminarConError = (mensaje: string) => {
        if (modo === "calculo") setCalculando(false);
        else setEjecutando(false);
        setError(mensaje);
      };
      try {
        const respuesta = await estadoRestablecimientoBloqueAction(taskId);
        if (!activo.current) return;
        if (esError(respuesta)) {
          if (respuesta.status === 403) {
            setSinPermiso(true);
            return;
          }
          // Un corte de red o un 5xx mientras se espera no termina el cálculo: se
          // reintenta en el próximo ciclo. Solo los rechazos (4xx) son definitivos.
          if (respuesta.status !== undefined && respuesta.status >= 400 && respuesta.status < 500) {
            return terminarConError(respuesta.error);
          }
        } else {
          const est = respuesta as EstadoBloque;
          if (modo === "ejecucion") setEstado(est);
          if (est.estado !== "EN_PROCESO") {
            if (modo === "ejecucion") {
              setEjecutando(false);
              return;
            }
            setCalculando(false);
            if (est.estado === "LISTO" && est.resultado && solicitud) {
              const r = est.resultado;
              setVistaPrevia({
                revisadas: r.revisadas,
                activos: r.activos,
                pasivos: r.pasivos,
                total: r.total,
                omitidasAdministrativas: r.omitidas,
              });
              setSolicitudCalculada(solicitud);
            } else {
              setError(est.mensaje ?? "No se pudo calcular la vista previa. Intente de nuevo.");
            }
            return;
          }
        }
      } catch (e) {
        unstable_rethrow(e);
        // Fallo transitorio de red: se reintenta en el próximo ciclo.
      }
      if (intento >= MAX_CONSULTAS) {
        return terminarConError("La consulta tardó demasiado. Intente de nuevo más tarde.");
      }
      temporizador.current = setTimeout(
        () => void consultarRef.current?.(taskId, intento + 1, modo, solicitud),
        INTERVALO_CONSULTA_MS,
      );
    },
    [],
  );

  useEffect(() => {
    consultarRef.current = consultar;
  }, [consultar]);

  async function calcular() {
    const solicitud: SolicitudBloque = { clasificacion, alcance, enviarCorreo, motivo };
    const valida = solicitudBloqueSchema.safeParse(solicitud);
    if (!valida.success) {
      setErrorMotivo(valida.error.issues[0]?.message ?? "Datos no válidos.");
      return;
    }
    setErrorMotivo(null);
    resetearResultados();
    setCalculando(true);
    try {
      const respuesta = await calcularRestablecimientoBloqueAction(valida.data);
      if (esError(respuesta)) {
        setCalculando(false);
        return manejarError(respuesta);
      }
      const { taskId } = respuesta as EstadoBloque;
      temporizador.current = setTimeout(() => void consultar(taskId, 1, "calculo", valida.data), 0);
    } catch (e) {
      unstable_rethrow(e);
      setCalculando(false);
      setError("No fue posible calcular. Revise la conexión e intente de nuevo.");
    }
  }

  async function ejecutar() {
    if (!vistaPrevia || !solicitudCalculada) return;
    setEjecutando(true);
    setError(null);
    try {
      const respuesta = await ejecutarRestablecimientoBloqueAction({
        ...solicitudCalculada,
        confirmacion: vistaPrevia.total,
      });
      if (esError(respuesta)) {
        setEjecutando(false);
        return manejarError(respuesta);
      }
      const est = respuesta as EstadoBloque;
      setDialogoAbierto(false);
      setConfirmacion("");
      setEstado(est);
      temporizador.current = setTimeout(
        () => void consultar(est.taskId, 1, "ejecucion"),
        INTERVALO_CONSULTA_MS,
      );
    } catch (e) {
      unstable_rethrow(e);
      setEjecutando(false);
      setError("No fue posible ejecutar. Revise la conexión e intente de nuevo.");
    }
  }

  if (sinPermiso) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Restablecer contraseñas en bloque</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="text-sm text-muted-foreground">
            Solo el superadministrador puede restablecer contraseñas en bloque.
          </p>
        </CardContent>
      </Card>
    );
  }

  const coincide = vistaPrevia ? confirmacionCoincide(confirmacion, vistaPrevia.total) : false;
  const enCurso = ejecutando || estado?.estado === "EN_PROCESO";

  return (
    <Card data-testid="tarjeta-restablecimiento-bloque">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden="true" /> Restablecer contraseñas en bloque
        </CardTitle>
        <CardDescription>
          Repone la cédula como clave y abre un nuevo plazo para quienes no pudieron ingresar a
          tiempo. Se aplica en segundo plano y queda en la bitácora.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bloque-clasificacion">Clasificación</Label>
            <Select
              value={clasificacion}
              disabled={enCurso}
              onValueChange={(v) => {
                setClasificacion(v as ClasificacionBloque);
                resetearResultados();
              }}
            >
              <SelectTrigger id="bloque-clasificacion" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVOS">Activos</SelectItem>
                <SelectItem value="PASIVOS">Pasivos</SelectItem>
                <SelectItem value="AMBOS">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bloque-alcance">Alcance</Label>
            <Select
              value={alcance}
              disabled={enCurso}
              onValueChange={(v) => {
                setAlcance(v as AlcanceBloque);
                resetearResultados();
              }}
            >
              <SelectTrigger id="bloque-alcance" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIN_PRIMER_INGRESO">
                  Solo quienes aún no han ingresado por primera vez
                </SelectItem>
                <SelectItem value="TODOS">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="bloque-correo"
            checked={enviarCorreo}
            disabled={enCurso}
            onCheckedChange={(v) => setEnviarCorreo(v === true)}
          />
          <Label htmlFor="bloque-correo">Enviar correo de aviso a cada usuario</Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bloque-motivo">Motivo (mínimo {MOTIVO_BLOQUE_MIN} caracteres)</Label>
          <Textarea
            id="bloque-motivo"
            value={motivo}
            disabled={enCurso}
            aria-invalid={!!errorMotivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setErrorMotivo(null);
            }}
          />
          {errorMotivo && (
            <p role="alert" className="text-sm text-destructive">
              {errorMotivo}
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={calcular}
            disabled={calculando || enCurso}
          >
            {calculando ? "Calculando… puede tardar unos minutos" : "Calcular"}
          </Button>
        </div>

        {vistaPrevia && (
          <div
            className="flex flex-col gap-3 rounded-md border p-3"
            data-testid="vista-previa-bloque"
          >
            <p className="text-sm">
              Se restablecerá la clave de <strong>{vistaPrevia.total}</strong> cuentas:{" "}
              {vistaPrevia.activos} activos y {vistaPrevia.pasivos} pasivos.{" "}
              {vistaPrevia.omitidasAdministrativas} omitidas por ser administrativas.
            </p>
            <div>
              <Button
                type="button"
                disabled={vistaPrevia.total === 0 || enCurso}
                onClick={() => {
                  setConfirmacion("");
                  setDialogoAbierto(true);
                }}
              >
                Restablecer…
              </Button>
            </div>
          </div>
        )}

        {estado && (
          <div role="status" className="rounded-md border p-3 text-sm" data-testid="estado-bloque">
            {estado.estado === "EN_PROCESO" && (
              <p>Restablecimiento en curso… puede tardar unos minutos.</p>
            )}
            {estado.estado === "ERROR" && (
              <p className="text-destructive">{estado.mensaje ?? "El restablecimiento falló."}</p>
            )}
            {estado.estado === "CANCELADO" && <p>El restablecimiento fue cancelado.</p>}
            {estado.estado === "LISTO" && estado.resultado && (
              <p>
                Terminado. Revisadas: <strong>{estado.resultado.revisadas}</strong>, restablecidas:{" "}
                <strong>{estado.resultado.restablecidas}</strong>, omitidas:{" "}
                <strong>{estado.resultado.omitidas}</strong>, errores:{" "}
                <strong>{estado.resultado.errores}</strong>.
              </p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={dialogoAbierto}
        onOpenChange={(abierto) => !ejecutando && setDialogoAbierto(abierto)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar restablecimiento en bloque</DialogTitle>
            <DialogDescription>
              Escriba <strong>{vistaPrevia?.total}</strong> para confirmar que desea restablecer esa
              cantidad de cuentas.
            </DialogDescription>
          </DialogHeader>
          {solicitudCalculada?.alcance === "TODOS" && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {ADVERTENCIA_TODOS}.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bloque-confirmacion">Número de cuentas</Label>
            <Input
              id="bloque-confirmacion"
              inputMode="numeric"
              autoComplete="off"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={ejecutando}
              onClick={() => setDialogoAbierto(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={!coincide || ejecutando} onClick={ejecutar}>
              {ejecutando ? "Ejecutando…" : "Ejecutar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
