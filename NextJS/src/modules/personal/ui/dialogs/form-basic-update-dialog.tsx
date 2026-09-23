"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import Image from "next/image";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import {
  actualizarEmpleadoAction,
  subirFotoEmpleadoAction,
} from "../../infrastructure/actions/personal-actions";

interface FormBasicUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormBasicUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar Información Basica",
}: FormBasicUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      fechaNacimiento: empleado.fechaNacimiento ?? "",
      sexoId: empleado.sexoId,
      correo: empleado.correo ?? "",
      telefonoMovil: empleado.telefonoMovil ?? "",
      telefonoHabitacion: empleado.telefonoHabitacion ?? "",
      carnetPatria: empleado.carnetPatria ?? "",
      estadoCivilId: empleado.estadoCivilId ?? undefined,
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          nombres: data.nombres,
          apellidos: data.apellidos,
          fechaNacimiento: data.fechaNacimiento || undefined,
          sexoId: Number(data.sexoId),
          correo: data.correo || null,
          telefonoMovil: data.telefonoMovil || null,
          telefonoHabitacion: data.telefonoHabitacion || null,
          carnetPatria: data.carnetPatria || null,
          estadoCivilId: data.estadoCivilId ? Number(data.estadoCivilId) : null,
        };

        const result = await actualizarEmpleadoAction(empleado.cedula, payload);
        if (result && typeof result === "object" && "error" in result) {
          setError((result as { error: string }).error);
          return;
        }

        if (selectedFile) {
          const formData = new FormData();
          formData.append("file", selectedFile);
          await subirFotoEmpleadoAction(empleado.cedula, formData);
        }

        setOpen(false);
        onGuardado();
      } catch {
        setError("Error al actualizar la información básica.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl p-0">
        <DialogTitle className="sr-only">Actualizar Información Básica</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none">
          <CardHeader>
            <CardTitle>Actualizar Información Basica</CardTitle>
          </CardHeader>

          <CardContent>
            <CardAction className="text-gray-500 mb-3">Información Basica</CardAction>

            {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="gap-6">
                <div className="border rounded-lg p-4 gap-3">
                  <Label>Foto del Trabajador</Label>
                  {photoPreview ? (
                    <div className="relative w-full h-40 p-2">
                      <Image
                        height={150}
                        width={100}
                        src={photoPreview || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <Button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 size-6 flex items-center justify-center"
                      >
                        <X className="size-4" />
                      </Button>
                      <div className="text-center w-full text-xs text-muted-foreground mt-1">
                        {selectedFile ? formatFileSize(selectedFile.size) : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="w-full h-full text-center flex flex-col justify-center items-center">
                        <Upload className="size-8 text-gray-400" />
                        <Label
                          htmlFor="photoUpload"
                          className="text-center p-1.5 bg-gray-300 text-black rounded-2xl cursor-pointer mt-2"
                        >
                          Haz clic aqui para seleccionar foto
                        </Label>
                        <input
                          id="photoUpload"
                          ref={fileInputRef}
                          type="file"
                          accept=".png,.jpeg,.jpg"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <span className="text-xs text-muted-foreground mt-2">
                          PNG, JPG hasta 5MB
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div>
                    <Label htmlFor="nombres">Nombre *</Label>
                    <Input
                      id="nombres"
                      placeholder="Juan Bernardo"
                      {...register("nombres", { required: true })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input
                      id="apellidos"
                      placeholder="Perez Gutierrez"
                      {...register("apellidos", { required: true })}
                    />
                  </div>
                  <div className="flex flex-col grow shrink basis-40">
                    <Label htmlFor="fechaNacimiento"> Fecha de Nacimiento *</Label>
                    <Input
                      id="fechaNacimiento"
                      type="date"
                      {...register("fechaNacimiento", { required: true })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sexoId" className="cursor-pointer">
                      Sexo *
                    </Label>
                    <Select
                      value={String(watch("sexoId") || "")}
                      onValueChange={(v) => setValue("sexoId", Number(v))}
                    >
                      <SelectTrigger id="sexoId" className="w-full truncate">
                        <SelectValue placeholder="Seleccione un Genero" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.sexos ?? [
                          { id: 1, nombre: "MASCULINO" },
                          { id: 2, nombre: "FEMENINO" },
                        ]).map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="correo">Correo Electronico</Label>
                    <Input
                      id="correo"
                      type="email"
                      placeholder="ejemplo@gmail.com"
                      {...register("correo")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefonoMovil">Teléfono De Móvil</Label>
                    <Input
                      id="telefonoMovil"
                      type="text"
                      placeholder="04160000000"
                      {...register("telefonoMovil")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefonoHabitacion">Teléfono De Habitación</Label>
                    <Input
                      id="telefonoHabitacion"
                      type="text"
                      placeholder="02390000000"
                      {...register("telefonoHabitacion")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="carnetPatria">Código del Carnet de la Patria</Label>
                    <Input
                      id="carnetPatria"
                      type="text"
                      placeholder="000-0000000-00"
                      {...register("carnetPatria")}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="estadoCivilId">Estado Civil </Label>
                    <Select
                      value={watch("estadoCivilId") ? String(watch("estadoCivilId")) : undefined}
                      onValueChange={(v) => setValue("estadoCivilId", Number(v))}
                    >
                      <SelectTrigger id="estadoCivilId" className="w-full truncate">
                        <SelectValue placeholder="Seleccione Un Estado Civil" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.estadosCiviles ?? []).map((ec) => (
                          <SelectItem key={ec.id} value={String(ec.id)}>
                            {ec.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                    Guardar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
