"use client";

import { CheckCircle2, ImagePlus, Loader2, Palette, Star, XCircle } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plantilla } from "../../../domain/entities/carnet";
import type { PlantillaFormType } from "../../schema/schema-carnet";
import PlantillaUploadForm from "../plantilla-upload-form";

interface PlantillasClasicasTabProps {
  formClasico: UseFormReturn<PlantillaFormType>;
  isPending: boolean;
  fileInputKey: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  preview: string | null;
  fileName: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitClasico: (values: PlantillaFormType) => void;
  cargandoClasicas: boolean;
  listaClasicas: Plantilla[];
  onActivarPlantillaClasica: (id: number) => void;
}

export function PlantillasClasicasTab({
  formClasico,
  isPending,
  fileInputKey,
  fileInputRef,
  preview,
  fileName,
  onFileChange,
  onSubmitClasico,
  cargandoClasicas,
  listaClasicas,
  onActivarPlantillaClasica,
}: PlantillasClasicasTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="shadow-xs border lg:col-span-1">
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ImagePlus className="size-5 text-primary" />
            Subir Plantilla Institucional
          </CardTitle>
          <CardDescription className="text-xs">
            Carga un archivo gráfico como fondo estático para carnetización rápida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6">
          <PlantillaUploadForm
            form={formClasico}
            isPending={isPending}
            fileInputKey={fileInputKey}
            fileInputRef={fileInputRef}
            preview={preview}
            fileName={fileName}
            onFileChange={onFileChange}
            onSubmit={onSubmitClasico}
          />
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex flex-col gap-3">
        {cargandoClasicas ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : listaClasicas.length === 0 ? (
          <Card className="shadow-xs border">
            <CardContent className="text-center py-12">
              <Palette className="size-14 mx-auto text-muted-foreground/40" />
              <p className="text-lg font-medium text-foreground mt-4">Sin fondos fijos</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sube una imagen usando el formulario lateral.
              </p>
            </CardContent>
          </Card>
        ) : (
          listaClasicas.map((p) => {
            const imagenUrl = p.imagenUrl || p.imagen_url;
            return (
              <Card
                key={p.id}
                className={`shadow-xs border transition-all ${
                  p.activo ? "ring-2 ring-primary" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-16 rounded-md overflow-hidden border bg-muted shrink-0">
                      {imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagenUrl}
                          alt={p.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <Palette className="size-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base truncate">{p.nombre}</h3>
                        {p.activo ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-primary/20 shrink-0">
                            <Star className="size-3 mr-1" />
                            Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">
                            <XCircle className="size-3 mr-1" />
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Subida el{" "}
                        {new Date(p.creado).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {!p.activo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onActivarPlantillaClasica(Number(p.id))}
                          disabled={isPending}
                        >
                          <CheckCircle2 className="size-4 mr-1" />
                          Activar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
