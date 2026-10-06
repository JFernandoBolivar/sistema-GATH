"use client";

/**
 * Paso 1 del wizard de registro: Información Básica (paridad con
 * `shared/forms/employees/register/form-basic-info.tsx` del legado).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/shared/ui/components/button";
import { Calendar } from "@/shared/ui/components/calendar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { getEmpleadosAction } from "../../infrastructure/actions/personal-actions";
import { pasoBasicInfoSchema, type PasoBasicInfoType } from "../schema/schema-registro-pasos";

function formatearPeso(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PasoBasicInfo({
  defaultValues,
  onSubmit,
  catalogos,
  isLoadingCatalogos,
}: {
  defaultValues: Partial<PasoBasicInfoType>;
  onSubmit: (values: PasoBasicInfoType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
}) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    defaultValues.file ? URL.createObjectURL(defaultValues.file) : null,
  );
  const [file, setFile] = useState<File | null>(defaultValues.file ?? null);

  const form = useForm<PasoBasicInfoType>({
    resolver: zodResolver(pasoBasicInfoSchema),
    defaultValues: defaultValues as PasoBasicInfoType,
  });

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setFile(null);
    form.setValue("file", null);
  };

  const cedula = useWatch({ control: form.control, name: "cedulaidentidad" }) ?? "";
  const cedulaLimpia = cedula.trim();
  const { data: coincidencias } = useSWR(
    cedulaLimpia.length >= 6 ? ["empleado-registrado", cedulaLimpia] : null,
    () => getEmpleadosAction({ cedulaidentidad: cedulaLimpia }),
  );
  const validateCedula = useMemo(
    () => (coincidencias ?? []).some((e) => e.cedula === cedulaLimpia),
    [coincidencias, cedulaLimpia],
  );

  const lastCedulaToast = useRef("");
  useEffect(() => {
    if (validateCedula && cedulaLimpia && cedulaLimpia !== lastCedulaToast.current) {
      lastCedulaToast.current = cedulaLimpia;
      toast.error("Ya existe un trabajador con esa cédula de identidad");
    }
  }, [validateCedula, cedulaLimpia]);

  const onSubmitPaso = (data: PasoBasicInfoType) => {
    if (!validateCedula) onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Nuevo Trabajador</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-500">Paso 1: Información Basica</CardAction>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitPaso)} autoComplete="off">
            <div className="gap-4">
              <div className="border rounded-lg p-4 gap-3">
                <Label>Foto del Trabajador</Label>
                {photoPreview ? (
                  <div className="relative w-full h-40 p-2">
                    <Image
                      height={150}
                      width={100}
                      unoptimized
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <Button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="size-4" />
                    </Button>
                    <div className="text-center w-full">{formatearPeso(file?.size ?? 0)}</div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field: { value: _value, onChange, ...fieldProps } }) => (
                        <FormItem className="w-full h-full text-center flex flex-col justify-center items-center">
                          <Upload className="size-8 text-gray-400" />
                          <FormLabel className="text-center p-1.5 bg-gray-300 text-black rounded-2xl  cursor-pointer">
                            Haz clic aqui para seleccionar foto
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...fieldProps}
                              type="file"
                              accept=".png,.jpeg,.jpg"
                              className="hidden"
                              onChange={(event) => {
                                const elegido = event.target.files?.[0] ?? null;
                                onChange(elegido);
                                if (elegido) {
                                  setFile(elegido);
                                  setPhotoPreview(URL.createObjectURL(elegido));
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>PNG, JPG hasta 5MB</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2 col-span-2">
                  <FormField
                    control={form.control}
                    name="nacionalidad_id"
                    render={({ field }) => (
                      <FormItem className="w-48">
                        <FormLabel>Nacionalidad *</FormLabel>
                        <Select
                          value={field.value ? `${field.value}` : ""}
                          onValueChange={(v) => field.onChange(Number.parseInt(v))}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue placeholder={isLoadingCatalogos ? "Cargando..." : "V / E"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(catalogos?.nacionalidades ?? []).map((n) => (
                              <SelectItem key={n.id} value={`${n.id}`}>
                                {n.codigo ? `${n.codigo} - ${n.nombre}` : n.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex-1">
                    <InputForm form={form} label="Cedula de Identidad *" nameInput="cedulaidentidad" placeholder="00000000" type="number" />
                  </div>
                  <div className="flex-1">
                    <InputForm form={form} label="Código del Carnet de la Patria" nameInput="carnet_patria" placeholder="0000000000" type="text" />
                  </div>
                </div>
                <div className="flex gap-2 col-span-2">
                  <div className="flex-1">
                    <InputForm form={form} label="Nombre *" nameInput="nombres" placeholder="Juan Bernardo" type="text" />
                  </div>
                  <div className="flex-1">
                    <InputForm form={form} label="Apellidos *" nameInput="apellidos" placeholder="Perez Gutierrez" type="text" />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="fecha_nacimiento"
                  render={({ field }) => (
                    <FormItem className="flex flex-col  grow shrink basis-40 ">
                      <FormLabel> Fecha de Nacimiento *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button type="button" variant={"outline"} className="font-light">
                              {field.value ? (
                                formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto size-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            selected={field.value ? new Date(field.value) : undefined}
                            mode="single"
                            onSelect={(date) => field.onChange(date)}
                            disabled={(date: Date) => date > new Date() || date < new Date("1900-01-01")}
                            captionLayout="dropdown"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SelectForm
                  Formlabel="Sexo *"
                  SelectLabelItem="Seleccione Un Genero"
                  form={form}
                  isLoading={isLoadingCatalogos}
                  placeholder="Seleccione un Genero"
                  nameSalect="sexoid"
                  labelKey={"nombre"}
                  valueKey={"id"}
                  options={catalogos?.sexos ?? []}
                />
                <InputForm className="w-full" form={form} label="Correo Electronico" nameInput="correo" placeholder="ejemplo@gmail.com" type="email" />
                <InputForm form={form} label="Teléfono De Móvil" nameInput="telefono_movil" placeholder="04160000000" type="number" />
                <InputForm form={form} label="Teléfono De Habitación" nameInput="telefono_habitacion" placeholder="02390000000" type="number" />
                <FormField
                  control={form.control}
                  name="estadoCivil"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Estado Civil </FormLabel>
                      <Select
                        value={field.value ? `${field.value}` : undefined}
                        onValueChange={(v) => field.onChange(Number.parseInt(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate ">
                            <SelectValue
                              placeholder={`${isLoadingCatalogos ? "Cargando Estado Civil" : "Seleccione Un Estado Civil"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(catalogos?.estadosCiviles ?? []).map((status) => (
                            <SelectItem key={status.id} value={`${status.id}`}>
                              {status.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button className="w-full" disabled={validateCedula} variant={validateCedula ? "destructive" : "default"}>
                {validateCedula ? "Trabajador ya se encuentra registrado" : "Siguiente"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
