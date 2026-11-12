"use client";

/**
 * Asistente «Restablecer contraseñas en bloque» (U2): 1 Elegir, 2 Revisar, 3 Confirmar y
 * Resultado. Sigue el diseño del asistente «Aplicación en lote» del correo de acceso
 * (pasos numerados, contadores, tabla con scroll y «Descargar Excel (.xlsx)»). La vista
 * previa y las ejecuciones con alcance VENCIDA o SIN_PRIMER_INGRESO responden al instante;
 * con TODOS la ejecución es en segundo plano y se consulta su estado. Solo el
 * superadministrador puede (403 → aviso).
 */
import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { guardarArchivo } from "@/shared/lib/exportaciones-asincronas";

import type {
  AlcanceBloque,
  ClasificacionBloque,
  EstadoBloque,
  ResultadoBloque,
  SolicitudBloque,
  VistaPreviaBloque,
} from "../../domain/entities/restablecimiento-bloque";
import {
  calcularRestablecimientoBloqueAction,
  descargarExcelRestablecimientoBloqueAction,
  ejecutarRestablecimientoBloqueAction,
  estadoRestablecimientoBloqueAction,
} from "../../infrastructure/actions/restablecimiento-bloque-actions";
import {
  ADVERTENCIA_TODOS,
  MOTIVO_BLOQUE_MAX,
  MOTIVO_BLOQUE_MIN,
  confirmacionCoincide,
  solicitudBloqueSchema,
} from "../schema/schema-restablecimiento-bloque";

export const INTERVALO_CONSULTA_MS = 2500;
export const MAX_CONSULTAS = 480; // ~20 min

type Paso = 1 | 2 | 3 | "resultado";

interface ErrorAccion {
  error: string;
  status?: number;
}

function esError(valor: unknown): valor is ErrorAccion {
  return typeof valor === "object" && valor !== null && "error" in valor;
}

/** «2026-12-11» o «2026-11-03T10:00:00-04:00» → «11/12/2026». */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

const ALCANCES: { valor: AlcanceBloque; titulo: string; detalle: string }[] = [
  {
    valor: "VENCIDA",
    titulo: "Contraseña inicial vencida (no pudieron ingresar a tiempo)",
    detalle: "Solo las cuentas cuyo plazo para el primer ingreso ya venció.",
  },
  {
    valor: "SIN_PRIMER_INGRESO",
    titulo: "Todos los que aún no han ingresado (renueva su plazo)",
    detalle: "Incluye a quienes todavía están dentro del plazo.",
  },
  {
    valor: "TODOS",
    titulo: "Todos (también quienes ya cambiaron su clave)",
    detalle: "Se cierran las sesiones y se repone la cédula como clave.",
  },
];

const CLASIFICACIONES: { valor: ClasificacionBloque; titulo: string }[] = [
  { valor: "ACTIVOS", titulo: "Activos" },
  { valor: "PASIVOS", titulo: "Pasivos" },
  { valor: "AMBOS", titulo: "Ambos" },
];

