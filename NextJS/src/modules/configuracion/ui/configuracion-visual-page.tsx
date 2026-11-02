"use client";

/**
 * Página de administración "Configuración Visual" (HU 0009 — Cintillo
 * Editable): selector Genérico/Fijo + formulario de datos (nombre de
 * empresa, color de fondo) + 3 campos de carga de imagen independientes
 * (logo izquierdo, logo derecho, cintillo de pie), cada uno con su propio
 * preview y subida inmediata. RN-009-01: todo el formulario de datos/
 * imágenes queda deshabilitado mientras el tipo activo sea "Genérico".
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

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
    defaultValues: { tipoCintillo: "FIJO", nombreEmpresa: "", colorFondo: "" },
  });

  useEffect(() => {
    getConfiguracionVisualAction()
      .then((dto) => {
        setConfig(dto);
        form.reset({
          tipoCintillo: dto.tipoCintillo,
          nombreEmpresa: dto.nombreEmpresa ?? "",
          colorFondo: dto.colorFondo ?? "",
        });
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tipoCintillo = form.watch("tipoCintillo");
  const esGenerico = tipoCintillo === "GENERICO";

  const onGuardar = (data: ActualizarConfiguracionVisualFormType) => {
    startTransition(async () => {
      const resultado = await actualizarConfiguracionVisualAction({
        tipoCintillo: data.tipoCintillo,
        nombreEmpresa: esGenerico ? null : (data.nombreEmpresa || null),
        colorFondo: esGenerico ? null : (data.colorFondo || null),
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error(resultado.error);
        return;
      }
      setConfig(resultado);
      toast.success("Configuración visual actualizada correctamente.");
    });
  };

  if (cargando) {
    return (
      <PageLayout title="Configuración Visual" description="Cintillo institucional de los PDFs del sistema">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Configuración Visual" description="Cintillo institucional de los PDFs del sistema">
      <div className="flex flex-col gap-4 mt-2">
        <Card>
          <CardHeader>
            <CardTitle>Tipo de cintillo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-6">
              <Field className="max-w-xs">
                <Label>Tipo de cintillo</Label>
                <Select
                  value={tipoCintillo}
                  onValueChange={(v) => form.setValue("tipoCintillo", v as "GENERICO" | "FIJO", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIJO">Fijo (institucional, editable)</SelectItem>
                    <SelectItem value="GENERICO">Genérico (neutral, solo lectura)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <div className={esGenerico ? "pointer-events-none opacity-50" : ""}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field>
                    <Label htmlFor="nombreEmpresa">Nombre de la empresa</Label>
                    <Input id="nombreEmpresa" {...form.register("nombreEmpresa")} disabled={esGenerico} />
                    {form.formState.errors.nombreEmpresa && (
                      <p role="alert" className="text-sm text-destructive">{form.formState.errors.nombreEmpresa.message}</p>
                    )}
                  </Field>
                  <Field>
                    <Label htmlFor="colorFondo">Color de fondo (hex)</Label>
                    <Input id="colorFondo" placeholder="#1E3A8A" {...form.register("colorFondo")} disabled={esGenerico} />
                    {form.formState.errors.colorFondo && (
                      <p role="alert" className="text-sm text-destructive">{form.formState.errors.colorFondo.message}</p>
                    )}
                  </Field>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                  Guardar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imágenes del cintillo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <CampoLogoUpload
                campo="logo_principal_clave"
                etiqueta="Logo izquierdo (encabezado)"
                urlActual={config?.logoPrincipalUrl ?? null}
                deshabilitado={esGenerico}
                onSubido={(url) => setConfig((c) => (c ? { ...c, logoPrincipalUrl: url } : c))}
              />
              <CampoLogoUpload
                campo="logo_secundario_clave"
                etiqueta="Logo derecho (encabezado)"
                urlActual={config?.logoSecundarioUrl ?? null}
                deshabilitado={esGenerico}
                onSubido={(url) => setConfig((c) => (c ? { ...c, logoSecundarioUrl: url } : c))}
              />
              <CampoLogoUpload
                campo="cintillo_pie_clave"
                etiqueta="Cintillo de pie de página"
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
