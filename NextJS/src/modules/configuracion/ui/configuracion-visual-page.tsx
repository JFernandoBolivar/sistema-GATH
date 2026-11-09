"use client";

/**
 * Página de administración "Identidad Visual y Cintillos" (HU 0009, O33):
 * Selector visual interactivo Institucional (Fijo) vs Genérico +
 * Previsualización en tiempo real del documento + 3 slots de carga de imágenes
 * independientes con historial de versiones.
 * Se eliminó el campo en desuso «Nombre de la empresa» (O33).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileCheck2,
  Info,
  Layers,
  LayoutTemplate,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Badge } from "@/components/ui/badge";
import { RUTA_CONFIGURACION } from "@/shared/lib/administracion-sistema";

import type { ConfiguracionVisualDTO } from "../application/dtos/configuracion-visual-dto";
import {
  actualizarConfiguracionVisualAction,
  getConfiguracionVisualAction,
} from "../infrastructure/actions/configuracion-actions";
import {
  actualizarConfiguracionVisualSchema,
  type ActualizarConfiguracionVisualFormType,
} from "./schema/schema-configuracion-visual";
import { CampoLogoUpload } from "./components/campo-logo";

export default function ConfiguracionVisualPage() {
  const [config, setConfig] = useState<ConfiguracionVisualDTO | null>(null);
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActualizarConfiguracionVisualFormType>({
    resolver: zodResolver(actualizarConfiguracionVisualSchema),
    defaultValues: { tipoCintillo: "FIJO", colorFondo: "" },
  });

  useEffect(() => {
    getConfiguracionVisualAction()
      .then((dto) => {
        setConfig(dto);
        form.reset({
          tipoCintillo: dto.tipoCintillo,
          colorFondo: dto.colorFondo ?? "",
        });
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tipoCintillo = form.watch("tipoCintillo") ?? "FIJO";
  const esGenerico = tipoCintillo === "GENERICO";

  const onSeleccionarTipo = (nuevoTipo: "GENERICO" | "FIJO") => {
    form.setValue("tipoCintillo", nuevoTipo, { shouldValidate: true, shouldDirty: true });
  };

  const onGuardar = (data: ActualizarConfiguracionVisualFormType) => {
    startTransition(async () => {
      const resultado = await actualizarConfiguracionVisualAction({
        tipoCintillo: data.tipoCintillo,
        // «Color de fondo» preservado si existía en BD; «Nombre de empresa» eliminado (O33).
        colorFondo: esGenerico ? null : (data.colorFondo || null),
      });

      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error || "No fue posible guardar la configuración.");
        return;
      }
      setConfig(resultado as ConfiguracionVisualDTO);
      toast.success("Configuración de cintillo e identidad visual actualizada correctamente.");
    });
  };

  if (cargando) {
    return (
      <PageLayout title="Identidad Visual y Cintillos" description="Cargando configuración institucional...">
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-8 animate-spin mr-2 text-primary" />
          Cargando configuración visual...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Identidad Visual y Cintillos"
      description="Personalización del cintillo superior, logotipo oficial y pie de página institucional para todos los documentos y reportes PDF del sistema."
    >
      <div className="space-y-6 max-w-5xl">
        {/* Cabecera y Navegación */}
        <div className="flex items-center justify-between">
          <Link
            href={RUTA_CONFIGURACION}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Volver a Configuración
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={esGenerico ? "secondary" : "default"} className="text-xs">
              {esGenerico ? "Modo Genérico Activo" : "Modo Institucional Activo"}
            </Badge>
          </div>
        </div>

        {/* 1. Selector de Modalidad de Cintillo */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="size-4.5 text-primary" aria-hidden /> Modalidad de cintillo para documentos
            </CardTitle>
            <CardDescription>
              Seleccione el formato con el que se encabezarán los reportes, constancias y puntos de cuenta emitidos por GATH.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Opción Fijo / Institucional */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSeleccionarTipo("FIJO")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSeleccionarTipo("FIJO")}
                className={`flex flex-col justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  !esGenerico
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/20 text-muted-foreground"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`size-4 ${!esGenerico ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-semibold text-sm text-foreground">Institucional (Fijo)</span>
                    </div>
                    {!esGenerico && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Incluye los logotipos oficiales de CONATEL y de la República en el encabezado, además de la franja institucional en el pie de página. Permite cargar nuevas imágenes y restaurar versiones anteriores.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                  <Badge variant={!esGenerico ? "default" : "outline"} className="text-[10px]">
                    Recomendado para producción
                  </Badge>
                </div>
              </div>

              {/* Opción Genérico */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSeleccionarTipo("GENERICO")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSeleccionarTipo("GENERICO")}
                className={`flex flex-col justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  esGenerico
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/20 text-muted-foreground"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className={`size-4 ${esGenerico ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-semibold text-sm text-foreground">Genérico (Neutral)</span>
                    </div>
                    {esGenerico && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Diseño formal sobrio sin imágenes fotográficas ni escudos (solo tipografía neutral). Ideal para auditorías internas, economía de impresión o entornos de contingencia (RN-009-01).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Solo lectura
                  </Badge>
                </div>
              </div>
            </div>

            {/* Aviso informativo de estado */}
            {esGenerico && (
              <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="size-4 mt-0.5 text-primary shrink-0" aria-hidden />
                <p>
                  En modalidad <strong>Genérica</strong> las imágenes del cintillo se mantienen protegidas en modo solo lectura. Si desea actualizar los logotipos, seleccione la modalidad <strong>Institucional (Fijo)</strong> y pulse «Guardar modalidad».
                </p>
              </div>
            )}

            {/* Botón de guardado de modalidad */}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                onClick={form.handleSubmit(onGuardar)}
                disabled={isPending || form.watch("tipoCintillo") === config?.tipoCintillo}
                className="gap-2 text-xs"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Guardar modalidad
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. Mockup / Previsualización en Vivo de la Hoja de Documento */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck2 className="size-4.5 text-primary" aria-hidden /> Vista previa del encabezado y pie de página
                </CardTitle>
                <CardDescription>
                  Representación esquemática de la disposición visual de los elementos en una página impresa.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {esGenerico ? "Formato Genérico" : "Formato Institucional"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mx-auto max-w-2xl rounded-lg border border-border/80 bg-background shadow-md overflow-hidden transition-all">
              {/* Encabezado del documento */}
              <div className="p-4 border-b border-border/60 bg-card/60 flex items-center justify-between min-h-[75px]">
                {esGenerico ? (
                  <div className="w-full text-center py-2 space-y-1">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide">Sistema de Gestión</p>
                    <p className="text-[11px] text-muted-foreground">DOCUMENTO OFICIAL</p>
                  </div>
                ) : (
                  <>
                    {/* Logo izquierdo */}
                    <div className="w-24 h-12 flex items-center justify-start">
                      {config?.logoPrincipalUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={config.logoPrincipalUrl}
                          alt="Logo principal"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="h-8 w-20 rounded bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground border">
                          Logo 1
                        </div>
                      )}
                    </div>

                    {/* Centro simbólico */}
                    <div className="text-center px-2">
                      <p className="text-xs font-bold text-foreground">Comisión Nacional de Telecomunicaciones</p>
                      <p className="text-[10px] text-muted-foreground">Gestión del Talento Humano</p>
                    </div>

                    {/* Logo derecho */}
                    <div className="w-24 h-12 flex items-center justify-end">
                      {config?.logoSecundarioUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={config.logoSecundarioUrl}
                          alt="Logo secundario"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="h-8 w-20 rounded bg-muted/80 flex items-center justify-center text-[10px] text-muted-foreground border">
                          Logo 2
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Cuerpo esquemático del documento */}
              <div className="p-8 space-y-3 bg-card/20">
                <div className="h-3 w-1/3 bg-muted/60 rounded" />
                <div className="space-y-1.5 pt-2">
                  <div className="h-2 w-full bg-muted/40 rounded" />
                  <div className="h-2 w-5/6 bg-muted/40 rounded" />
                  <div className="h-2 w-4/6 bg-muted/40 rounded" />
                </div>
              </div>

              {/* Pie de página con cintillo */}
              <div className="relative border-t border-border/60 bg-card/60 flex flex-col justify-end min-h-[50px] overflow-hidden">
                {!esGenerico && config?.cintilloPieUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={config.cintilloPieUrl}
                    alt="Cintillo de pie"
                    className="w-full h-8 object-cover opacity-90"
                  />
                ) : !esGenerico ? (
                  <div className="w-full h-4 bg-linear-to-r from-primary/30 via-accent/30 to-primary/30" />
                ) : null}
                <div className="py-1 px-4 flex items-center justify-between text-[10px] text-muted-foreground bg-background/80">
                  <span>Generado por GATH</span>
                  <span>Página 1 de 1</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Zonas de Carga de Imágenes */}
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="size-4.5 text-primary" aria-hidden /> Componentes visuales del cintillo
                </CardTitle>
                <CardDescription>
                  Actualice cada elemento gráfico de manera independiente. Se admite formato PNG con transparencia, WebP o JPEG de hasta 5MB.
                </CardDescription>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" /> Historial de 5 versiones guardadas
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <CampoLogoUpload
                campo="logo_principal_clave"
                etiqueta="Logo principal (izquierdo)"
                descripcion="Escudo nacional o emblema institucional (proporción horizontal)."
                urlActual={config?.logoPrincipalUrl ?? null}
                deshabilitado={esGenerico}
                onSubido={(url) => setConfig((c) => (c ? { ...c, logoPrincipalUrl: url } : c))}
              />
              <CampoLogoUpload
                campo="logo_secundario_clave"
                etiqueta="Logo secundario (derecho)"
                descripcion="Logo conmemorativo, bicentenario o de organismo rector."
                urlActual={config?.logoSecundarioUrl ?? null}
                deshabilitado={esGenerico}
                onSubido={(url) => setConfig((c) => (c ? { ...c, logoSecundarioUrl: url } : c))}
              />
              <CampoLogoUpload
                campo="cintillo_pie_clave"
                etiqueta="Cintillo de pie de página"
                descripcion="Franja gráfica inferior que abarca el ancho completo del folio."
                urlActual={config?.cintilloPieUrl ?? null}
                deshabilitado={esGenerico}
                onSubido={(url) => setConfig((c) => (c ? { ...c, cintilloPieUrl: url } : c))}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
