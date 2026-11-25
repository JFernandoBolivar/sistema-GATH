"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { DocumentoGeneradoResumen, PlantillaBajoDemanda } from "../../domain/entities/plantilla";
import { cuerpoDeValores, type CampoPropioDTO } from "../../domain/lib/documentos-expediente";
import { generarBajoDemandaAction } from "../../infrastructure/actions/documentos-actions";
import { useDescargarDocumento } from "../hooks/use-descargar-documento";
import { estaPublicada } from "../lib/etiquetas";
import { CamposPropiosFormulario } from "./campos-propios-formulario";
import { SelectSimple } from "./select-simple";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  trabajadorCedula: string;
  /** Plantillas bajo demanda que ofrece el backend; aquí se filtran las publicadas y activas. */
  plantillas: readonly PlantillaBajoDemanda[];
  /** Se llama tras generar el documento para refrescar la lista. */
  onGenerado: () => void;
}

function aCamposDto(p: PlantillaBajoDemanda): CampoPropioDTO[] {
  return p.campos_propios.map((c) => ({ ...c, opciones: c.opciones ?? [] }));
}

/** Elige una plantilla bajo demanda, pide sus campos propios, genera el PDF y lo descarga. */
export function GenerarDocumentoDialog({ abierto, onCerrar, trabajadorCedula, plantillas, onGenerado }: Props) {
  const { descargar: descargarDocumento } = useDescargarDocumento();
  const disponibles = useMemo(() => plantillas.filter((p) => estaPublicada(p) && p.activa), [plantillas]);
  const [elegida, setElegida] = useState("");
  const [controles, setControles] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [generado, setGenerado] = useState<DocumentoGeneradoResumen | null>(null);
  const [generando, setGenerando] = useState(false);

  const plantillaId = elegida || (disponibles.length === 1 ? disponibles[0].id : "");
  const plantilla = disponibles.find((p) => p.id === plantillaId);
  const campos = useMemo(() => (plantilla ? aCamposDto(plantilla) : []), [plantilla]);

  const elegir = (id: string) => {
    setElegida(id);
    setControles({});
    setErrores({});
    setErrorGeneral(null);
  };

  const descargar = async (documento: DocumentoGeneradoResumen): Promise<boolean> => {
    setGenerando(true);
    setErrorGeneral(null);
    const correcto = await descargarDocumento(documento.id, documento.plantilla_nombre);
    if (!correcto) {
      setErrorGeneral("El documento se generó, pero no se pudo descargar. Intente descargarlo nuevamente.");
    } else {
      toast.success("Documento generado y descargado.");
    }
    setGenerando(false);
    return correcto;
  };

  const generar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantilla) return;
    const faltan = campos.filter((c) => c.obligatorio && !(controles[c.clave] ?? "").trim());
    if (faltan.length > 0) {
      setErrores(Object.fromEntries(faltan.map((c) => [c.clave, "Este dato es obligatorio."])));
      return;
    }
    setErrores({});
    setErrorGeneral(null);
    setGenerando(true);
    try {
      const r = await generarBajoDemandaAction({
        plantilla_id: plantilla.id,
        trabajador_cedula: trabajadorCedula,
        valores_propios: cuerpoDeValores(campos, controles),
      });
      if (!r.success) {
        setErrorGeneral(r.error);
        if (r.errores) {
          setErrores(Object.fromEntries(Object.entries(r.errores).map(([k, v]) => [k.replace(/^valores_propios\./, ""), v[0] ?? ""])));
        }
        toast.error(r.error);
        return;
      }
      setGenerado(r.data);
      setElegida("");
      setControles({});
      onGenerado();
      if (await descargar(r.data)) {
        setGenerado(null);
        onCerrar();
      }
    } catch {
      setErrorGeneral("No se pudo generar el documento. Intente nuevamente.");
      toast.error("No se pudo generar el documento.");
    } finally {
      setGenerando(false);
    }
  };

  const generarOtro = () => {
    setGenerado(null);
    setErrores({});
    setErrorGeneral(null);
  };

  const reintentarDescarga = async () => {
    if (!generado) return;
    if (await descargar(generado)) {
      setGenerado(null);
      onCerrar();
    }
  };

  const cerrar = () => {
    if (generando) return;
    setGenerado(null);
    setErrorGeneral(null);
    onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle>Generar documento</DialogTitle>
          <DialogDescription>Elija la plantilla; el documento se arma con los datos actuales del trabajador.</DialogDescription>
        </DialogHeader>

        {errorGeneral && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {errorGeneral}
          </p>
        )}

        {generado ? (
          <div className="grid gap-4">
            <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Documento generado</p>
                <p className="break-words text-sm">{generado.plantilla_nombre}</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={generarOtro} disabled={generando} className="h-11 sm:h-9">
                Generar otro
              </Button>
              <Button type="button" onClick={() => void reintentarDescarga()} disabled={generando} className="h-11 sm:h-9">
                {generando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                {generando ? "Descargando…" : "Descargar nuevamente"}
              </Button>
            </DialogFooter>
          </div>
        ) : disponibles.length === 0 ? (
          <p role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="sin-plantillas-bajo-demanda">
            No hay plantillas publicadas y activas para generar bajo demanda. Pida a quien administra las plantillas que
            publique una en el proceso «Bajo demanda».
          </p>
        ) : (
          <form onSubmit={generar} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="generar-plantilla">Plantilla</Label>
              <SelectSimple
                id="generar-plantilla"
                valor={plantillaId}
                onCambio={elegir}
                placeholder="Seleccione una plantilla"
                opciones={disponibles.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              />
              {plantilla?.descripcion && <p className="text-xs text-muted-foreground">{plantilla.descripcion}</p>}
            </div>

            {plantilla && campos.length > 0 && (
              <fieldset className="grid gap-3 rounded-lg border p-3" disabled={generando}>
                <legend className="px-1 text-sm font-medium">Datos que pide este documento</legend>
                <CamposPropiosFormulario
                  idBase="generar"
                  campos={campos}
                  controles={controles}
                  errores={errores}
                  deshabilitado={generando}
                  onCambio={(clave, valor) => setControles((c) => ({ ...c, [clave]: valor }))}
                />
              </fieldset>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={cerrar} disabled={generando} className="h-11 sm:h-9">
                Cancelar
              </Button>
              <Button type="submit" disabled={generando || !plantilla} className="h-11 sm:h-9">
                {generando && <Loader2 className="animate-spin" aria-hidden />} {generando ? "Generando…" : "Generar y descargar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
