"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";

import {
  getAcademyLevel,
  getMunicipalitys,
  getParish,
  getStates,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { updateEmployee } from "@/app/(protected)/dashboard/gestion-trabajadores/personal-trabajador/actions/updateEmployee";
import {
  AcademyLevel,
  ApiResponse,
  EmployeeData,
  Municipality,
  Parish,
  States,
} from "@/app/types/types";
import { Popover, PopoverTrigger } from "@radix-ui/react-popover";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { schemaEmployeeEdit } from "../../personal-trabajador/registrar/schemas/schemaRac";
import { Calendar } from "../../../../../../components/ui/calendar";
import { PopoverContent } from "../../../../../../components/ui/popover";

interface EmployeeEditModalProps {
  employee: EmployeeData;
  isOpen: boolean;
  onClose: () => void;
}

export function EmployeeEditModal({
  employee,
  isOpen,
  onClose,
}: EmployeeEditModalProps) {
  const [isPending, startTransition] = useTransition();
  const [academyLevel, setAcademyLevel] = useState<ApiResponse<AcademyLevel[]>>(
    {
      status: "",
      message: "",
      data: [],
    },
  );
  const [states, setStates] = useState<ApiResponse<States[]>>({
    status: "",
    message: "",
    data: [],
  });

  const [municipalitys, setMunicipalitys] = useState<
    ApiResponse<Municipality[]>
  >({
    status: "",
    message: "",
    data: [],
  });
  const [parish, setParish] = useState<ApiResponse<Parish[]>>({
    status: "",
    message: "",
    data: [],
  });
  useEffect(() => {
    const loadData = async () => {
      const [states, academyLevel] = await Promise.all([
        getStates(),
        getAcademyLevel(),
      ]);
      setStates(states);
      setAcademyLevel(academyLevel);
    };
    loadData();
  }, []);

  const form = useForm({
    resolver: zodResolver(schemaEmployeeEdit),
    defaultValues: {
      nombres: employee.nombres,
      apellidos: employee.apellidos,
      sexoid: 1,
      estadoid: 0,
      municipioid: 0,
      parroquiaid: 0,
      nivelAcademico: 0,
      direccionExacta: "",
      carnet_patria: employee.carnet_patria || "",
      fecha_nacimiento: "",
    },
  });
  async function handleSave(data: z.infer<typeof schemaEmployeeEdit>) {
    try {
      startTransition(async () => {
        const response = await updateEmployee(data, employee.cedulaidentidad);
        if (response.success) {
          toast.success(response.message);
        } else {
          toast.error(response.message);
        }
      });
    } catch {}
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Ficha de Empleado</DialogTitle>
          <DialogDescription>
            Actualize los datos del empleado: {employee.nombres}{" "}
            {employee.apellidos}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)}>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FormField
                    control={form.control}
                    name="nombres"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombres</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Bernardo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="carnet_patria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carnet de la Patria</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="00000000000000000000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FormField
                    control={form.control}
                    name="apellidos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellidos</FormLabel>
                        <FormControl>
                          <Input placeholder="Gutierrez Perez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Job Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sexoid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo *</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(Number.parseInt(value))
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={"Seleccione un Genero"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Masculino</SelectItem>
                          <SelectItem value="2">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estadoid"
                  render={({ field }) => (
                    <FormItem className=" ">
                      <FormLabel>Estado</FormLabel>
                      <Select
                        onValueChange={async (value) => {
                          field.onChange(Number.parseInt(value));
                          setMunicipalitys(
                            await getMunicipalitys(String(value)),
                          );
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={"Seleccione un Estado"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {states.data.map((state, i) => (
                            <SelectItem
                              key={i}
                              value={`${state.id}`}
                              onClick={async () =>
                                setMunicipalitys(
                                  await getMunicipalitys(String(state.id)),
                                )
                              }
                            >
                              {state.estado}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormField
                    control={form.control}
                    name="municipioid"
                    render={({ field }) => (
                      <FormItem className=" ">
                        <FormLabel>Municpio</FormLabel>
                        <Select
                          onValueChange={async (value) => {
                            field.onChange(Number.parseInt(value));
                            setParish(await getParish(String(value)));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={"Seleccione un Municpio"}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {municipalitys.data.map((municipality, i) => (
                              <SelectItem key={i} value={`${municipality.id}`}>
                                {municipality.municipio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Esta Información Sera Publica
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="parroquiaid"
                  render={({ field }) => (
                    <FormItem className=" ">
                      <FormLabel>Parroquia</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={"Seleccione una Parroquia"}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {parish.data.map((parish, i) => (
                            <SelectItem key={i} value={`${parish.id}`}>
                              {parish.parroquia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Esta Información Sera Publica
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Observations */}
              <FormField
                control={form.control}
                name="direccionExacta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direccion Detallada *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Calle Principal 123, Apartamento 4B, Entre calles 5 y 6"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Esto Sera Privado</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nivelAcademico"
                render={({ field }) => (
                  <FormItem className=" ">
                    <FormLabel>Nivel Academico</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={"Seleccione un Nivel Academico"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {academyLevel.data.map((nivel, i) => (
                          <SelectItem key={i} value={`${nivel.id}`}>
                            {nivel.nivelacademico}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_nacimiento"
                render={({ field }) => (
                  <FormItem className="flex flex-col  grow shrink basis-40">
                    <FormLabel> Fecha de Nacimiento *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className="font-light">
                            {field.value ? (
                              formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          onSelect={field.onChange}
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
              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
