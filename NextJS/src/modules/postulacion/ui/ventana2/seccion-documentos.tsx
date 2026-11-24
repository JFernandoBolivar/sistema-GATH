"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2, PenLine, Save, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  cuerpoDeValores,
  ETIQUETA_ESTADO_DOCUMENTO,
  hayCambios,
  huellaCorta,
  obligatoriosVacios,
  pendientesDeDocumentos,
  valoresAControles,
  type DocumentoExpedienteDTO,
} from "@/modules/documentos/domain/lib/documentos-expediente";
import { CamposPropiosFormulario } from "@/modules/documentos/ui/components/campos-propios-formulario";
import type { FaltanteDTO } from "../../application/dtos/postulacion-dto";
import { formatearFechaHora } from "../../domain/expediente";
import {
  firmarDocumentoAction,
  guardarCamposDocumentoAction,
  listarDocumentosAction,
  refrescarVentana2Action,
} from "../../infrastructure/actions/postulacion-actions";

interface Props {
  onFaltantes: (f: FaltanteDTO[]) => void;
  onContinuar: () => void;
  onAnterior?: () => void;
  onSesionCaida: () => void;
}

const urlPlanilla = (codigo: string, tipo: "vista-previa" | "archivo") => `/postulacion/documento/${encodeURIComponent(codigo)}?tipo=${tipo}`;

function ClaseEstado({ doc }: { doc: DocumentoExpedienteDTO }) {
  const firmado = doc.estado === "firmado";
  const pendiente = doc.estado === "pendiente_datos" || (doc.requiereFirma && !firmado);
  return (
    <Badge variant={firmado ? "default" : "outline"} className={pendiente ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : undefined} data-testid="estado-documento">
      {firmado ? <CheckCircle2 aria-hidden /> : null}
      {doc.estado === "listo_para_revisar" && doc.requiereFirma ? "Falta tu firma" : ETIQUETA_ESTADO_DOCUMENTO[doc.estado]}
    </Badge>
  );
}

interface TarjetaProps {
  doc: DocumentoExpedienteDTO;
  onActualizado: (d: DocumentoExpedienteDTO) => void;
  onSesionCaida: () => void;
}