const CONDICION_TEXTO: Record<string, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  SIN_ASIGNACION: "Sin asignación",
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function AsistenteRestablecimientoBloque({ abierto, onCerrar }: Props) {
  const [paso, setPaso] = useState<Paso>(1);
  const [clasificacion, setClasificacion] = useState<ClasificacionBloque>("AMBOS");
  const [alcance, setAlcance] = useState<AlcanceBloque>("VENCIDA");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaBloque | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudBloque | null>(null);
  const [confirmacion, setConfirmacion] = useState("");
  const [ejecutando, setEjecutando] = useState(false);
  const [estado, setEstado] = useState<EstadoBloque | null>(null);
  const [resultado, setResultado] = useState<ResultadoBloque | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activo = useRef(true);

  useEffect(() => {
    activo.current = true;
    return () => {
      activo.current = false;
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const limpiar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setPaso(1);
    setClasificacion("AMBOS");
    setAlcance("VENCIDA");
    setEnviarCorreo(false);
    setMotivo("");
    setErrorMotivo(null);
    setError(null);
    setVistaPrevia(null);
    setSolicitud(null);
    setConfirmacion("");
    setEjecutando(false);
    setEstado(null);
    setResultado(null);
  };

  const cerrar = () => {
    if (ejecutando) return;
    onCerrar();
  };

  /** Calcula la vista previa. `aviso` se muestra en el paso 2 (p. ej. tras un 409). */
  async function calcular(entrada: SolicitudBloque, aviso?: string) {
    const valida = solicitudBloqueSchema.safeParse(entrada);
    if (!valida.success) {
      setErrorMotivo(valida.error.issues[0]?.message ?? "Datos no válidos.");
      return;
    }
    setErrorMotivo(null);
    setError(null);
    setCalculando(true);
    try {
      const respuesta = await calcularRestablecimientoBloqueAction(valida.data);
      if (!activo.current) return;
      if (esError(respuesta)) {
        if (respuesta.status === 403) setSinPermiso(true);
        else setError(respuesta.error);
        return;
      }
      setVistaPrevia(respuesta as VistaPreviaBloque);
      setSolicitud(valida.data);
      setConfirmacion("");
      setPaso(2);
      if (aviso) setError(aviso);
    } catch (e) {
      unstable_rethrow(e);
      setError("No fue posible calcular. Revise la conexión e intente de nuevo.");
    } finally {
      if (activo.current) setCalculando(false);
    }
  }

  async function descargarExcel() {
    if (!solicitud) return;
    setDescargando(true);
    setError(null);
    try {
      const res = await descargarExcelRestablecimientoBloqueAction(solicitud);
      if (esError(res)) {
        if (res.status === 403) setSinPermiso(true);
        else setError(res.error);
        return;
      }
      const { base64, nombre } = res as { base64: string; nombre: string };
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      guardarArchivo(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        nombre,
      );
    } catch (e) {
      unstable_rethrow(e);
      setError("No fue posible descargar el reporte Excel.");
    } finally {
      if (activo.current) setDescargando(false);
    }
  }

  function consultar(taskId: string, intento: number) {
    temporizador.current = setTimeout(async () => {
      if (!activo.current) return;
      try {
        const res = await estadoRestablecimientoBloqueAction(taskId);
        if (!activo.current) return;
        if (esError(res)) {
          if (res.status === 403) {
            setSinPermiso(true);
            return;
          }
          // Un corte de red o un 5xx no termina la tarea: se reintenta. Solo los 4xx son definitivos.
          if (res.status !== undefined && res.status >= 400 && res.status < 500) {
            setEjecutando(false);
            setError(res.error);
            return;
          }
        } else {
          const est = res as EstadoBloque;
          setEstado(est);
          if (est.estado !== "EN_PROCESO") {
            setEjecutando(false);
            if (est.estado === "LISTO" && est.resultado) setResultado(est.resultado);
            return;
          }
        }
      } catch (e) {
        unstable_rethrow(e);
        // Fallo transitorio de red: se reintenta en el próximo ciclo.
      }
      if (intento >= MAX_CONSULTAS) {
        setEjecutando(false);
        setError("La consulta tardó demasiado. Revise la bitácora más tarde.");
        return;
      }
      consultar(taskId, intento + 1);
    }, INTERVALO_CONSULTA_MS);
  }

  async function ejecutar() {
    if (!vistaPrevia || !solicitud) return;
    setEjecutando(true);
    setError(null);
    try {
      const respuesta = await ejecutarRestablecimientoBloqueAction({
        ...solicitud,
        confirmacion: vistaPrevia.total,
      });
      if (!activo.current) return;
      if (esError(respuesta)) {
        setEjecutando(false);
        if (respuesta.status === 403) {
          setSinPermiso(true);
        } else if (respuesta.status === 409) {
          await calcular(solicitud, `${respuesta.error} Se recalculó la vista previa.`);
        } else {
          setError(respuesta.error);
        }
        return;
      }
      const est = respuesta as EstadoBloque;
      setEstado(est);
      setPaso("resultado");
      if (est.estado === "EN_PROCESO") {
        consultar(est.taskId, 1);
        return;
      }
      setEjecutando(false);
      if (est.estado === "LISTO" && est.resultado) setResultado(est.resultado);
    } catch (e) {
      unstable_rethrow(e);
      setEjecutando(false);
      setError("No fue posible ejecutar. Revise la conexión e intente de nuevo.");
    }
  }

  const total = vistaPrevia?.total ?? 0;
  const esTodos = solicitud?.alcance === "TODOS";
  const coincide = vistaPrevia ? confirmacionCoincide(confirmacion, total) : false;

  const titulos: Record<string, string> = {
    "1": "Paso 1: Elija a quiénes se restablece la contraseña y por qué.",
    "2": "Paso 2: Revise el impacto calculado antes de continuar.",
    "3": "Paso 3: Confirme la operación auditada.",
    resultado: "Resultado del restablecimiento.",
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && cerrar()}>
      <DialogContent
        className="flex max-h-[88vh] max-w-4xl flex-col overflow-y-auto"
        data-testid="asistente-restablecimiento-bloque"
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-semibold">
              Restablecer contraseñas en bloque
            </DialogTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {([1, 2, 3] as const).map((n, i) => (
                <span key={n} className="flex items-center gap-1.5">
                  {i > 0 && <span className="h-0.5 w-3 bg-muted" />}
                  <span
                    className={`flex size-6 items-center justify-center rounded-full font-semibold ${
                      paso === n || paso === "resultado"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {n}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <DialogDescription className="text-xs">{titulos[String(paso)]}</DialogDescription>
        </DialogHeader>

        {sinPermiso ? (
          <p role="alert" className="py-4 text-sm text-muted-foreground">
            Solo el superadministrador puede restablecer contraseñas en bloque.
          </p>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" role="alert">
                <TriangleAlert className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {paso === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Clasificación</Label>
                  <RadioGroup
                    value={clasificacion}
                    onValueChange={(v) => setClasificacion(v as ClasificacionBloque)}
                    className="grid-cols-3 gap-2"
                    aria-label="Clasificación"
                  >
                    {CLASIFICACIONES.map((c) => (
                      <Label
                        key={c.valor}
                        htmlFor={`bloque-clas-${c.valor}`}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs"
                      >
                        <RadioGroupItem id={`bloque-clas-${c.valor}`} value={c.valor} />
                        {c.titulo}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Alcance</Label>
                  <RadioGroup
                    value={alcance}
                    onValueChange={(v) => setAlcance(v as AlcanceBloque)}
                    className="gap-2"
                    aria-label="Alcance"
                  >
                    {ALCANCES.map((a) => (
                      <Label
                        key={a.valor}
                        htmlFor={`bloque-alc-${a.valor}`}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border p-3"
                      >
                        <RadioGroupItem
                          id={`bloque-alc-${a.valor}`}
                          value={a.valor}
                          className="mt-0.5"
                        />
                        <span className="space-y-0.5">
                          <span className="block text-xs font-medium">{a.titulo}</span>
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {a.detalle}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                  {alcance === "TODOS" && (
                    <Alert className="border-amber-500 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20">
                      <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300">
                        {ADVERTENCIA_TODOS}.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bloque-correo"
                    checked={enviarCorreo}
                    onCheckedChange={(v) => setEnviarCorreo(v === true)}
                  />
                  <Label htmlFor="bloque-correo" className="text-xs">
                    Enviar correo de aviso a cada usuario
                  </Label>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bloque-motivo" className="text-xs font-semibold">
                    Motivo ({MOTIVO_BLOQUE_MIN} a {MOTIVO_BLOQUE_MAX} caracteres)
                  </Label>
                  <Textarea
                    id="bloque-motivo"
                    value={motivo}
                    aria-invalid={!!errorMotivo}
                    onChange={(e) => {
                      setMotivo(e.target.value);
                      setErrorMotivo(null);
                    }}
                  />
                  {errorMotivo && (
                    <p role="alert" className="text-xs text-destructive">
                      {errorMotivo}
                    </p>
                  )}
                </div>
              </div>
            )}

            {paso === 2 && vistaPrevia && (
              <div className="flex flex-col gap-4 overflow-hidden py-2" data-testid="vista-previa-bloque">
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <div className="text-base font-bold" data-testid="cont-total">
                      {vistaPrevia.total}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Total</div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <div className="text-base font-bold" data-testid="cont-activos">
                      {vistaPrevia.activos}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Activos</div>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-2">
                    <div className="text-base font-bold" data-testid="cont-pasivos">
                      {vistaPrevia.pasivos}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Pasivos</div>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-2 dark:bg-amber-950/20">
                    <div
                      className="text-base font-bold text-amber-600 dark:text-amber-400"
                      data-testid="cont-omitidas"
                    >
                      {vistaPrevia.omitidasAdministrativas}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Omitidas (administrativas)</div>
                  </div>
                </div>

                {total === 0 ? (
                  <p className="rounded-md border p-3 text-center text-sm text-muted-foreground">
                    No hay cuentas que restablecer con estos filtros.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-y py-2">
                      <span className="text-xs text-muted-foreground">
                        Mostrando {vistaPrevia.muestra.length} de {total}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={descargarExcel}
                        disabled={descargando}
                      >
                        <FileSpreadsheet className="mr-1.5 size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {descargando ? "Generando..." : "Descargar Excel (.xlsx)"}
                      </Button>
                    </div>

                    <div className="max-h-52 overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24 text-xs">Cédula</TableHead>
                            <TableHead className="text-xs">Nombre</TableHead>
                            <TableHead className="w-32 text-xs">Condición</TableHead>
                            <TableHead className="w-28 text-xs">Venció el</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vistaPrevia.muestra.map((m) => (
                            <TableRow key={m.cuentaId}>
                              <TableCell className="font-mono text-xs">{m.cedula}</TableCell>
                              <TableCell className="text-xs">{m.nombre}</TableCell>
                              <TableCell className="text-xs">
                                {CONDICION_TEXTO[m.condicion] ?? m.condicion}
                              </TableCell>
                              <TableCell className="text-xs">{formatearFecha(m.venceEn)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Nuevo plazo hasta el <strong>{formatearFecha(vistaPrevia.venceEnNuevo)}</strong>.
                    </p>
                  </>
                )}
              </div>
            )}

            {paso === 3 && vistaPrevia && (
              <div className="space-y-4 py-2">
                <Alert className="border-amber-500 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20">
                  <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Acción auditada con impacto en credenciales
                  </AlertTitle>
                  <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300">
                    Se repondrá la cédula como clave de <strong>{total} cuentas</strong>. Queda
                    registrado en la bitácora con su usuario.
                    {esTodos && <> {ADVERTENCIA_TODOS}.</>}
                  </AlertDescription>
                </Alert>
                <div className="space-y-1.5">
                  <Label htmlFor="bloque-confirmacion" className="text-xs font-semibold">
                    Escriba {total} para confirmar
                  </Label>
                  <Input
                    id="bloque-confirmacion"
                    inputMode="numeric"
                    autoComplete="off"
                    className="text-xs"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                  />
                </div>
              </div>
            )}

            {paso === "resultado" && (
              <div role="status" className="space-y-3 py-2" data-testid="resultado-bloque">
                {ejecutando || estado?.estado === "EN_PROCESO" ? (
                  <p className="flex items-center gap-2 text-sm">
                    <RefreshCw className="size-4 animate-spin text-primary" />
                    Procesando… puede tardar unos minutos.
                  </p>
                ) : resultado ? (
                  <>
                    <p className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>
                        Se restableció el acceso a <strong>{resultado.restablecidas}</strong>{" "}
                        cuentas. Nuevo plazo hasta el{" "}
                        <strong>
                          {formatearFecha(resultado.venceEnNuevo ?? vistaPrevia?.venceEnNuevo)}
                        </strong>
                        . Correos enviados: {solicitud?.enviarCorreo ? "sí" : "no"}. Omitidas:{" "}
                        {resultado.omitidas}.
                      </span>
                    </p>
                    {resultado.errores > 0 && (
                      <p className="text-sm text-destructive">
                        Errores: {resultado.errores}. Revise la bitácora.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-destructive">
                    {estado?.mensaje ?? "El restablecimiento no terminó correctamente."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter className="mt-4 flex flex-col-reverse items-center justify-between gap-2 sm:flex-row">
          <div>
            {!sinPermiso && (paso === 2 || paso === 3) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setPaso(paso === 3 ? 2 : 1);
                }}
                disabled={ejecutando || calculando}
              >
                <ArrowLeft className="mr-1.5 size-3.5" />
                Atrás
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {paso !== "resultado" && !sinPermiso && (
              <Button variant="outline" size="sm" onClick={cerrar} disabled={ejecutando}>
                Cancelar
              </Button>
            )}
            {paso === 1 && !sinPermiso && (
              <Button
                size="sm"
                disabled={calculando}
                onClick={() => calcular({ clasificacion, alcance, enviarCorreo, motivo })}
              >
                {calculando ? "Calculando…" : "Siguiente →"}
                {!calculando && <ArrowRight className="ml-1.5 size-3.5" />}
              </Button>
            )}
            {paso === 2 && !sinPermiso && (
              <Button
                size="sm"
                disabled={total === 0 || calculando}
                onClick={() => {
                  setError(null);
                  setConfirmacion("");
                  setPaso(3);
                }}
              >
                Siguiente: Confirmar →
              </Button>
            )}
            {paso === 3 && !sinPermiso && (
              <Button size="sm" disabled={!coincide || ejecutando} onClick={ejecutar}>
                {ejecutando ? "Ejecutando…" : `Restablecer ${total} cuentas`}
              </Button>
            )}
            {(paso === "resultado" || sinPermiso) && (
              <>
                {!sinPermiso && (
                  <Button variant="outline" size="sm" onClick={limpiar} disabled={ejecutando}>
                    Nuevo restablecimiento
                  </Button>
                )}
                <Button size="sm" onClick={cerrar} disabled={ejecutando}>
                  Cerrar
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
