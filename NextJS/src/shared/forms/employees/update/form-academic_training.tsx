"use client";
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
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";

import {
  getAcademyLevel,
  getCarrera,
  getMencion,
  getInstituciones,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { AcademyType } from "@/shared/schemas/employees/register/schema-academic_training";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cross, Trash, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import {
  AcademyUpdateUpdateType,
  schemaAcademyUpdate,
} from "@/shared/schemas/employees/update/schema-academic_training";
import { useSearchStore } from "@/hooks/use-search-params";
import { Badge } from "@/components/ui/badge";

type Props = {
  defaultValues: AcademyType;
  idEmployee: string;
  mutate: (key: string[]) => void;
  mutateKey?: string;
    updateInfoEmployee: (...args: any[]) => Promise<{ success: boolean; message: string }>;
};
export default function FormUpdateAcademyLevel({
  defaultValues,
  idEmployee,
  mutate,
  mutateKey = "api/empleados",
  updateInfoEmployee,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [mencionId, setMencionId] = useState<string>();
  const [nivelAcademicoId, setNivelAcademicoId] = useState<number>();

  const form = useForm({
    resolver: zodResolver(schemaAcademyUpdate),
    values: defaultValues,
  });

  useEffect(() => {
    const firstNivel = defaultValues.formacion_academica?.[0]?.nivel_Academico_id;
    const firstCarrera = defaultValues.formacion_academica?.[0]?.carrera_id;
    if (firstNivel && firstNivel > 0) {
      setNivelAcademicoId(firstNivel);
    }
    if (firstCarrera && firstCarrera > 0) {
      setMencionId(String(firstCarrera));
    }
  }, [defaultValues]);

  const { fields, append, remove } = useFieldArray({
    name: "formacion_academica",
    control: form.control,
  });

  const { data: academyLevel, isLoading: isLoadingAcademyLevel } = useSWR(
    "academyLevel",
    async () => await getAcademyLevel(),
  );
  const { data: carrera, isLoading: isLoadingCarrera } = useSWR(
    nivelAcademicoId ? ["carrera", nivelAcademicoId] : null,
    async () => await getCarrera(nivelAcademicoId),
  );
  const { data: mencion, isLoading: isLoadingMencion } = useSWR(
    mencionId ? ["mencion", mencionId] : null,
    async () => await getMencion(mencionId!),
  );
  const { data: instituciones, isLoading: isLoadingInstituciones } = useSWR(
    "instituciones",
    async () => await getInstituciones(),
  );
  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmitFormity = (values: AcademyUpdateUpdateType) => {
    startTransition(async () => {
      const response = await updateInfoEmployee(values, idEmployee);
      if (response.success) {
        toast.success(response.message);
        mutate([mutateKey, searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };
  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Formacion Academica</CardTitle>
        </CardHeader>

        <CardContent>
          <CardAction className="text-gray-500">Información Academica</CardAction>
        </CardContent>

        <CardContent>
          {isPending ? (
            <Loading promiseMessage="Actualizando Información" />
          ) : (
            <Form {...form}>
              <form
                className="flex flex-col gap-2"
                onSubmit={form.handleSubmit(onSubmitFormity)}
              >
                <div className="flex justify-end gap-2 mr-4 items-center">
                  <div className="flex flex-col items-center justify-center">
                    <Label htmlFor="clean">Limpiar</Label>
                    <Button
                      id="clean"
                      variant={"destructive"}
                      type="button"
                      className="cursor-pointer"
                      onClick={() => {
                        remove(
                          fields
                            .filter((_f, i) => i !== 0)
                            .map((_f, i) => i + 1),
                        );
                        form.reset({
                          formacion_academica: [
                            {
                              nivel_Academico_id: undefined,
                              carrera_id: undefined,
                              nueva_carrera_nombre: undefined,
                              mencion_id: undefined,
                              nueva_mencion_nombre: undefined,
                              institucion_id: undefined,
                              nueva_institucion_nombre: undefined,
                            },
                          ],
                        } as unknown as AcademyType);
                      }}
                    >
                      <Trash />
                    </Button>
                  </div>
                  {isError && (
                    <div className="flex flex-col items-center justify-center">
                      <Label htmlFor="add">Agregar</Label>
                      <Button
                        id="add"
                        variant={"default"}
                        type="button"
                        className="cursor-pointer"
                        onClick={() => {
                          append({
                            nivel_Academico_id: undefined,
                            carrera_id: undefined,
                            nueva_carrera_nombre: undefined,
                            mencion_id: undefined,
                            nueva_mencion_nombre: undefined,
                            institucion_id: undefined,
                            nueva_institucion_nombre: undefined,
                          });
                        }}
                      >
                        <Cross />
                      </Button>
                    </div>
                  )}
                </div>
                <ScrollArea className="h-60 rounded-md w-full border p-2">
                  <h1 className="text-gray-600">
                    Opcional si no posee formación académica
                  </h1>
                  {fields.map((field, index) => {
                    const watchedCarreraId = form.watch(
                      `formacion_academica.${index}.carrera_id`,
                    );
                    const watchedInstitucionId = form.watch(
                      `formacion_academica.${index}.institucion_id`,
                    );
                    const watchedMencionId = form.watch(
                      `formacion_academica.${index}.mencion_id`,
                    );
                    const watchedNivelAcademicoId = form.watch(
                      `formacion_academica.${index}.nivel_Academico_id`,
                    );
                    const isOtherCareer = watchedCarreraId === -1;
                    const isOtherInstitucion = watchedInstitucionId === -1;
                    const isOtherMencion = watchedMencionId === -1;
                    const hasCarrera = watchedCarreraId != null && watchedCarreraId > 0;
                    const nivelSeleccionado = academyLevel?.data?.find(n => n.id === watchedNivelAcademicoId);
                    const esNoPosee = nivelSeleccionado?.nivelacademico?.toLowerCase().includes("no posee") || nivelSeleccionado?.nivelacademico?.toLowerCase() === "n/p";

                    return (
                      <div
                        key={field.id}
                        className="flex flex-row gap-5 items-start w-full"
                      >
                        <FormField
                          control={form.control}
                          name={`formacion_academica.${index}.nivel_Academico_id`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {index + 1}. Nivel Academico
                              </FormLabel>
                              <Select
                                onValueChange={(v) => {
                                  const id = Number.parseInt(v);
                                  field.onChange(id);
                                  setNivelAcademicoId(id);
                                }}
                                value={field.value?.toString() ?? ""}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-44">
                                    <SelectValue
                                      placeholder={
                                        isLoadingAcademyLevel
                                          ? "Cargando..."
                                          : "Seleccione"
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {academyLevel?.data.map((nivel, i) => (
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
                        <div className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name={`formacion_academica.${index}.carrera_id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Carrera (Opcional)</FormLabel>
                                <Select
                                  onValueChange={(v) => {
                                    if (v === "-1") {
                                      field.onChange(-1);
                                      form.setValue(
                                        `formacion_academica.${index}.mencion_id` as never,
                                        undefined as never,
                                      );
                                      setMencionId(undefined);
                                    } else {
                                      const numV = Number(v);
                                      field.onChange(numV);
                                      form.setValue(
                                        `formacion_academica.${index}.nueva_carrera_nombre` as never,
                                        "" as never,
                                      );
                                      setMencionId(v);
                                    }
                                  }}
                                  value={
                                    field.value === -1
                                      ? "-1"
                                      : field.value?.toString() ?? ""
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-44">
                                      <SelectValue
                                        placeholder={
                                          isLoadingCarrera
                                            ? "Cargando..."
                                            : "Seleccione"
                                        }
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {carrera?.data.map((c, i) => (
                                      <SelectItem key={i} value={`${c.id}`}>
                                        {c.nombre_carrera}
                                      </SelectItem>
                                    ))}
                                    {!!watchedNivelAcademicoId && watchedNivelAcademicoId > 0 && !esNoPosee && (
                                      <SelectItem value="-1">Otra</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className={!isOtherCareer ? "hidden" : ""}>
                            <FormField
                              control={form.control}
                              name={`formacion_academica.${index}.nueva_carrera_nombre`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>&nbsp;</FormLabel>
                                  <FormControl>
                                    <Input
                                      className="w-44"
                                      placeholder="Nueva carrera..."
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Se asociará al nivel académico seleccionado.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name={`formacion_academica.${index}.mencion_id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mención (Opcional)</FormLabel>
                                <Select
                                  onValueChange={(v) => {
                                    if (v === "-1") {
                                      field.onChange(-1);
                                    } else {
                                      field.onChange(Number.parseInt(v));
                                      form.setValue(
                                        `formacion_academica.${index}.nueva_mencion_nombre` as never,
                                        "" as never,
                                      );
                                    }
                                  }}
                                  value={
                                    field.value === -1
                                      ? "-1"
                                      : field.value?.toString() ?? ""
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-44">
                                      <SelectValue
                                        placeholder={
                                          isLoadingMencion
                                            ? "Cargando..."
                                            : "Seleccione"
                                        }
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {mencion?.data.map((m, i) => (
                                      <SelectItem key={i} value={`${m.id}`}>
                                        {m.nombre_mencion}
                                      </SelectItem>
                                    ))}
                                    {hasCarrera && (
                                      <SelectItem value="-1">Otra</SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className={!isOtherMencion ? "hidden" : ""}>
                            <FormField
                              control={form.control}
                              name={`formacion_academica.${index}.nueva_mencion_nombre`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>&nbsp;</FormLabel>
                                  <FormControl>
                                    <Input
                                      className="w-44"
                                      placeholder="Nueva mención..."
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FormField
                            control={form.control}
                            name={`formacion_academica.${index}.institucion_id`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Institución {hasCarrera ? <span className="text-red-500">*</span> : "(Opcional)"}
                                </FormLabel>
                                <Select
                                  onValueChange={(v) => {
                                    if (v === "-1") {
                                      field.onChange(-1);
                                    } else {
                                      const numV = Number(v);
                                      field.onChange(numV);
                                      form.setValue(
                                        `formacion_academica.${index}.nueva_institucion_nombre` as never,
                                        "" as never,
                                      );
                                    }
                                  }}
                                  value={
                                    field.value === -1
                                      ? "-1"
                                      : field.value?.toString() ?? ""
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-44">
                                      <SelectValue
                                        placeholder={
                                          isLoadingInstituciones
                                            ? "Cargando..."
                                            : "Seleccione"
                                        }
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {instituciones?.data?.map((i) => (
                                      <SelectItem
                                        key={i.id}
                                        value={i.id.toString()}
                                      >
                                        {i.nombre_institucion}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="-1">Otra</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className={!isOtherInstitucion ? "hidden" : ""}>
                            <FormField
                              control={form.control}
                              name={`formacion_academica.${index}.nueva_institucion_nombre`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>&nbsp;</FormLabel>
                                  <FormControl>
                                    <Input
                                      className="w-44"
                                      placeholder="Nueva institución..."
                                      {...field}
                                      value={field.value ?? ""}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 invisible">X</span>
                          <Button
                            type="button"
                            variant={"destructive"}
                            size="icon"
                            className={`${index === 0 ? "invisible" : ""} cursor-pointer`}
                            onClick={() => remove(index)}
                          >
                            <X />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </ScrollArea>
                {!isError && (
                  <Badge
                    className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                    variant={"destructive"}
                  >
                    {" "}
                    Por favor, corrija los campos marcados o complete la
                    información pendiente antes de agregar una nueva formación
                    academica.
                  </Badge>
                )}
                <Button
                  className="mt-4 w-full cursor-pointer"
                  disabled={isPending}
                >
                  {isPending ? "Actualizando Información" : "Actualizar"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