function TarjetaDocumento({ doc, onActualizado, onSesionCaida }: TarjetaProps) {
  const [controles, setControles] = useState(() => valoresAControles(doc.camposPropios, doc.valores));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [acepto, setAcepto] = useState(false);
  const [ocupado, setOcupado] = useState<"guardar" | "firmar" | "ver" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "info" | "error"; texto: string } | null>(null);
  const cambios = hayCambios(doc.camposPropios, controles, doc.valores);
  const firmado = doc.estado === "firmado";
  const idBase = `doc-${doc.codigo}`;

  function cambiar(clave: string, valor: string) {
    setControles((c) => ({ ...c, [clave]: valor }));
    setErrores((e) => {
      if (!e[clave]) return e;
      const { [clave]: _quitado, ...resto } = e;
      return resto;
    });
    setAviso(null);
  }

  async function guardar(): Promise<DocumentoExpedienteDTO | null> {
    setOcupado("guardar");
    setAviso(null);
    const r = await guardarCamposDocumentoAction(doc.codigo, cuerpoDeValores(doc.camposPropios, controles));
    setOcupado(null);
    if (!r.ok) {
      if (r.sesionCaida) {
        onSesionCaida();
        return null;
      }
      const porCampo: Record<string, string> = {};
      for (const [ruta, mensajes] of Object.entries(r.errores ?? {})) porCampo[ruta.replace(/^valores\./, "")] = mensajes[0];
      setErrores(porCampo);
      setAviso({ tipo: "error", texto: r.mensaje });
      return null;
    }
    setErrores({});
    onActualizado(r.datos);
    setControles(valoresAControles(r.datos.camposPropios, r.datos.valores));
    setAviso(
      r.datos.firmaInvalidada
        ? { tipo: "info", texto: "Cambiaste datos: tu firma anterior quedó sin efecto. Vuelve a firmar el documento." }
        : { tipo: "exito", texto: "Datos guardados." },
    );
    return r.datos;
  }

  async function verPlanilla() {
    // La pestaña se abre al tocar (antes de esperar al servidor) para que el navegador no la bloquee.
    const ventana = window.open("about:blank", "_blank");
    if (cambios && (await guardar()) === null) {
      ventana?.close();
      return;
    }
    const url = urlPlanilla(doc.codigo, "vista-previa");
    if (ventana) ventana.location.href = url;
    else window.location.assign(url);
  }

  async function firmar() {
    const vacios = obligatoriosVacios(doc.camposPropios, controles);
    if (vacios.length > 0) {
      setAviso({ tipo: "error", texto: `Completa antes de firmar: ${vacios.join(", ")}.` });
      return;
    }
    if (cambios && (await guardar()) === null) return;
    setOcupado("firmar");
    setAviso(null);
    const r = await firmarDocumentoAction(doc.codigo, acepto);
    setOcupado(null);
    if (!r.ok) {
      if (r.sesionCaida) return onSesionCaida();
      return setAviso({ tipo: "error", texto: r.mensaje });
    }
    setAcepto(false);
    onActualizado(r.datos);
    setAviso({ tipo: "exito", texto: "Documento firmado. Quedó registrada tu conformidad." });
  }

  const puedeFirmar = doc.requiereFirma && !firmado && acepto && ocupado === null;

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6" aria-labelledby={`${idBase}-titulo`} data-testid={`documento-${doc.codigo}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${idBase}-titulo`} className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="break-words">{doc.nombre}</span>
          </h3>
          {doc.descripcion && <p className="mt-1 text-sm text-pretty text-muted-foreground">{doc.descripcion}</p>}
        </div>
        <ClaseEstado doc={doc} />
      </div>

      {doc.firmaInvalidada && !firmado && (
        <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100" role="status">
          <AlertCircle aria-hidden />
          <AlertDescription className="text-amber-900 dark:text-amber-100">
            Tu firma anterior quedó sin efecto porque cambiaron datos del documento. Revísalo y vuelve a firmarlo.
          </AlertDescription>
        </Alert>
      )}

      {doc.camposPropios.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-medium">Datos que pide este documento</p>
          <CamposPropiosFormulario idBase={idBase} campos={doc.camposPropios} controles={controles} onCambio={cambiar} errores={errores} deshabilitado={ocupado !== null} />
        </div>
      )}

      {aviso && (
        <p role={aviso.tipo === "error" ? "alert" : "status"} className={aviso.tipo === "error" ? "mt-4 text-sm text-destructive" : aviso.tipo === "info" ? "mt-4 text-sm text-amber-800 dark:text-amber-200" : "mt-4 text-sm text-emerald-700 dark:text-emerald-400"}>
          {aviso.texto}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {doc.camposPropios.length > 0 && (
          <Button type="button" variant="outline" size="lg" onClick={() => void guardar()} disabled={ocupado !== null || !cambios}>
            {ocupado === "guardar" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Guardar datos
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" onClick={() => void verPlanilla()} disabled={ocupado !== null}>
          <FileText aria-hidden />
          Ver mi planilla
        </Button>
      </div>

      {doc.requiereFirma && (
        <div className="mt-5 rounded-lg border bg-muted/40 p-4" data-testid="bloque-firma">
          {firmado && doc.firma ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="size-5" aria-hidden /> Documento firmado
              </p>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha y hora</dt>
                  <dd className="font-medium">{formatearFechaHora(doc.firma.firmadoEn)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Huella del documento (sha256)</dt>
                  <dd className="font-mono text-xs break-all" title={doc.firma.sha256}>
                    {huellaCorta(doc.firma.sha256)}
                  </dd>
                </div>
              </dl>
              {cambios && <p className="text-amber-800 dark:text-amber-200">Si guardas estos cambios, tendrás que firmar de nuevo.</p>}
              <a href={urlPlanilla(doc.codigo, "archivo")} target="_blank" rel="noreferrer" className="w-fit text-sm font-medium text-primary underline-offset-2 hover:underline">
                Ver mi documento firmado
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Checkbox id={`${idBase}-acepto`} checked={acepto} onCheckedChange={(v) => setAcepto(v === true)} disabled={ocupado !== null} className="mt-1 size-5" />
                <Label htmlFor={`${idBase}-acepto`} className="cursor-pointer text-sm leading-relaxed font-normal text-pretty">
                  {doc.textoConformidad || "Declaro que los datos de este documento son verdaderos. Acepto y declaro."}
                </Label>
              </div>
              <Button type="button" size="lg" className="sm:w-fit" onClick={() => void firmar()} disabled={!puedeFirmar}>
                {ocupado === "firmar" ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
                Firmar documento
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Paso «Documentos» de la Ventana 2: campos propios, «Ver mi planilla» y firma por clic de cada plantilla activa. */
export function SeccionDocumentos({ onFaltantes, onContinuar, onAnterior, onSesionCaida }: Props) {
  const [docs, setDocs] = useState<DocumentoExpedienteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void listarDocumentosAction().then((r) => {
      if (!vigente) return;
      if (!r.ok) {
        if (r.sesionCaida) return onSesionCaida();
        return setError(r.mensaje);
      }
      setDocs(r.datos);
    });
    return () => {
      vigente = false;
    };
  }, [onSesionCaida]);

  // Lo que falta para enviar lo decide el servidor: se relee tras cada cambio para que el avance sea fiel.
  const refrescar = useCallback(async () => {
    const r = await refrescarVentana2Action();
    if (r.ok) onFaltantes(r.datos.faltantes);
  }, [onFaltantes]);

  const alActualizar = useCallback(
    (d: DocumentoExpedienteDTO) => {
      setDocs((actuales) => (actuales ?? []).map((x) => (x.codigo === d.codigo ? d : x)));
      void refrescar();
    },
    [refrescar],
  );

  const pendientes = useMemo(() => (docs ? pendientesDeDocumentos(docs) : 0), [docs]);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          Revisa tus planillas ya prellenadas con tus datos, completa lo que pidan y fírmalas con un clic de conformidad. Si cambias un dato
          después de firmar, tendrás que firmar otra vez.
        </p>
      </section>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {docs === null && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando tus documentos…
        </p>
      )}
      {docs?.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Por ahora no tienes documentos por completar.</p>}
      {docs?.map((d) => <TarjetaDocumento key={`${d.codigo}-${d.version}`} doc={d} onActualizado={alActualizar} onSesionCaida={onSesionCaida} />)}

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border sm:shadow-sm">
        {onAnterior ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAnterior} className="self-start">
            <ArrowLeft aria-hidden /> Anterior
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-1 sm:items-end">
          {docs && pendientes > 0 && (
            <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
              {pendientes === 1 ? "Te falta 1 documento por completar o firmar." : `Te faltan ${pendientes} documentos por completar o firmar.`}
            </p>
          )}
          <Button type="button" size="lg" onClick={onContinuar}>
            Continuar <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
