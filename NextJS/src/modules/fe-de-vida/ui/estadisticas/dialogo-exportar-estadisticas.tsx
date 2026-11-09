"use client";

import { useId, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { EstadisticasDTO } from "../../application/dtos/fe-de-vida-dto";
import type { OpcionesReporteEstadisticas } from "../../application/use-cases/gestionar-estadisticas";

export interface DialogoExportarEstadisticasProps {
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: (opciones: OpcionesReporteEstadisticas) => Promise<void>;
  estadisticas: EstadisticasDTO | null;
  filtrosActivos: {
    procesoId?: string;
    tipoNominaId?: string;
    estado?: string;
    canal?: string;
    desde?: string;
    hasta?: string;
  };
}

export function DialogoExportarEstadisticas({
  abierto,
  alCerrar,
  alConfirmar,
  estadisticas,
  filtrosActivos,
}: DialogoExportarEstadisticasProps) {
  const idPrefix = useId();
  const [formato, setFormato] = useState<"pdf" | "excel">("pdf");
  const [incluirResumen, setIncluirResumen] = useState(true);
  const [incluirGraficos, setIncluirGraficos] = useState(true);
  const [incluirListado, setIncluirListado] = useState(true);
  const [alcanceListado, setAlcanceListado] = useState<"faltan" | "respondieron" | "ambos">("faltan");
  const [generando, setGenerando] = useState(false);

  const kpis = estadisticas?.kpis;
  const algunContenidoSeleccionado =
    incluirResumen || (formato === "pdf" && incluirGraficos) || incluirListado;

  // Cálculo de pasivos estimados en la vista previa
  const estimadoListado = (() => {
    if (!kpis) return 0;
    if (alcanceListado === "faltan") return kpis.faltan;
    if (alcanceListado === "respondieron") return kpis.respondieron;
    return kpis.total;
  })();

  const nombreProceso =
    estadisticas?.proceso?.nombre ||
    estadisticas?.procesos?.find((p) => p.id === filtrosActivos.procesoId)?.nombre ||
    "Proceso vigente";

  const tipoPasivoTexto = (() => {
    if (!filtrosActivos.tipoNominaId) return "Todos";
    const encontrado = estadisticas?.tipos?.find(
      (t) => String(t.id) === String(filtrosActivos.tipoNominaId),
    );
    return encontrado?.nombre || `Tipo #${filtrosActivos.tipoNominaId}`;
  })();

  async function handleGenerar() {
    if (!algunContenidoSeleccionado) return;
    setGenerando(true);
    try {
      await alConfirmar({
        formato,
        incluirResumen,
        incluirGraficos: formato === "pdf" ? incluirGraficos : false,
        incluirListado,
        alcanceListado,
      });
      alCerrar();
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !generando && !abrir && alCerrar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Download className="size-5 text-primary" aria-hidden />
            Generar reporte de estadísticas
          </DialogTitle>
          <DialogDescription>
            Configure las secciones y el formato que desea incluir en el informe de fe de vida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* 1. Selección de formato */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold">Formato del reporte</legend>
            <RadioGroup
              value={formato}
              onValueChange={(v) => setFormato(v as "pdf" | "excel")}
              className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <Label
                htmlFor={`${idPrefix}-formato-pdf`}
                className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  formato === "pdf"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="pdf" id={`${idPrefix}-formato-pdf`} />
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-5 text-primary" aria-hidden />
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words font-semibold leading-tight">Documento PDF</span>
                    <span className="break-words text-xs text-muted-foreground">Colores institucionales CONATEL</span>
                  </div>
                </div>
              </Label>

              <Label
                htmlFor={`${idPrefix}-formato-excel`}
                className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  formato === "excel"
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="excel" id={`${idPrefix}-formato-excel`} />
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <div className="flex min-w-0 flex-col">
                    <span className="break-words font-semibold leading-tight">Libro Excel (.xlsx)</span>
                    <span className="break-words text-xs text-muted-foreground">Tablas con filtros y hojas separadas</span>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </fieldset>

          {/* 2. Secciones a incluir */}
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Contenido a incluir en el reporte</legend>
            <div className="grid gap-2.5 rounded-lg border bg-card p-3.5">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id={`${idPrefix}-inc-resumen`}
                  checked={incluirResumen}
                  onCheckedChange={(c) => setIncluirResumen(Boolean(c))}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor={`${idPrefix}-inc-resumen`} className="cursor-pointer font-medium">
                    Resumen e indicadores
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tarjetas de KPIs, porcentajes y matriz de cruce tipo de pasivo × estado.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id={`${idPrefix}-inc-graficos`}
                  checked={formato === "pdf" && incluirGraficos}
                  disabled={formato === "excel"}
                  onCheckedChange={(c) => setIncluirGraficos(Boolean(c))}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label
                    htmlFor={`${idPrefix}-inc-graficos`}
                    className={`font-medium ${formato === "excel" ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    Gráficos estadísticos (solo PDF)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formato === "excel"
                      ? "Los gráficos vectoriales no se incluyen en hojas de cálculo."
                      : "Barras de cumplimiento por tipo de pasivo y distribución por estado en paleta institucional."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Checkbox
                  id={`${idPrefix}-inc-listado`}
                  checked={incluirListado}
                  onCheckedChange={(c) => setIncluirListado(Boolean(c))}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor={`${idPrefix}-inc-listado`} className="cursor-pointer font-medium">
                    Listado de pasivos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Nómina con cédula, nombre, tipo de pasivo, correo y teléfono de contacto.
                  </p>
                </div>
              </div>
            </div>
          </fieldset>

          {/* 3. Alcance del listado (si está marcado) */}
          {incluirListado && (
            <fieldset className="flex flex-col gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-3.5">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-primary">
                ¿Qué pasivos incluir en el listado?
              </legend>
              <RadioGroup
                value={alcanceListado}
                onValueChange={(v) => setAlcanceListado(v as "faltan" | "respondieron" | "ambos")}
                className="grid gap-2 sm:grid-cols-3"
              >
                <Label
                  htmlFor={`${idPrefix}-alcance-faltan`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors ${
                    alcanceListado === "faltan"
                      ? "border-primary bg-background font-semibold shadow-xs"
                      : "border-border bg-background/50 hover:bg-background"
                  }`}
                >
                  <RadioGroupItem value="faltan" id={`${idPrefix}-alcance-faltan`} />
                  <span>Faltan por responder</span>
                </Label>

                <Label
                  htmlFor={`${idPrefix}-alcance-respondieron`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors ${
                    alcanceListado === "respondieron"
                      ? "border-primary bg-background font-semibold shadow-xs"
                      : "border-border bg-background/50 hover:bg-background"
                  }`}
                >
                  <RadioGroupItem value="respondieron" id={`${idPrefix}-alcance-respondieron`} />
                  <span>Respondieron</span>
                </Label>

                <Label
                  htmlFor={`${idPrefix}-alcance-ambos`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs transition-colors ${
                    alcanceListado === "ambos"
                      ? "border-primary bg-background font-semibold shadow-xs"
                      : "border-border bg-background/50 hover:bg-background"
                  }`}
                >
                  <RadioGroupItem value="ambos" id={`${idPrefix}-alcance-ambos`} />
                  <span>Ambos (universo)</span>
                </Label>
              </RadioGroup>
            </fieldset>
          )}

          {/* 4. Vista previa del resumen de lo que saldrá */}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="font-semibold text-foreground">Vista previa del reporte:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-3">
              <div>
                <span className="font-medium text-foreground">Proceso: </span>
                {nombreProceso}
              </div>
              <div>
                <span className="font-medium text-foreground">Tipo de pasivo: </span>
                {tipoPasivoTexto}
              </div>
              <div>
                <span className="font-medium text-foreground">Formato: </span>
                {formato.toUpperCase()}
              </div>
              {filtrosActivos.estado && (
                <div>
                  <span className="font-medium text-foreground">Estado filtro: </span>
                  {filtrosActivos.estado}
                </div>
              )}
              {filtrosActivos.canal && (
                <div>
                  <span className="font-medium text-foreground">Canal: </span>
                  {filtrosActivos.canal}
                </div>
              )}
              {incluirListado && (
                <div>
                  <span className="font-medium text-foreground">Pasivos en listado: </span>
                  <span className="font-semibold text-primary">{estimadoListado} registro(s)</span>
                </div>
              )}
            </div>
          </div>

          {!algunContenidoSeleccionado && (
            <p className="text-center text-xs font-medium text-destructive">
              Debe seleccionar al menos una sección para poder generar el reporte.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={alCerrar} disabled={generando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleGenerar()}
            disabled={!algunContenidoSeleccionado || generando}
            className="gap-2"
          >
            {generando ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generando reporte...
              </>
            ) : (
              <>
                <Download className="size-4" aria-hidden />
                Generar reporte {formato.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
