"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Download,
  IdCard,
  Loader2,
  Lock,
  Printer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import PageLayout from "@/components/layout/page-layout";
import { SelectForm } from "@/components/select-form";
import { CapturaFoto } from "@/shared/components/captura-foto/captura-foto";

import {
  actualizarVistaPreviaAction,
  buscarPersonalCarnetAction,
  generarCarnetPdfAction,
  getMotivosCarnetAction,
  subirFotoCarnetAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import { schemaGenerar, type GenerarFormType } from "../schema/schema-carnet";
import type { EmployeeCarnet, MotivoOption } from "../../domain/entities/carnet";

function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto;
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

function downloadPdfBase64(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function EmitirCarnetView() {
  const searchParams = useSearchParams();
  const cedula = searchParams.get("cedula") || "";
  const router = useRouter();
  const [vistaPrevia, setVistaPrevia] = useState("");
  const [extraSolicitudes, setExtraSolicitudes] = useState(0);
  const [isPendingGenerar, startTransitionGenerar] = useTransition();
  const [isPendingFoto, startTransitionFoto] = useTransition();

  const form = useForm<GenerarFormType>({
    resolver: zodResolver(schemaGenerar),
    defaultValues: { nombre: "", motivo_id: 0 },
  });

  const { data: employees, isLoading: isLoadingEmployee } = useSWR(
    cedula ? ["employee-search-carnet", cedula] : null,
    () => buscarPersonalCarnetAction(cedula),
  );

  const { data: motivos } = useSWR("motivos-carnet", getMotivosCarnetAction);

  const employee: EmployeeCarnet | undefined = (employees as EmployeeCarnet[] | undefined)?.find(
    (e) => e.cedula === cedula,
  );
  const totalSolicitudes = (employee?.total_solicitudes ?? 0) + extraSolicitudes;

  useEffect(() => {
    if (!employee || !motivos?.length) return;
    const nombreFijo = truncarNombre(employee.nombre_completo);
    form.reset({
      nombre: nombreFijo,
      motivo_id: motivos[0].id,
    });
    actualizarVistaPreviaAction(cedula, nombreFijo).then((result) => {
      if (result.success && result.vista_previa) {
        setVistaPrevia(result.vista_previa);
      }
    });
  }, [employee, motivos, cedula, form]);

  const handleFotoUpload = (file: File | null) => {
    if (!file) return;
    startTransitionFoto(async () => {
      const nombre = employee ? truncarNombre(employee.nombre_completo) : form.getValues("nombre");
      const result = await subirFotoCarnetAction(cedula, nombre, file);
      if (result.success && result.vista_previa) {
        setVistaPrevia(result.vista_previa);
        toast.success("Foto actualizada correctamente");
      } else {
        toast.error(result.message || "Error al subir la foto");
      }
    });
  };

  const handleGenerarCarnet = () => {
    startTransitionGenerar(async () => {
      const motivo_id = form.getValues("motivo_id");
      const nombre = employee ? truncarNombre(employee.nombre_completo) : form.getValues("nombre");
      const result = await generarCarnetPdfAction(cedula, motivo_id, nombre);
      if (!result.success || !result.data) {
        toast.error(result.message || "Error al emitir el carnet");
        return;
      }
      downloadPdfBase64(result.data, `carnet_${cedula}.pdf`);
      toast.success("Carnet generado y descargado exitosamente");
      setExtraSolicitudes((prev) => prev + 1);
    });
  };

  if (!cedula) {
    return (
      <PageLayout title="Emitir Carnet" description="Seleccione un trabajador desde la búsqueda">
        <Card className="max-w-md mx-auto mt-10 shadow-sm border">
          <CardContent className="text-center py-12">
            <IdCard className="size-16 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground mt-4">No se ha seleccionado un trabajador.</p>
            <Button className="mt-4" onClick={() => router.push("/carnetizacion/buscar")}>
              Ir a Búsqueda
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (isLoadingEmployee) {
    return (
      <PageLayout title="Emitir Carnet">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-10 animate-spin text-primary" />
          <span className="ml-3 text-lg text-muted-foreground">Cargando datos del trabajador…</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Emitir Carnet"
      description={`Procesando carnet para: ${employee ? truncarNombre(employee.nombre_completo) : cedula}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <Card className="shadow-sm border">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <IdCard className="size-5 text-primary" />
              Datos del Carnet
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Form {...form}>
              <div>
                <label htmlFor="input-cedula" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" /> Cédula de identidad (no modificable)
                </label>
                <Input id="input-cedula" value={cedula} disabled className="mt-1 bg-muted font-mono" />
              </div>

              <div>
                <label htmlFor="input-nombre" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" /> Nombre impreso (no modificable)
                </label>
                <Input
                  id="input-nombre"
                  value={employee ? truncarNombre(employee.nombre_completo) : ""}
                  disabled
                  className="mt-1 bg-muted font-medium"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Estos datos no se editan aquí. Si algo está mal, el trabajador lo solicita por Autogestión.
                </p>
              </div>

              {employee?.codigo && (
                <div>
                  <label htmlFor="input-codigo" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="size-3.5" /> Código de cargo
                  </label>
                  <Input id="input-codigo" value={employee.codigo} disabled className="mt-1 bg-muted font-mono" />
                </div>
              )}

              <div>
                <label htmlFor="input-cargo" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" /> Cargo institucional
                </label>
                <Input id="input-cargo" value={employee?.cargo || "—"} disabled className="mt-1 bg-muted" />
              </div>

              <div>
                <label htmlFor="input-dgo" className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" /> Dependencia / Oficina
                </label>
                <Input id="input-dgo" value={employee?.departamento || "—"} disabled className="mt-1 bg-muted" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Badge variant="secondary" className="gap-1.5">
                  <Printer className="size-3" />
                  {totalSolicitudes} {totalSolicitudes === 1 ? "carnet emitido" : "carnets emitidos"}
                </Badge>
              </div>

              <hr className="my-2 border-border" />

              <SelectForm<GenerarFormType, MotivoOption>
                form={form}
                nameSalect="motivo_id"
                Formlabel="Motivo de emisión"
                SelectLabelItem="Seleccione un motivo"
                placeholder="Seleccione motivo…"
                options={motivos || []}
                isLoading={!motivos}
                valueKey="id"
                labelKey="nombre"
              />

              <div className="flex flex-col gap-2 pt-2">
                <CapturaFoto
                  etiqueta="Fotografía para la credencial"
                  nombreArchivo="foto-carnet.jpg"
                  disabled={isPendingFoto}
                  onChange={handleFotoUpload}
                />
              </div>

              <Button
                type="button"
                onClick={handleGenerarCarnet}
                disabled={isPendingGenerar || !form.watch("motivo_id")}
                className="w-full mt-4 gap-2 font-semibold"
              >
                {isPendingGenerar ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generando credencial…
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Emitir y descargar PDF
                  </>
                )}
              </Button>
            </Form>
          </CardContent>
        </Card>

        {/* Vista previa */}
        <Card className="shadow-sm border flex flex-col">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="text-base font-semibold">Vista Previa</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-6">
            {vistaPrevia ? (
              <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vistaPrevia}
                  alt="Vista previa del carnet institucional"
                  className="w-full h-auto object-contain"
                />
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <IdCard className="size-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Vista previa con la plantilla activa</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
