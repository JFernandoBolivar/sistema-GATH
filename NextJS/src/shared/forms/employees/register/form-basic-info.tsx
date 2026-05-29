"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useState } from "react";

import {
  getEmployeeInfo,
  getMaritalstatus,
  getSex,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateWeight } from "@/constants/fileSize";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Upload, X } from "lucide-react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { BasicInfoType, schemaBasicInfo } from "@/shared/schemas/employees/register/schema-basic-info";
type Props = {
  onSubmit: (values: BasicInfoType) => void
  defaultValues: BasicInfoType
  title?: string
  employeeType?: string
}
export function FormBasicInfo({
  onSubmit,
  defaultValues,
  title = "Registrar Nuevo Trabajador",
  employeeType = "trabajador",
}: Props) {
  const [photoPreview, setPhotoPreview] = useState<string | null | undefined>(
    null,
  );
  const [validateCedula, setValidateCedula] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const { data: maritalStatus, isLoading: isLoadingMaritalStatus } = useSWR(
    "maritalStatus",
    async () => await getMaritalstatus(),
  );
  const { data: sex, isLoading: isLoadingSex } = useSWR(
    "sex",
    async () => await getSex(),
  );
  const form = useForm({
    resolver: zodResolver(schemaBasicInfo),
    defaultValues,
  });
  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    form.setValue("file", null as unknown as File);
  };

  const onSubmitFormity = (data: BasicInfoType) => {
    if (!validateCedula) {
      onSubmit(data);
    }
  };
  const employee = useWatch({
    control: form.control,
    name: "cedulaidentidad",
  });

  const validateEmployee = employee.trim() && employee.length >= 6;

  const { data: searchEmployee } = useSWR(
    employee?.trim().length >= 6 ? `employee-${employee}` : null,
    () => getEmployeeInfo(employee),
  );
  useEffect(() => {
    if (!searchEmployee || searchEmployee.data === undefined) return;
    if (
      !Array.isArray(searchEmployee.data) &&
      typeof searchEmployee.data === "object"
    ) {
      toast.error(`Ya existe un ${employeeType} con esa cédula de identidad`);
      setValidateCedula(true);
    } else if (
      Array.isArray(searchEmployee.data) &&
      searchEmployee.data.length === 0
    ) {
      setValidateCedula(false);
    }
  }, [searchEmployee]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-500">
          Paso 1: Información Basica
        </CardAction>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitFormity)}
            autoComplete="off"
          >
            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
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
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="text-center w-full">
                      {
                        validateWeight(
                          file?.size ? file.size : 0,
                          5 * 1024 * 1024,
                        ).formattedSize
                      }
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <FormField
                      control={form.control}
                      name="file"
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
                        <FormItem className="w-full h-full text-center flex flex-col justify-center items-center">
                          <Upload className="h-8 w-8 text-gray-400" />
                          <FormLabel className="text-center p-1.5 bg-gray-300 text-black rounded-2xl animate-bounce cursor-pointer">
                            Haz clic aqui para seleccionar foto
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...fieldProps}
                              type="file"
                              accept=".png,.jpeg,.jpg"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                onChange(file);
                                if (file) {
                                  setFile(file);
                                  setPhotoPreview(URL.createObjectURL(file));
                                } else {
                                  setPhotoPreview("/placeholder.svg");
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
                  <div className="flex-1">
                    <InputForm
                      form={form}
                      label="Cedula de Identidad *"
                      nameInput="cedulaidentidad"
                      placeholder="00000000"
                      type="number"
                    />
                  </div>
                  <div className="flex-1">
                    <InputForm
                      form={form}
                      label="Carnet de la Patria"
                      nameInput="carnet_patria"
                      placeholder="00000000000000000000"
                      type="text"
                    />
                  </div>
                </div>
                <div className="flex gap-2 col-span-2">
                  <div className="flex-1">
                    <InputForm
                      form={form}
                      label="Nombre *"
                      nameInput="nombres"
                      placeholder="Juan Bernardo"
                      type="text"
                    />
                  </div>
                  <div className="flex-1">
                    <InputForm
                      form={form}
                      label="Apellidos *"
                      nameInput="apellidos"
                      placeholder="Perez Gutierrez"
                      type="text"
                    />
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
                            <Button variant={"outline"} className="font-light">
                              {field.value ? (
                                formatInTimeZone(
                                  field.value,
                                  "UTC",
                                  "dd/MM/yyy",
                                )
                              ) : (
                                <span>Selecciona una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
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
                  isLoading={isLoadingSex}
                  placeholder="Seleccione un Genero"
                  nameSalect="sexoid"
                  labelKey={"sexo"}
                  valueKey={"id"}
                  options={sex?.data ?? []}
                />
                <InputForm
                  className="w-full"
                  form={form}
                  label="Correo Electronico"
                  nameInput="correo"
                  placeholder="ejemplo@gmail.com"
                  type="email"
                />
                <InputForm
                  form={form}
                  label="Teléfono De Móvil"
                  nameInput="telefono_movil"
                  placeholder="04160000000"
                  type="number"
                />
                <InputForm
                  form={form}
                  label="Teléfono De Habitación"
                  nameInput="telefono_habitacion"
                  placeholder="02390000000"
                  type="number"
                />
                <FormField
                  control={form.control}
                  name="estadoCivil"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Estado Civil </FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate ">
                            <SelectValue
                              placeholder={`${isLoadingMaritalStatus ? "Cargando Estado Civil" : "Seleccione Un Estado Civil"}`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {maritalStatus?.data.map((status, i) => (
                            <SelectItem key={i} value={`${status.id}`}>
                              {status.estadoCivil}
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
              <Button
                className="w-full"
                disabled={validateCedula}
                variant={validateCedula ? "destructive" : "default"}
              >
                {validateCedula
                  ? "Trabajador ya se encuentra registrado"
                  : "Siguiente"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
