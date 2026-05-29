"use client";

import { useMemo, useState, useTransition } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import type { Opcion, Pregunta } from "@/app/types/types";
import {
  getConditionDwelling,
  getMunicipalitys,
  getParish,
  getStates,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import {
  getPreguntas,
  consultarCensoEmpleado,
} from "@/app/(protected)/dashboard/autogestion/api/getInfoAutogestion";
import { buildSchema } from "@/app/(protected)/dashboard/autogestion/schema/schema-autogestion";
import {
  enviarAutogestion,
  getSessionCedula,
} from "@/app/(protected)/dashboard/autogestion/actions/autogestion-actions";
import InputForm from "@/components/input-form";
import RadioGroupForm from "@/components/form-radio-group";
import CheckboxForm from "@/components/form-checkbox";
import { Badge, ClipboardCheck, FileText, IdCard } from "lucide-react";

interface DynamicFormValues extends FieldValues {
  [key: string]: string | boolean | { [key: string]: string | number };
}

const isDev = process.env.NODE_ENV === "development";

export default function AutogestionPage() {
  const [isPending, startTransition] = useTransition();
  const [estadoId, setEstadoId] = useState<string>();
  const [municipioId, setMunicipioId] = useState<string>();

  const { data: cedula } = useSWR("session-cedula", getSessionCedula);

  const { data: censoData, isLoading: isLoadingCenso } = useSWR(
    cedula ? ["censo-consulta", cedula] : null,
    () => consultarCensoEmpleado(cedula!),
  );

  const { data: preguntasData, isLoading: isLoadingPreguntas } = useSWR(
    "autogestion-preguntas",
    getPreguntas,
  );
  const { data: states, isLoading: isLoadingStates } = useSWR("states", getStates);
  const { data: municipalitys, isLoading: isLoadingMunicipalitys } = useSWR(
    estadoId ? ["municipalitys", estadoId] : null,
    () => getMunicipalitys(estadoId!),
  );
  const { data: parish, isLoading: isLoadingParish } = useSWR(
    municipioId ? ["parish", municipioId] : null,
    () => getParish(municipioId!),
  );
  const { data: conditionDwelling, isLoading: isLoadingConditionDwelling } =
    useSWR("conditionDwelling", getConditionDwelling);

  const preguntas: Pregunta[] = preguntasData?.data ?? [];
  const schema = useMemo(() => buildSchema(preguntas), [preguntas]);

  const form = useForm<DynamicFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const yaRespondio =
    Array.isArray(censoData?.data) && censoData.data.length > 0 && censoData.data[0]?.preguntas?.length > 0;
  const miCenso = Array.isArray(censoData?.data) ? censoData.data[0] : null;
  const isLoading = isLoadingCenso || isLoadingPreguntas;

  const onSubmit = (values: DynamicFormValues) => {
    startTransition(async () => {
      let carnetPatria = "";

      const respuestas = preguntas.map((pregunta) => {
        const key = String(pregunta.id);
        const value = values[key];

        if (pregunta.id === 1) {
          carnetPatria = (value as string) || "";
        }

        if (
          pregunta.tipo.nombre === "cerrada" &&
          pregunta.opciones.length === 1
        ) {
          return {
            pregunta: pregunta.id,
            opcion: value ? pregunta.opciones[0].id : null,
            respuesta: "",
          };
        }

        if (pregunta.tipo.nombre === "cerrada") {
          return {
            pregunta: pregunta.id,
            opcion: value ? Number(value) : null,
            respuesta: "",
          };
        }

        return {
          pregunta: pregunta.id,
          opcion: null,
          respuesta: (value as string) || "",
        };
      });

      const vivienda = values["datos_vivienda"] as Record<string, string | number> | undefined;

      const response = await enviarAutogestion(carnetPatria, vivienda, respuestas);
      if (response.success) {
        toast.success(response.message || "Formulario enviado exitosamente.");
        form.reset();
      } else {
        toast.error(response.message || "Error al enviar el formulario.");
      }
    });
  };

  return (
    <div className="p-6">
      {isLoading ? (
          <div className="space-y-4 max-w-3xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : yaRespondio && !isDev ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="border-2 border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <ClipboardCheck className="h-12 w-12 text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-emerald-800">
                  Autogestión Completada
                </h2>
                <p className="text-emerald-700 max-w-md mx-auto">
                  Ya has completado el formulario de autogestión de personal. No es necesario que lo realices nuevamente.
                </p>
              </CardContent>
            </Card>

            {miCenso && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Resumen de su Autogestión
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <IdCard className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Cédula:</span>
                      <span>{miCenso.cedula}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Badge className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Carnet Patria:</span>
                      <span>{miCenso.carnet_patria || "No registrado"}</span>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                      <ClipboardCheck className="h-4 w-4" />
                      <span className="font-medium">
                        Respuestas registradas ({miCenso.preguntas?.length || 0})
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {miCenso.preguntas?.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm bg-gray-50 rounded p-2"
                        >
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <div>
                            <p className="text-gray-700">{r.pregunta}</p>
                            <p className="text-gray-400 text-xs">
                              {r.opcion ? r.opcion.opcion : r.respuesta || "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <Card className="p-6 md:p-10 bg-white border border-gray-200 shadow-lg rounded-lg">
              {isDev && yaRespondio && (
                <div className="border-2 border-yellow-400/45 bg-yellow-100/40 rounded-sm p-3 mb-6 text-sm text-yellow-700">
                  [DEV] El usuario ya respondió este censo. El formulario se muestra solo por estar en modo desarrollo.
                </div>
              )}

              <div className="mb-8 text-center">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                  AUTOGESTIÓN DE PERSONAL
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Oficina de Gestión Humana - CONATEL
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  * Indica que la pregunta es obligatoria
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
                  {preguntas.map((pregunta) => (
                    <div key={pregunta.id}>
                      {pregunta.tipo.nombre === "abierta" ? (
                        <InputForm
                          form={form}
                          nameInput={String(pregunta.id) as any}
                          label={`${pregunta.enunciado} *`}
                          type="text"
                          placeholder="Escriba su respuesta"
                        />
                      ) : pregunta.tipo.nombre === "cerrada" &&
                        pregunta.opciones.length === 1 ? (
                        <CheckboxForm
                          form={form}
                          nameInput={String(pregunta.id) as any}
                          label={`${pregunta.enunciado} *`}
                        />
                      ) : (
                        <RadioGroupForm
                          form={form}
                          nameInput={String(pregunta.id) as any}
                          label={`${pregunta.enunciado} *`}
                          options={pregunta.opciones.map((op: Opcion) => ({
                            value: String(op.id),
                            label: op.tipo_opcion,
                          }))}
                        />
                      )}
                    </div>
                  ))}

                  <Separator />

                  <h2 className="text-lg font-bold">Datos de Vivienda *</h2>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name={"datos_vivienda.estado_id" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(Number(value));
                              setEstadoId(value);
                              form.setValue("datos_vivienda.municipio_id" as any, 0);
                              form.setValue("datos_vivienda.parroquia" as any, 0);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingStates
                                      ? "Cargando Estados"
                                      : "Seleccione un Estado"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {states?.data.map((s) => (
                                <SelectItem key={s.id} value={`${s.id}`}>
                                  {s.estado}
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
                      name={"datos_vivienda.municipio_id" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Municipio *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(Number(value));
                              setMunicipioId(value);
                              form.setValue("datos_vivienda.parroquia" as any, 0);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingMunicipalitys
                                      ? "Cargando Municipios"
                                      : "Seleccione un Municipio"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {municipalitys?.data.map((m) => (
                                <SelectItem key={m.id} value={`${m.id}`}>
                                  {m.municipio}
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
                      name={"datos_vivienda.parroquia" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parroquia *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(Number(value));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingParish
                                      ? "Cargando Parroquias"
                                      : "Seleccione una Parroquia"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {parish?.data.map((p) => (
                                <SelectItem key={p.id} value={`${p.id}`}>
                                  {p.parroquia}
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
                      name={"datos_vivienda.condicion_vivienda_id" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condición de Vivienda *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(Number(value));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingConditionDwelling
                                      ? "Cargando Condiciones"
                                      : "Seleccione una Condición"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {conditionDwelling?.data.map((c) => (
                                <SelectItem key={c.id} value={`${c.id}`}>
                                  {c.condicion}
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
                      name={"datos_vivienda.direccion_exacta" as any}
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Dirección Exacta *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Calle, Casa, Apartamento, Sector"
                              {...field}
                              value={(field.value as string) ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"datos_vivienda.codigo_postal" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código Postal</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="1010"
                              {...field}
                              value={(field.value as string) ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <p className="text-xs text-gray-600 text-justify">
                    La información suministrada es estrictamente confidencial y de uso
                    exclusivo interno para los fines institucionales de la Oficina de
                    Gestión Humana.
                  </p>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full py-6 text-base font-semibold"
                    size="lg"
                  >
                    {isPending ? "Enviando..." : "ENVIAR AUTOGESTIÓN"}
                  </Button>
                </form>
              </Form>
            </Card>
          </div>
        )}
      </div>
    );
}
