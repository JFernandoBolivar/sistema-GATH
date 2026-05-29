"use client";

import { useState, useRef, useTransition, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";
import { Camera, Download, IdCard, Loader2, Lock, Printer, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import PageLayout from "@/components/layout/page-layout";
import { searchEmployees, getMotivos } from "../api/getInfoCarnet";
import {
  actualizarVistaPrevia,
  subirFoto,
  generarCarnet,
} from "./actions/generarActions";
import { schemaGenerar } from "../schemas/schemaGenerar";
import type { EmployeeCarnet, MotivoOption } from "../types/carnetizacion";
import type { z } from "zod";

function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto;
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

type GenerarValues = z.infer<typeof schemaGenerar>;

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

function GenerarCarnetContent() {
  const searchParams = useSearchParams();
  const cedula = searchParams.get("cedula") || "";
  const router = useRouter();
  const [vistaPrevia, setVistaPrevia] = useState("");
  const [extraSolicitudes, setExtraSolicitudes] = useState(0);
  const [isPendingGenerar, startTransitionGenerar] = useTransition();
  const [isPendingFoto, startTransitionFoto] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<GenerarValues>({
    resolver: zodResolver(schemaGenerar),
    defaultValues: { nombre: "", motivo_id: 0 },
  });

  const { data: employees, isLoading: isLoadingEmployee } = useSWR(
    cedula ? ["employee-search", cedula] : null,
    () => searchEmployees(cedula),
  );

  const { data: motivos } = useSWR("motivos-carnet", getMotivos);

  const employee: EmployeeCarnet | undefined = employees?.find(
    (e) => e.cedula === cedula,
  );
  const totalSolicitudes = (employee?.total_solicitudes ?? 0) + extraSolicitudes;
  const watchedNombre = form.watch("nombre");

  useEffect(() => {
    if (!employee || !motivos?.length) return;
    form.reset({
      nombre: truncarNombre(employee.nombre_completo),
      motivo_id: motivos[0].id,
    });
    actualizarVistaPrevia(cedula, truncarNombre(employee.nombre_completo)).then((result) => {
      if (result.success && result.vista_previa) {
        setVistaPrevia(result.vista_previa);
      }
    });
  }, [employee, motivos, cedula, form]);

  useEffect(() => {
    if (!cedula || !watchedNombre) return;
    const timer = setTimeout(async () => {
      const result = await actualizarVistaPrevia(cedula, watchedNombre);
      if (result.success && result.vista_previa) {
        setVistaPrevia(result.vista_previa);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cedula, watchedNombre]);

  const handleFotoUpload = (file: File) => {
    startTransitionFoto(async () => {
      const nombre = form.getValues("nombre");
      const result = await subirFoto(cedula, nombre, file);
      if (result.success && result.vista_previa) {
        setVistaPrevia(result.vista_previa);
        toast.success("Foto actualizada correctamente");
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleGenerarCarnet = () => {
    startTransitionGenerar(async () => {
      const motivo_id = form.getValues("motivo_id");
      const nombre = form.getValues("nombre");
      const result = await generarCarnet(cedula, motivo_id, nombre);
      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }
      downloadPdfBase64(result.data, `carnet_${cedula}.pdf`);
      toast.success("Carnet generado y descargado exitosamente");
      setExtraSolicitudes((prev) => prev + 1);
    });
  };

  if (!cedula) {
    return (
      <PageLayout title="Generar Carnet" description="Seleccione un trabajador desde la búsqueda">
        <Card className="max-w-md mx-auto mt-10">
          <CardContent className="text-center py-12">
            <IdCard className="h-16 w-16 mx-auto text-gray-300" />
            <p className="text-muted-foreground mt-4">No se ha seleccionado un trabajador.</p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/carnetizacion/buscar")}>
              Ir a Búsqueda
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (isLoadingEmployee) {
    return (
      <PageLayout title="Generar Carnet">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <span className="ml-3 text-lg">Cargando datos del empleado...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Generar Carnet"
      description={`Procesando carnet para: ${employee ? truncarNombre(employee.nombre_completo) : cedula}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5" />
              Datos del Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Cédula (no modificable)
                </label>
                <Input value={cedula} disabled className="mt-1 bg-gray-100" />
              </div>

              <InputForm<GenerarValues>
                form={form}
                nameInput="nombre"
                label="Nombre completo"
                placeholder="Nombre del trabajador"
                type="text"
              />

              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Código
                </label>
                <Input value={employee?.codigo || ""} disabled className="mt-1 bg-gray-100" />
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Cargo
                </label>
                <Input value={employee?.cargo || ""} disabled className="mt-1 bg-gray-100" />
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Dirección General / Oficina
                </label>
                <Input value={employee?.departamento || ""} disabled className="mt-1 bg-gray-100" />
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  <Printer className="h-3 w-3 mr-1" />
                  {totalSolicitudes} carnets emitidos
                </Badge>
              </div>

              <hr />

              <SelectForm<GenerarValues, MotivoOption>
                form={form}
                nameSalect="motivo_id"
                Formlabel="Motivo"
                SelectLabelItem="Seleccione un motivo"
                placeholder="Seleccione..."
                options={motivos || []}
                isLoading={!motivos}
                valueKey="id"
                labelKey="nombre"
              />

              <div>
                <label className="text-sm font-medium">Foto</label>
                <div className="flex gap-2 mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFotoUpload(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPendingFoto}
                  >
                    {isPendingFoto ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    Subir Foto
                  </Button>
                </div>
              </div>

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleGenerarCarnet}
                disabled={isPendingGenerar}
              >
                {isPendingGenerar ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Download className="h-5 w-5 mr-2" />
                )}
                {isPendingGenerar ? "Generando..." : "Generar Carnet"}
              </Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista Previa del Carnet</CardTitle>
          </CardHeader>
          <CardContent>
            {vistaPrevia ? (
              <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: vistaPrevia }} />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Camera className="h-20 w-20" />
                <p className="mt-4">La vista previa se cargará aquí</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center mt-4">
              Solo el nombre es editable. Cédula, código, cargo y dirección general se cargan automáticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

export default function GenerarCarnetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      }
    >
      <GenerarCarnetContent />
    </Suspense>
  );
}