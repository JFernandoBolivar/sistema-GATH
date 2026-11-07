"use client";

/**
 * Paso 1 del wizard de registro: Información Básica (paridad con
 * `shared/forms/employees/register/form-basic-info.tsx` del legado).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CapturaFoto } from "@/shared/components/captura-foto/captura-foto";
import {
  ETIQUETA_CODIGO_CARNET_PATRIA,
  ETIQUETA_SERIAL_CARNET_PATRIA,
} from "@/shared/domain/etiquetas-carnet-patria";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon } from "lucide-react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { getEmpleadosAction } from "../../infrastructure/actions/personal-actions";
import { pasoBasicInfoSchema, type PasoBasicInfoType } from "../schema/schema-registro-pasos";
import { ContactosEmergenciaCampos } from "../contactos-emergencia-campos";
import { CEDULA_MAX, CORREO_MAX, NOMBRE_MAX } from "../schema/reglas-personas";
import { useErroresDelPaso, type ErroresServidor } from "./errores-registro";

export function PasoBasicInfo({
  defaultValues,
  onSubmit,
  catalogos,
  isLoadingCatalogos,
  titulo = "Registrar Nuevo Trabajador",
  erroresServidor,
  correoObligatorio = "institucional",
}: {
  defaultValues: Partial<PasoBasicInfoType>;
  onSubmit: (values: PasoBasicInfoType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
  titulo?: string;
  erroresServidor?: ErroresServidor | null;
  /** Correo que exige la política de acceso: activos = institucional, pasivos = alternativo. */
  correoObligatorio?: "institucional" | "alternativo";
}) {
  const [file, setFile] = useState<File | null>(defaultValues.file ?? null);

  const form = useForm<PasoBasicInfoType>({
    resolver: zodResolver(pasoBasicInfoSchema),
    defaultValues: defaultValues as PasoBasicInfoType,
  });

  useErroresDelPaso(form, erroresServidor, 0);

  const cedula = useWatch({ control: form.control, name: "cedulaidentidad" }) ?? "";
  const cedulaLimpia = cedula.trim();
  const { data: coincidencias } = useSWR(
    cedulaLimpia.length >= 6 ? ["empleado-registrado", cedulaLimpia] : null,
    () => getEmpleadosAction({ cedulaidentidad: cedulaLimpia }),
  );
  const validateCedula = useMemo(
    () => (coincidencias?.items ?? []).some((e) => e.cedula === cedulaLimpia),
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
    if (validateCedula) return;
    const campo = correoObligatorio === "institucional" ? "correo" : "correoAlternativo";
    if (!data[campo]?.trim()) {
      form.setError(campo, {
        type: "manual",
        message:
          correoObligatorio === "institucional"
            ? "El correo institucional es obligatorio"
            : "El correo alternativo es obligatorio",
      });
      return;
    }
    onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-500">Paso 1: Información Basica</CardAction>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitPaso)} autoComplete="off">
            <div className="flex flex-col gap-8">
              <div className="border rounded-lg p-4 gap-3">
                <CapturaFoto
                  etiqueta="Foto del Trabajador"
                  valorInicial={file}
                  nombreArchivo="foto-trabajador.jpg"
                  onChange={(foto) => {
                    setFile(foto);
                    form.setValue("file", foto);
                  }}
                />
              </div>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Identificación</h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nacionalidad_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Nacionalidad *</FormLabel>
                        <Select
                          value={field.value ? `${field.value}` : ""}
                          onValueChange={(v) => field.onChange(Number.parseInt(v))}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={isLoadingCatalogos ? "Cargando..." : "V / E"}
                              />
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
                  <InputForm
                    form={form}
                    label="Cedula de Identidad *"
                    nameInput="cedulaidentidad"
                    placeholder="00000000"
                    type="text"
                    inputMode="numeric"
                    maxLength={CEDULA_MAX}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Datos personales</h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <InputForm
                    form={form}
                    label="Nombres *"
                    nameInput="nombres"
                    placeholder="Juan Bernardo"
                    type="text"
                    maxLength={NOMBRE_MAX}
                  />
                  <InputForm
                    form={form}
                    label="Apellidos *"
                    nameInput="apellidos"
                    placeholder="Perez Gutierrez"
                    type="text"
                    maxLength={NOMBRE_MAX}
                  />
                  <FormField
                    control={form.control}
                    name="fecha_nacimiento"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
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
                              disabled={(date: Date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
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
                  <FormField
                    control={form.control}
                    name="estadoCivil"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Estado Civil *</FormLabel>
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
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Contacto</h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <InputForm
                    className="w-full"
                    form={form}
                    label={`${correoObligatorio === "alternativo" ? "Correo principal" : "Correo institucional"}${correoObligatorio === "institucional" ? " *" : ""}`}
                    nameInput="correo"
                    placeholder="usuario@conatel.gob.ve"
                    type="email"
                    maxLength={CORREO_MAX}
                  />
                  <InputForm
                    className="w-full"
                    form={form}
                    label={`Correo alternativo${correoObligatorio === "alternativo" ? " *" : ""}`}
                    nameInput="correoAlternativo"
                    placeholder="ejemplo@gmail.com"
                    type="email"
                    maxLength={CORREO_MAX}
                  />
                  <FormField
                    control={form.control}
                    name="telefono_movil"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Teléfono De Móvil</FormLabel>
                        <FormControl>
                          <CampoTelefono
                            tipo="movil"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            invalido={!!form.formState.errors.telefono_movil}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telefono_habitacion"
                    render={({ field }) => (
                      <FormItem className="flex flex-col gap-2">
                        <FormLabel>Teléfono De Habitación</FormLabel>
                        <FormControl>
                          <CampoTelefono
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            invalido={!!form.formState.errors.telefono_habitacion}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Código y serial del Carnet de la Patria
                </h3>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                  <InputForm
                    form={form}
                    label={ETIQUETA_CODIGO_CARNET_PATRIA}
                    nameInput="carnet_patria"
                    placeholder="0000000000"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                  />
                  <InputForm
                    form={form}
                    label={ETIQUETA_SERIAL_CARNET_PATRIA}
                    nameInput="carnet_patria_serial"
                    placeholder="Serial"
                    type="text"
                    maxLength={30}
                  />
                </div>
              </section>
            </div>
            <div className="border rounded-lg p-4 mt-4 flex flex-col gap-3">
              <div>
                <h3 className="font-semibold">Contactos de Emergencia (Opcional)</h3>
                <p className="text-sm text-muted-foreground">
                  Personas de enlace en caso de contingencias médicas o laborales.
                </p>
              </div>
              <ContactosEmergenciaCampos
                parentescos={catalogos?.parentescos ?? []}
                isLoading={isLoadingCatalogos}
              />
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                className="w-full"
                disabled={validateCedula}
                variant={validateCedula ? "destructive" : "default"}
              >
                {validateCedula ? "Trabajador ya se encuentra registrado" : "Siguiente"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
