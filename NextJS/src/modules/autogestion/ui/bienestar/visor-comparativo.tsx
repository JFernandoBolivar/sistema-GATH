"use client";

import { useMemo, useState } from "react";
import { Check, CircleCheck, CircleX, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { FieldCompare, type TipoDiferencia } from "@/shared/ui/components/field-compare";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import type {
  CambioDTO,
  DecisionCampoDTO,
  SolicitudDetalleDTO,
} from "../../application/dtos/solicitud-dto";
import {
  cambiosPendientes,
  resultadoDecision,
  TEXTO_RESULTADO,
  validarDecisiones,
} from "../../domain/services/reglas-decision";
import { etiquetaCampo, nombreSeccion } from "../../domain/value-objects/campos-seccion";
import { decidirCambiosAction } from "../../infrastructure/actions/solicitudes-actions";
import { PRESENTACION_DECISION } from "../estado-solicitud-ui";
import { formatearValor, type NombresCatalogo } from "../formato-solicitud";
import { formatearTamano } from "../../domain/services/validar-soporte";
import { useNombresCatalogo } from "../solicitudes/use-nombres-catalogo";

type Elegido = { aprobado: boolean; motivo: string };

function tipoDiferencia(c: CambioDTO): TipoDiferencia {
  if (c.accion === "CREAR") return "nuevo";
  return JSON.stringify(c.valorActual) === JSON.stringify(c.valorPropuesto)
    ? "coincide"
    : "difiere";
}

function valorActualDe(c: CambioDTO, nombres: NombresCatalogo): string {
  if (c.accion === "CREAR") return "No existe todavía";
  if (c.campo === "profile")
    return c.valorActual ? "Hay una foto registrada" : "Sin foto registrada";
  return formatearValor(c.valorActual, c.campo, nombres);
}

interface Props {
  detalle: SolicitudDetalleDTO;
  /** Quien decide: el servidor exige `bienestar.aprobar` y que no sea el propio solicitante. */
  puedeDecidir: boolean;
  /** Motivo por el que no puede decidir (p. ej. es su propia solicitud). */
  motivoBloqueo?: string;
  onDecidido: () => void;
}

/** Visor comparativo campo por campo: valor actual frente a propuesto, soportes visibles y decisión por campo. */
export function VisorComparativo({ detalle, puedeDecidir, motivoBloqueo, onDecidido }: Props) {
  const nombres = useNombresCatalogo(detalle.cambios);
  const pendientes = useMemo(() => cambiosPendientes(detalle.cambios), [detalle.cambios]);
  const [elegidos, setElegidos] = useState<Record<string, Elegido>>({});
  const [motivoGeneral, setMotivoGeneral] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [conflicto, setConflicto] = useState<string | null>(null);

  const decisiones: DecisionCampoDTO[] = Object.entries(elegidos).map(([cambioId, e]) => ({
    cambioId,
    aprobado: e.aprobado,
    motivo: e.motivo,
  }));
  const resultado = decisiones.length === pendientes.length ? resultadoDecision(decisiones) : null;

  function elegir(id: string, parcial: Partial<Elegido>) {
    setElegidos((previo) => ({
      ...previo,
      [id]: { ...(previo[id] ?? { aprobado: true, motivo: "" }), ...parcial },
    }));
  }

  function aprobarTodos() {
    setElegidos(
      Object.fromEntries(
        pendientes.map((c) => [
          c.id,
          {
            aprobado: !c.conflicto,
            motivo: c.conflicto ? "La ficha cambió después de la propuesta." : "",
          },
        ]),
      ),
    );
  }

  function rechazarTodos() {
    setElegidos(
      Object.fromEntries(
        pendientes.map((c) => [c.id, { aprobado: false, motivo: elegidos[c.id]?.motivo ?? "" }]),
      ),
    );
  }

  function revisar() {
    const problemas = validarDecisiones(detalle.cambios, decisiones, motivoGeneral);
    setErrores(problemas);
    if (problemas.length === 0) setConfirmar(true);
  }

  async function confirmarDecision() {
    setConfirmar(false);
    setEnviando(true);
    setConflicto(null);
    const res = await decidirCambiosAction(detalle.id, { decisiones, motivoGeneral });
    setEnviando(false);
    if (res.ok) {
      toast.success(res.mensaje);
      onDecidido();
    } else {
      // 409: otra persona decidió, la ficha cambió o es la propia solicitud; el mensaje viene del servidor.
      setConflicto(res.mensaje);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {detalle.soportes.length > 0 ? (
        <section aria-labelledby="soportes-titulo" className="rounded-xl border bg-card p-5">
          <h2 id="soportes-titulo" className="mb-3 text-xl font-bold">
            Soportes del trabajador
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {detalle.soportes.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {nombreSeccion(s.seccion)} · {s.tipo.replaceAll("_", " ").toLowerCase()}
                </p>
                {s.mimeReal.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen autenticada servida por el proxy de mismo origen
                  <img
                    src={s.urlArchivo}
                    alt={`Soporte de ${nombreSeccion(s.seccion)}: ${s.nombreOriginal || "imagen"}`}
                    className="max-h-64 w-full rounded-md border object-contain"
                  />
                ) : null}
                <a
                  href={s.urlArchivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 break-all text-primary hover:underline"
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  {s.nombreOriginal || "Abrir soporte"} ({formatearTamano(s.tamanoBytes)})
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-lg border bg-card p-4 text-base text-muted-foreground">
          El trabajador no adjuntó soportes en esta solicitud.
        </p>
      )}

      <section aria-labelledby="campos-titulo" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="campos-titulo" className="text-xl font-bold">
            Cambios propuestos ({detalle.cambios.length})
          </h2>
          {puedeDecidir && pendientes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={aprobarTodos}>
                <CircleCheck aria-hidden /> Aprobar todos
              </Button>
              <Button type="button" variant="outline" onClick={rechazarTodos}>
                <CircleX aria-hidden /> Rechazar todos
              </Button>
            </div>
          ) : null}
        </div>

        {motivoBloqueo ? (
          <p
            role="note"
            className="rounded-md bg-warning-soft p-3 text-base font-medium text-warning"
          >
            {motivoBloqueo}
          </p>
        ) : null}

        {detalle.cambios.map((c, i) => {
          const d = PRESENTACION_DECISION[c.decision];
          const e = elegidos[c.id];
          const esPendiente = c.decision === "PENDIENTE";
          const idCampo = `cambio-${i}`;
          return (
            <FieldCompare
              key={c.id}
              id={idCampo}
              etiqueta={`${nombreSeccion(c.seccion)} · ${etiquetaCampo(c.campo, c.entidadDestino)}`}
              actual={valorActualDe(c, nombres)}
              propuesto={
                c.campo === "profile"
                  ? "Foto nueva (ver soportes)"
                  : formatearValor(c.valorPropuesto, c.campo, nombres)
              }
              diferencia={tipoDiferencia(c)}
              conflicto={c.conflicto}
              decision={
                esPendiente && puedeDecidir ? (
                  <fieldset className="flex flex-col gap-3">
                    <legend className="sr-only">
                      Decisión sobre {etiquetaCampo(c.campo, c.entidadDestino)}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={e?.aprobado === true ? "default" : "outline"}
                        aria-pressed={e?.aprobado === true}
                        disabled={c.conflicto}
                        onClick={() => elegir(c.id, { aprobado: true, motivo: "" })}
                      >
                        <Check aria-hidden /> Aprobar
                      </Button>
                      <Button
                        type="button"
                        variant={e?.aprobado === false ? "destructive" : "outline"}
                        aria-pressed={e?.aprobado === false}
                        onClick={() => elegir(c.id, { aprobado: false })}
                      >
                        <X aria-hidden /> Rechazar
                      </Button>
                    </div>
                    {e?.aprobado === false ? (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`${idCampo}-motivo`} className="text-sm font-medium">
                          Motivo del rechazo (obligatorio)
                        </label>
                        <Textarea
                          id={`${idCampo}-motivo`}
                          rows={2}
                          className="resize-none"
                          maxLength={500}
                          value={e.motivo}
                          onChange={(ev) =>
                            elegir(c.id, { aprobado: false, motivo: ev.target.value })
                          }
                        />
                      </div>
                    ) : null}
                  </fieldset>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge texto={d.texto} tono={d.tono} icono={d.icono} />
                    {c.decision === "RECHAZADO" && c.motivoDecision ? (
                      <span className="text-sm text-danger">Motivo: {c.motivoDecision}</span>
                    ) : null}
                  </div>
                )
              }
            />
          );
        })}
      </section>

      {puedeDecidir && pendientes.length > 0 ? (
        <section
          aria-labelledby="confirmar-titulo"
          className="flex flex-col gap-4 rounded-xl border bg-card p-5"
        >
          <h2 id="confirmar-titulo" className="text-xl font-bold">
            Resolver la solicitud
          </h2>
          <p className="text-base text-muted-foreground">
            Decida todos los campos. Lo aprobado se aplica a la ficha del trabajador; lo rechazado
            queda con su motivo. Basta la decisión de una sola persona.
          </p>
          {resultado === "RECHAZO" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="motivo-general" className="text-base font-medium">
                Motivo general del rechazo (obligatorio si no se aprueba ningún campo)
              </label>
              <Textarea
                id="motivo-general"
                rows={3}
                className="resize-none"
                maxLength={500}
                value={motivoGeneral}
                onChange={(ev) => setMotivoGeneral(ev.target.value)}
              />
            </div>
          ) : null}

          {errores.length > 0 ? (
            <div role="alert" className="rounded-md bg-danger-soft p-3 text-danger">
              <ul className="list-disc pl-5">
                {errores.map((er) => (
                  <li key={er}>{er}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {conflicto ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger-soft p-3 text-danger"
            >
              <p className="font-semibold">No se pudo registrar la decisión</p>
              <p>{conflicto}</p>
              <Button type="button" variant="outline" className="w-fit" onClick={onDecidido}>
                Recargar la solicitud
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full sm:w-fit"
            onClick={revisar}
            disabled={enviando}
          >
            {enviando ? "Registrando decisión…" : "Revisar y confirmar decisión"}
          </Button>
        </section>
      ) : null}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar la decisión?</AlertDialogTitle>
            <AlertDialogDescription>
              {resultado ? `${TEXTO_RESULTADO[resultado]}: ` : ""}
              {decisiones.filter((d) => d.aprobado).length} campo(s) aprobado(s) y{" "}
              {decisiones.filter((d) => !d.aprobado).length} rechazado(s). Los campos aprobados se
              escribirán en la ficha del trabajador y esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver a revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmarDecision()}>
              Confirmar decisión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
