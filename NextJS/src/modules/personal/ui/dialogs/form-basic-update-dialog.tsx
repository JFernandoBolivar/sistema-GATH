"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import Image from "next/image";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Actualizar Información Básica</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="border rounded-lg p-4 flex flex-col items-center gap-3">
            <Label className="self-start">Foto del Trabajador</Label>
            {photoPreview ? (
              <div className="relative w-40 h-40">
                <Image
                  src={photoPreview}
                  alt="Preview"
                  fill
                  className="object-cover rounded-lg"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 size-6 rounded-full p-0"
                  onClick={handleRemovePhoto}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center w-full flex flex-col items-center justify-center">
                <Upload className="size-8 text-gray-400 mb-2" />
                <Label
                  htmlFor="photoUpload"
                  className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded text-xs font-medium"
                >
                  Haz clic aquí para seleccionar foto
                </Label>
                <input
                  id="photoUpload"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG hasta 5MB</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nombres">Nombres *</Label>
              <Input id="nombres" {...register("nombres", { required: true })} />
            </div>
            <div>
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input id="apellidos" {...register("apellidos", { required: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fechaNacimiento">Fecha de Nacimiento *</Label>
              <Input id="fechaNacimiento" type="date" {...register("fechaNacimiento", { required: true })} />
            </div>
            <div>
              <Label htmlFor="sexoId">Sexo *</Label>
              <Select
                value={String(watch("sexoId") || "")}
                onValueChange={(v) => setValue("sexoId", Number(v))}
              >
                <SelectTrigger id="sexoId">
                  <SelectValue placeholder="Seleccione sexo" />
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="correo">Correo Electrónico</Label>
              <Input id="correo" type="email" {...register("correo")} />
            </div>
            <div>
              <Label htmlFor="telefonoMovil">Teléfono Móvil</Label>
              <Input id="telefonoMovil" {...register("telefonoMovil")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="telefonoHabitacion">Teléfono Habitación</Label>
              <Input id="telefonoHabitacion" {...register("telefonoHabitacion")} />
            </div>
            <div>
              <Label htmlFor="carnetPatria">Carnet de la Patria</Label>
              <Input id="carnetPatria" {...register("carnetPatria")} />
            </div>
          </div>

          <div>
            <Label htmlFor="estadoCivilId">Estado Civil</Label>
            <Select
              value={watch("estadoCivilId") ? String(watch("estadoCivilId")) : undefined}
              onValueChange={(v) => setValue("estadoCivilId", Number(v))}
            >
              <SelectTrigger id="estadoCivilId">
                <SelectValue placeholder="Seleccione estado civil" />
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

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
