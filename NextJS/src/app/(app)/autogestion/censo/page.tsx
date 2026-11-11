"use client";

import { ContadorCaracteres } from "@/components/contador-caracteres";
import {
  ETIQUETA_CODIGO_CARNET_PATRIA,
  ETIQUETA_SERIAL_CARNET_PATRIA,
} from "@/shared/domain/etiquetas-carnet-patria";
import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import { useMemo, useState, useTransition } from "react";
import { type FieldPath, type FieldValues, useForm } from "react-hook-form";
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
import type { DatosViviendaCenso } from "@/modules/autogestion/domain/entities/censo";
import {
  getSessionCedulaAction,
  consultarCensoEmpleadoAction,
  getPreguntasAction,
  enviarAutogestionAction,
  getStatesAction,
  getMunicipalitysAction,
  getParishAction,
  getConditionDwellingAction,
  getCodigosPostalesAction,
} from "@/modules/autogestion/infrastructure/actions/autogestion-actions";
import { buildSchema } from "@/modules/autogestion/ui/schema/schema-autogestion";
import { GUIA_CENSO_VIVIENDA } from "@/modules/autogestion/ui/guias/definiciones-guias";
import { useRegistrarGuia } from "@/modules/autogestion/ui/guias/contexto-guia";
import { useGuia } from "@/shared/ui/guias";
import { PageHeader } from "@/shared/ui/components/page-header";
import InputForm from "@/components/input-form";
import RadioGroupForm from "@/components/form-radio-group";
import CheckboxForm from "@/components/form-checkbox";
import { Badge, Building2, ClipboardCheck, FileText, IdCard } from "lucide-react";

interface DynamicFormValues extends FieldValues {
  [key: string]: string | boolean | number | { [key: string]: string | number };
}

const isDev = process.env.NODE_ENV === "development";

