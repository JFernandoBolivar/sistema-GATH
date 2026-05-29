"use client";
import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Palette,
  CheckCircle2,
  XCircle,
  Star,
  ImagePlus,
} from "lucide-react";
import { useState, useRef, useTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";
import { getPlantillas } from "../api/getInfoCarnet";
import { subirPlantilla as subirPlantillaAction, activarPlantilla as activarPlantillaAction } from "./actions/plantillaActions";
import { schemaPlantilla } from "../schemas/schemaPlantilla";
import PlantillaUploadForm from "../components/forms/plantilla-upload-form";
import type { Plantilla } from "../types/carnetizacion";

const DJANGO_URL =
  process.env.NEXT_PUBLIC_DJANGO_API_URL?.replace("/api/", "") ||
  "http://localhost:8000";

export default function PlantillasPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPendingUpload, startTransitionUpload] = useTransition();

  const { data: plantillas, isLoading, mutate } = useSWR(
    "plantillas-carnet",
    getPlantillas,
  );

  const form = useForm({
    resolver: zodResolver(schemaPlantilla),
    defaultValues: { nombre: "", imagen: undefined },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    form.setValue("imagen", file);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = useCallback((values: { nombre: string; imagen: File }) => {
    startTransitionUpload(async () => {
      const result = await subirPlantillaAction(values.nombre, values.imagen);
      if (result.success) {
        toast.success("Plantilla subida exitosamente");
        form.reset({ nombre: "", imagen: undefined });
        setPreview(null);
        setFileName("");
        setFileInputKey((k) => k + 1);
        mutate();
      } else {
        toast.error(result.message);
      }
    });
  }, [mutate, form]);

  const activarPlantilla = (id: number) => {
    startTransitionUpload(async () => {
      const result = await activarPlantillaAction(id);
      if (result.success) {
        toast.success("Plantilla activada");
        mutate();
      } else {
        toast.error(result.message);
      }
    });
  };

  if (isLoading) {
    return (
      <PageLayout title="Plantillas">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Plantillas de Carnet"
      description="Administra las plantillas de fondo para los carnets"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImagePlus className="h-5 w-5" />
              Subir Nueva Plantilla
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlantillaUploadForm
              form={form}
              isPending={isPendingUpload}
              fileInputKey={fileInputKey}
              fileInputRef={fileInputRef}
              preview={preview}
              fileName={fileName}
              onFileChange={handleFileChange}
              onSubmit={onSubmit}
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {!plantillas || plantillas.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="text-center py-12">
                <Palette className="h-14 w-14 mx-auto text-gray-300" />
                <p className="text-lg font-medium text-gray-500 mt-4">
                  Sin plantillas
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sube la primera plantilla usando el formulario
                </p>
              </CardContent>
            </Card>
          ) : (
            plantillas.map((p: Plantilla) => (
              <Card
                key={p.id}
                className={`shadow-sm transition-all ${
                  p.activo ? "ring-2 ring-blue-400" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 rounded-md overflow-hidden border bg-gray-50 flex-shrink-0">
                      {p.imagen_url ? (
                        <img
                          src={`${DJANGO_URL}${p.imagen_url}`}
                          alt={p.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Palette className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{p.nombre}</h3>
                        {p.activo ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 flex-shrink-0">
                            <Star className="h-3 w-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex-shrink-0">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Subida el {new Date(p.creado).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {!p.activo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activarPlantilla(p.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Activar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}
