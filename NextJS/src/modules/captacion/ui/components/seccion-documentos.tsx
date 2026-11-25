"use client";

import { useState } from "react";
import useSWR from "swr";
import { CheckCircle2, Download, Eye, FileText, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ETIQUETA_ESTADO_DOCUMENTO,
  huellaCorta,
  type DocumentoExpedienteDTO,
} from "@/modules/documentos/domain/lib/documentos-expediente";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { formatearFechaHora } from "../../domain/formato";
import { descargarDocumentoExpedienteAction, listarDocumentosExpedienteAction } from "../../infrastructure/actions/captacion-actions";

async function cargar(id: string): Promise<DocumentoExpedienteDTO[]> {
  const r = await listarDocumentosExpedienteAction(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function etiquetaDe(d: DocumentoExpedienteDTO): string {
  if (d.estado === "listo_para_revisar" && d.requiereFirma) return "Falta la firma del postulante";
  return ETIQUETA_ESTADO_DOCUMENTO[d.estado];
}

function bytesDeBase64(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function FilaDocumento({ doc, expedienteId }: { doc: DocumentoExpedienteDTO; expedienteId: string }) {
  const [ocupado, setOcupado] = useState<"ver" | "descargar" | null>(null);
  const firmado = doc.estado === "firmado";
  const sinFirmar = !firmado && doc.estado !== "generado";

  async function abrir(modo: "ver" | "descargar") {
    // La pestaña se abre al tocar (antes de esperar al servidor) para que el navegador no la bloquee.
    const ventana = modo === "ver" ? window.open("about:blank", "_blank") : null;
    setOcupado(modo);
    const r = await descargarDocumentoExpedienteAction(expedienteId, doc.codigo);
    setOcupado(null);
    if (!r.ok) {
      ventana?.close();
      toast.error(r.error);
      return;
    }
    const url = URL.createObjectURL(new Blob([bytesDeBase64(r.data.base64)], { type: "application/pdf" }));
    if (modo === "ver") {
      if (ventana) ventana.location.href = url;
      else window.location.assign(url);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = r.data.nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const llenados = doc.camposPropios.filter((c) => doc.valores[c.clave]);

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5" data-testid={`documento-${doc.codigo}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="break-words">{doc.nombre}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Versión {doc.version}
            {doc.proceso === "contratacion" ? " · de contratación" : ""}
            {doc.trabajadorCedula ? ` · trabajador C.I. ${doc.trabajadorCedula}` : ""}
          </p>
        </div>
        <Badge variant={firmado || doc.estado === "generado" ? "default" : "outline"} className={sinFirmar ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : undefined} data-testid="estado-documento">
          {firmado ? <CheckCircle2 aria-hidden /> : null}
          {etiquetaDe(doc)}
        </Badge>
      </div>

      {doc.faltan.length > 0 && (
        <p className="text-sm text-amber-900 dark:text-amber-200">Faltan datos del postulante: {doc.faltan.join(", ")}.</p>
      )}
      {doc.firmaInvalidada && <p className="text-sm text-amber-900 dark:text-amber-200">La firma anterior quedó sin efecto porque el postulante cambió datos del documento.</p>}

      {llenados.length > 0 && (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {llenados.map((c) => (
            <div key={c.clave} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{c.etiqueta}</dt>
              <dd className="text-sm font-medium break-words whitespace-pre-line">{doc.valores[c.clave]}</dd>
            </div>
          ))}
        </dl>
      )}

      {doc.firma && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="evidencia-firma">
          <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="size-4" aria-hidden /> Evidencia de la firma por clic
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Firmado el</dt>
              <dd className="font-medium">{formatearFechaHora(doc.firma.firmadoEn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">IP de origen</dt>
              <dd className="font-mono">{doc.firma.ipEnmascarada || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Huella (sha256)</dt>
              <dd className="font-mono text-xs break-all" title={doc.firma.sha256}>
                {huellaCorta(doc.firma.sha256)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-pretty text-muted-foreground">«{doc.firma.textoConformidad}»</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={() => void abrir("ver")} disabled={ocupado !== null} aria-label={`Ver el PDF de ${doc.nombre}`}>
          {ocupado === "ver" ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          {sinFirmar ? "Ver vista actual (sin firmar)" : "Ver PDF"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void abrir("descargar")} disabled={ocupado !== null} aria-label={`Descargar el PDF de ${doc.nombre}`}>
          {ocupado === "descargar" ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Descargar
        </Button>
      </div>
    </li>
  );
}

/** Pestaña «Documentos» del detalle: estado de cada plantilla, lo llenado, la evidencia de firma y el PDF (con bitácora). */
export function SeccionDocumentosExpediente({ expedienteId }: { expedienteId: string }) {
  const { data, error, isLoading, mutate } = useSWR(["captacion-documentos", expedienteId], () => cargar(expedienteId), { revalidateOnFocus: false });

  if (isLoading) return <VistaCargando mensaje="Cargando los documentos…" />;
  if (error || !data) return <VistaError mensaje={error instanceof Error ? error.message : "No fue posible cargar los documentos."} onReintentar={() => void mutate()} />;
  if (data.length === 0) {
    return <VistaVacia titulo="Sin documentos" descripcion="No hay plantillas de documentos activas para los datos complementarios de este expediente." />;
  }
  const firmados = data.filter((d) => d.estado === "firmado").length;
  return (
    <section className="flex flex-col gap-4" aria-label="Documentos del expediente">
      <p className="text-sm text-muted-foreground" data-testid="resumen-documentos">
        {data.length} {data.length === 1 ? "documento" : "documentos"} · {firmados} {firmados === 1 ? "firmado" : "firmados"}. La descarga de cada PDF queda registrada en la bitácora.
      </p>
      <ul className="flex flex-col gap-4">
        {data.map((d) => (
          <FilaDocumento key={d.codigo} doc={d} expedienteId={expedienteId} />
        ))}
      </ul>
    </section>
  );
}