export default function AutogestionPage() {
  const [isPending, startTransition] = useTransition();
  const [estadoId, setEstadoId] = useState<string>();
  const [municipioId, setMunicipioId] = useState<string>();

  const { data: cedula, isLoading: isLoadingCedula } = useSWR("session-cedula", () =>
    getSessionCedulaAction(),
  );

  const {
    data: censoData,
    isLoading: isLoadingCenso,
    mutate: mutateCenso,
  } = useSWR(cedula ? ["censo-consulta", cedula] : null, () =>
    consultarCensoEmpleadoAction(cedula!),
  );

  const { data: preguntasData, isLoading: isLoadingPreguntas } = useSWR(
    "autogestion-preguntas",
    () => getPreguntasAction(),
  );

  const { data: states, isLoading: isLoadingStates } = useSWR("states", () => getStatesAction());

  const { data: municipalitys, isLoading: isLoadingMunicipalitys } = useSWR(
    estadoId ? ["municipalitys", estadoId] : null,
    () => getMunicipalitysAction(estadoId!),
  );

  const { data: parish, isLoading: isLoadingParish } = useSWR(
    municipioId ? ["parish", municipioId] : null,
    () => getParishAction(municipioId!),
  );

  const { data: conditionDwelling, isLoading: isLoadingConditionDwelling } = useSWR(
    "conditionDwelling",
    () => getConditionDwellingAction(),
  );

  const { data: codigosPostales, isLoading: isLoadingCodigosPostales } = useSWR(
    estadoId ? ["codigosPostales", estadoId] : null,
    () => getCodigosPostalesAction(estadoId!),
  );

  const preguntas: Pregunta[] = preguntasData?.data ?? [];
  const { preguntasPrincipales, preguntasDeclaracion } = useMemo(() => {
    const principales: Pregunta[] = [];
    const declaracion: Pregunta[] = [];
    for (const p of preguntas) {
      if (p.id === 11 || p.id === 12) {
        declaracion.push(p);
      } else {
        principales.push(p);
      }
    }
    return { preguntasPrincipales: principales, preguntasDeclaracion: declaracion };
  }, [preguntas]);

  const schema = useMemo(() => buildSchema(preguntas), [preguntas]);

  const form = useForm<DynamicFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
    mode: "onChange",
  });

  const yaRespondio =
    Array.isArray(censoData?.data) &&
    censoData.data.length > 0 &&
    censoData.data[0]?.preguntas?.length > 0;
  const miCenso = Array.isArray(censoData?.data) ? censoData.data[0] : null;
  const isLoading = isLoadingCedula || isLoadingCenso || isLoadingPreguntas;

  const { iniciarGuia } = useGuia({ guia: GUIA_CENSO_VIVIENDA, autoIniciar: true });
  // La guía acompaña al formulario; en el resumen de «ya respondió» no aplica.
  useRegistrarGuia(!isLoading && (!yaRespondio || isDev) ? iniciarGuia : null);

  const onSubmit = (values: DynamicFormValues) => {
    startTransition(async () => {
      let carnetPatria = "";

      const respuestas = preguntas.map((pregunta) => {
        const key = String(pregunta.id);
        const value = values[key];
        const tipo = typeof pregunta.tipo === "string" ? pregunta.tipo : pregunta.tipo?.nombre;

        if (pregunta.id === 1) {
          carnetPatria = String(value ?? "");
        }

        if (tipo === "cerrada" && pregunta.opciones?.length === 1) {
          return {
            pregunta: pregunta.id,
            opcion: value ? pregunta.opciones[0].id : null,
            respuesta: "",
          };
        }

        if (tipo === "cerrada") {
          return {
            pregunta: pregunta.id,
            opcion: value ? Number(value) : null,
            respuesta: "",
          };
        }

        return {
          pregunta: pregunta.id,
          opcion: null,
          respuesta: String(value ?? ""),
        };
      });

      const vivienda = values["datos_vivienda"] as DatosViviendaCenso | undefined;

      const response = await enviarAutogestionAction(carnetPatria, vivienda, respuestas);
      if (response.success) {
        toast.success(response.message || "Formulario enviado exitosamente.");
        form.reset();
        mutateCenso();
      } else {
        toast.error(response.message || "Error al enviar el formulario.");
      }
    });
  };

  return (
    <div className="p-4 sm:p-6">
      {isLoading ? (
        <div className="gap-4 max-w-3xl mx-auto flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : yaRespondio && !isDev ? (
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <Card className="border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20">
            <CardContent className="p-8 text-center gap-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-500/20 p-4">
                  <ClipboardCheck className="size-12 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Autogestión Completada</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Ya has completado el formulario de autogestión de personal. No es necesario que lo
                realices nuevamente.
              </p>
            </CardContent>
          </Card>

          {miCenso && (
            <Card className="mt-6 bg-card border-border">
              <CardContent className="p-6 gap-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="size-5 text-muted-foreground" />
                  Resumen de su Autogestión
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-foreground">
                    <IdCard className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">Cédula:</span>
                    <span className="break-all">{miCenso.cedula}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-foreground">
                    <Badge className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{ETIQUETA_CODIGO_CARNET_PATRIA}:</span>
                    <span className="break-all">{miCenso.carnet_patria || "No registrado"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-foreground">
                    <Badge className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{ETIQUETA_SERIAL_CARNET_PATRIA}:</span>
                    <span className="break-all">{miCenso.carnet_patria_serial || "No registrado"}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <ClipboardCheck className="size-4 text-muted-foreground" />
                    <span className="font-medium">
                      Respuestas registradas ({miCenso.preguntas?.length || 0})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {miCenso.preguntas?.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm bg-muted/40 border border-border/50 rounded-lg p-3"
                      >
                        <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">•</span>
                        <div>
                          <p className="text-foreground font-medium">{r.pregunta}</p>
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {r.opcion ? r.opcion.opcion : r.respuesta || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {miCenso.cargos && miCenso.cargos.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Building2 className="size-4 text-muted-foreground" />
                        <span className="font-medium">
                          Ubicaciones Administrativas ({miCenso.cargos.length})
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {miCenso.cargos.map((cargo, i) => (
                          <div key={i} className="text-sm bg-muted/40 border border-border/50 rounded-lg p-3 gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                {cargo.codigo}
                              </span>
                              <span className="text-foreground font-medium">
                                {cargo.denominacioncargo?.cargo || "Cargo"}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1.5 ml-1 flex flex-col gap-0.5">
                              {cargo.Dependencia && <span>{cargo.Dependencia.dependencia}</span>}
                              {cargo.DireccionGeneral && (
                                <span>
                                  <span className="text-muted-foreground/70">{" > "}</span>
                                  {cargo.DireccionGeneral.direccion_general}
                                </span>
                              )}
                              {cargo.DireccionLinea && (
                                <span>
                                  <span className="text-muted-foreground/70">{" > "}</span>
                                  {cargo.DireccionLinea.direccion_linea}
                                </span>
                              )}
                              {cargo.Coordinacion && (
                                <span>
                                  <span className="text-muted-foreground/70">{" > "}</span>
                                  {cargo.Coordinacion.coordinacion}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <Card className="p-4 sm:p-6 md:p-8 bg-card border border-border shadow-xs rounded-xl">
            {isDev && yaRespondio && (
              <div className="border border-warning/40 bg-warning-soft text-warning rounded-lg p-3 mb-6 text-sm font-medium">
                [DEV] El usuario ya respondió este censo. El formulario se muestra solo por estar en
                modo desarrollo.
              </div>
            )}

            <div data-guia-id="censo-cabecera" className="mb-6">
              <PageHeader
                titulo="Censo de Autogestión de Personal"
                descripcion="Oficina de Gestión Humana · CONATEL. Los campos marcados con asterisco (*) son obligatorios."
              />
            </div>

            <Form {...form}>
              <form data-guia-id="censo-preguntas" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
                {preguntasPrincipales.map((pregunta) => {
                  const tipo =
                    typeof pregunta.tipo === "string" ? pregunta.tipo : pregunta.tipo?.nombre;

                  if (tipo === "cerrada" && pregunta.opciones?.length === 1) {
                    return (
                      <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                        <CheckboxForm
                          form={form}
                          nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                          label={`${pregunta.enunciado} *`}
                        />
                      </div>
                    );
                  }

                  if (tipo === "cerrada") {
                    return (
                      <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                        <RadioGroupForm
                          form={form}
                          nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                          label={`${pregunta.enunciado} *`}
                          options={(pregunta.opciones || []).map(
                            (op: Opcion & { texto?: string }) => ({
                              value: String(op.id),
                              label: op.tipo_opcion || op.texto || "",
                            }),
                          )}
                        />
                      </div>
                    );
                  }

                  if (pregunta.id === 1) {
                    return (
                      <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                        <InputForm
                          form={form}
                          nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                          label="Código del Carnet de la Patria *"
                          type="text"
                          inputMode="numeric"
                          placeholder="0000000000"
                        />
                      </div>
                    );
                  }

                  if (tipo === "number" || tipo === "float") {
                    return (
                      <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                        <InputForm
                          form={form}
                          nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                          label={`${pregunta.enunciado} *`}
                          type="number"
                          placeholder="Escriba un número"
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                      <InputForm
                        form={form}
                        nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                        label={`${pregunta.enunciado} *`}
                        type="text"
                        placeholder="Escriba su respuesta"
                      />
                    </div>
                  );
                })}

                <div className="rounded-xl border border-border/60 bg-muted/15 p-5 flex flex-col gap-4">
                  <h2 className="text-lg font-bold text-foreground">Datos de Vivienda *</h2>

                  <div data-guia-id="censo-vivienda" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={"datos_vivienda.estado_id" as FieldPath<DynamicFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(Number(value));
                            setEstadoId(value);
                            form.setValue(
                              "datos_vivienda.municipio_id" as FieldPath<DynamicFormValues>,
                              0,
                            );
                            form.setValue(
                              "datos_vivienda.parroquia" as FieldPath<DynamicFormValues>,
                              0,
                            );
                            form.setValue(
                              "datos_vivienda.codigo_postal_id" as FieldPath<DynamicFormValues>,
                              0,
                            );
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingStates ? "Cargando Estados" : "Seleccione un Estado"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {states?.data?.map((s) => (
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
                    name={"datos_vivienda.municipio_id" as FieldPath<DynamicFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Municipio *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(Number(value));
                            setMunicipioId(value);
                            form.setValue(
                              "datos_vivienda.parroquia" as FieldPath<DynamicFormValues>,
                              0,
                            );
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
                            {municipalitys?.data?.map((m) => (
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
                    name={"datos_vivienda.parroquia" as FieldPath<DynamicFormValues>}
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
                            {parish?.data?.map((p) => (
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
                    name={"datos_vivienda.condicion_vivienda_id" as FieldPath<DynamicFormValues>}
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
                            {conditionDwelling?.data?.map((c) => (
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
                    name={"datos_vivienda.direccion_exacta" as FieldPath<DynamicFormValues>}
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Dirección Exacta *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Calle, Casa, Apartamento, Sector"
                            maxLength={LIMITES_TEXTO.direccion.max}
                            {...field}
                            value={(field.value as string) ?? ""}
                          />
                        </FormControl>
                        <ContadorCaracteres valor={field.value as string} max={LIMITES_TEXTO.direccion.max} />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={"datos_vivienda.codigo_postal_id" as FieldPath<DynamicFormValues>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Postal</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(Number(value));
                          }}
                          value={field.value ? `${field.value}` : undefined}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCodigosPostales
                                    ? "Cargando Códigos Postales"
                                    : "Seleccione un Código Postal"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {codigosPostales?.data?.map((cp) => (
                              <SelectItem key={cp.id} value={`${cp.id}`}>
                                {cp.codigo}
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

                {preguntasDeclaracion.map((pregunta) => (
                  <div key={pregunta.id} className="rounded-xl border border-border/60 bg-muted/15 p-4 transition-colors">
                    <CheckboxForm
                      form={form}
                      nameInput={String(pregunta.id) as FieldPath<DynamicFormValues>}
                      label={`${pregunta.enunciado} *`}
                    />
                  </div>
                ))}

                <p className="text-xs text-muted-foreground text-justify">
                  La información suministrada es estrictamente confidencial y de uso exclusivo
                  interno para los fines institucionales de la Oficina de Gestión Humana.
                </p>

                <Button
                  data-guia-id="censo-enviar"
                  type="submit"
                  disabled={isPending}
                  className="w-full h-11 text-base font-semibold cursor-pointer"
                  size="lg"
                >
                  {isPending ? "Enviando…" : "Enviar autogestión"}
                </Button>
              </form>
            </Form>
          </Card>
        </div>
      )}
    </div>
  );
}
