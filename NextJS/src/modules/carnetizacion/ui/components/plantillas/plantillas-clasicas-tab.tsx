"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ImageOff,
  ImagePlus,
  Loader2,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaginaCarnet, PlantillaCarnet } from "../../../domain/entities/carnet";
import type { PlantillaFormType } from "../../schema/schema-carnet";
import { PaginadorServidor } from "../paginador-servidor";
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
  paginaFondos: PaginaCarnet<PlantillaCarnet>;
  busqueda: string;
  onCambiarBusqueda: (valor: string) => void;
  onCambiarPagina: (pagina: number) => void;
  onCambiarTamano: (tamano: number) => void;
  onActivarPlantillaClasica: (id: number) => void;
  onEliminarFondo: (fondo: PlantillaCarnet) => void;
}

function fechaLarga(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "fecha no disponible";
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Miniatura real del fondo. Sin URL: «Sin imagen» con botón para subirla; si el archivo no se puede
 * leer: «Archivo no disponible» (mismo criterio que la Biblioteca de Medios).
 */
function MiniaturaFondo({
  src,
  nombre,
  onSubirImagen,
}: {
  src: string;
  nombre: string;
  onSubirImagen: () => void;
}) {
  const [falla, setFalla] = useState(false);

  if (!src) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
        <ImagePlus className="size-8" aria-hidden="true" />
        <span className="text-sm font-medium">Sin imagen</span>
        <Button type="button" variant="outline" size="sm" onClick={onSubirImagen}>
          <Upload className="size-4" aria-hidden="true" />
          Subir imagen
        </Button>
      </div>
    );
  }
  if (falla) {
    return (
      <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="text-sm">Archivo no disponible</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Fondo ${nombre}`}
      className="max-h-full max-w-full rounded-sm object-contain shadow-xs"
      loading="lazy"
      onError={() => setFalla(true)}
    />
  );
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
  paginaFondos,
  busqueda,
  onCambiarBusqueda,
  onCambiarPagina,
  onCambiarTamano,
  onActivarPlantillaClasica,
  onEliminarFondo,
}: PlantillasClasicasTabProps) {
  const [fondoAEliminar, setFondoAEliminar] = useState<PlantillaCarnet | null>(null);
  const fondos = paginaFondos.resultados;
  const hayBusqueda = busqueda.trim().length > 0;

  const pedirEliminar = (fondo: PlantillaCarnet) => {
    if (fondo.activo) {
      toast.error(
        `No se puede eliminar «${fondo.nombre}» porque está activo y se usa al generar carnets. Active otro fondo primero.`,
      );
      return;
    }
    setFondoAEliminar(fondo);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="border shadow-xs lg:col-span-1 lg:self-start">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ImagePlus className="size-5 text-primary" aria-hidden="true" />
            Subir fondo fijo
          </CardTitle>
          <CardDescription className="text-xs">
            Carga una imagen que se usa como fondo del carnet cuando no hay una plantilla por capas.
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

      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={busqueda}
              onChange={(e) => onCambiarBusqueda(e.target.value)}
              placeholder="Buscar fondo por nombre…"
              className="pl-9"
              aria-label="Buscar fondo fijo"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {paginaFondos.total} fondo{paginaFondos.total === 1 ? "" : "s"}
            {hayBusqueda ? " encontrados" : " registrados"}
          </span>
        </div>

        {cargandoClasicas && fondos.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : fondos.length === 0 ? (
          <Card className="border border-dashed shadow-xs">
            <CardContent className="py-12 text-center">
              <ImageOff className="mx-auto size-12 text-muted-foreground/40" aria-hidden="true" />
              <p className="mt-4 text-base font-semibold text-foreground">
                {hayBusqueda ? "Ningún fondo coincide con la búsqueda" : "Aún no hay fondos fijos"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hayBusqueda
                  ? "Pruebe con otro nombre."
                  : "Sube una imagen con el formulario para crear el primero."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fondos.map((fondo) => (
              <Card
                key={fondo.id}
                className={`flex flex-col overflow-hidden border shadow-xs transition-all ${
                  fondo.activo ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex h-44 items-center justify-center overflow-hidden border-b bg-muted/40 p-3">
                  <MiniaturaFondo
                    src={fondo.imagenUrl}
                    nombre={fondo.nombre}
                    onSubirImagen={() => fileInputRef.current?.click()}
                  />
                </div>
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-semibold" title={fondo.nombre}>
                        {fondo.nombre}
                      </h3>
                      {fondo.activo ? (
                        <Badge className="shrink-0 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">
                          <Star className="mr-1 size-3" aria-hidden="true" />
                          En uso
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fondo fijo (clásico) · Subido el {fechaLarga(fondo.creado)}
                    </p>
                    {fondo.activo && (
                      <p className="text-xs text-muted-foreground">
                        Está en uso al generar carnets: para eliminarlo, active otro fondo.
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={isPending}
                      onClick={() => pedirEliminar(fondo)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Eliminar
                    </Button>
                    {!fondo.activo && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onActivarPlantillaClasica(Number(fondo.id))}
                        disabled={isPending}
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        Activar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <PaginadorServidor
          id="filas-fondos-fijos"
          pagina={paginaFondos.pagina}
          totalPaginas={paginaFondos.totalPaginas}
          tamano={paginaFondos.tamano}
          total={paginaFondos.total}
          cargando={cargandoClasicas}
          onPagina={onCambiarPagina}
          onTamano={onCambiarTamano}
        />
      </div>

      <AlertDialog
        open={!!fondoAEliminar}
        onOpenChange={(abierto) => !abierto && setFondoAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este fondo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{fondoAEliminar?.nombre}» y su imagen. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fondoAEliminar) onEliminarFondo(fondoAEliminar);
                setFondoAEliminar(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
