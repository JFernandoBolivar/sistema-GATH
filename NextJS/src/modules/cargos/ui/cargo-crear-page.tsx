"use client";

/**
 * Formulario para crear Códigos de Posición vacantes (/cargos/crear-codigo).
 * Paridad 100% con `codigo-catalog-form.tsx` del proyecto legado:
 * - Denominación de cargo (Combobox con búsqueda)
 * - Denominación de cargo específico (Combobox con búsqueda)
 * - Tipo de nómina (Select)
 * - Grado (Select)
 * - Cascada jerárquica con Switches: Nivel (Dependencia) -> Dirección General -> División -> Coordinación
 * - Botón de crear código con feedback toast y reseteo reactivo
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/shared/ui/components/combobox";
import { Switch } from "@/components/ui/switch";

import type {
  CatalogoCargoItemDTO,
  DenominacionCargoDTO,
  UnidadOrganizativaCargoDTO,
} from "../application/dtos/cargo-dto";
import {
  crearCargoAction,
  getCoordinacionesAction,
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getGradosAction,
  getTiposNominaAction,
} from "../infrastructure/actions/cargos-actions";
import { crearCargoSchema, type CrearCargoFormType } from "./schema/schema-asignar-cargo";

interface CargoCrearPageProps {
  onSuccess?: () => void;
}

export default function CargoCrearPage({ onSuccess }: CargoCrearPageProps) {
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "cargos.crear");
  const [isPending, startTransition] = useTransition();

  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [especificas, setEspecificas] = useState<DenominacionCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [grados, setGrados] = useState<CatalogoCargoItemDTO[]>([]);
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [isLoadingDG, setIsLoadingDG] = useState(false);
  const [isLoadingDL, setIsLoadingDL] = useState(false);
  const [isLoadingCoord, setIsLoadingCoord] = useState(false);

  const [dependencyId, setDependencyId] = useState<string>("");
  const [activeDirectionGeneral, setActiveDirectionGeneral] = useState<boolean>(false);
  const [activeDirectionLine, setActiveDirectionLine] = useState<boolean>(false);
  const [activeCoordination, setActiveCoordination] = useState<boolean>(false);

  const [selectedDirectionGeneralId, setSelectedDirectionGeneralId] = useState<string>("");
  const [selectedDirectionLineId, setSelectedDirectionLineId] = useState<string>("");

  const form = useForm<CrearCargoFormType>({
    resolver: zodResolver(crearCargoSchema),
    defaultValues: {
      denominacionId: undefined,
      especificaId: undefined,
      tipoNominaId: undefined,
      gradoId: undefined,
      dependenciaId: undefined,
      direccionGeneralId: undefined,
      direccionLineaId: undefined,
      coordinacionId: undefined,
    },
  });

  useEffect(() => {
    Promise.all([
      getDenominacionesAction(),
      getDenominacionesEspecificasAction(),
      getTiposNominaAction(),
      getGradosAction(),
      getDependenciasAction(),
    ])
      .then(([denoms, esps, nominas, gradosList, deps]) => {
        setDenominaciones(denoms);
        setEspecificas(esps);
        setTiposNomina(nominas);
        setGrados(gradosList);
        setDependencias(deps);
      })
      .catch(() => {
        toast.error("No fue posible cargar los catálogos.");
      })
      .finally(() => {
        setCargandoCatalogos(false);
      });
  }, []);

  const onSelectDependency = (val: string) => {
    setDependencyId(val);
    setSelectedDirectionGeneralId("");
    setSelectedDirectionLineId("");
    setDireccionesGenerales([]);
    setDireccionesLinea([]);
    setCoordinaciones([]);

    const num = val ? Number(val) : undefined;
    form.setValue("dependenciaId", num);
    form.setValue("direccionGeneralId", undefined);
    form.setValue("direccionLineaId", undefined);
    form.setValue("coordinacionId", undefined);

    if (val) {
      setIsLoadingDG(true);
      getDireccionesGeneralesAction(Number(val))
        .then(setDireccionesGenerales)
        .finally(() => setIsLoadingDG(false));
    }
  };

  const onSelectDirectionGeneral = (val: string) => {
    setSelectedDirectionGeneralId(val);
    setSelectedDirectionLineId("");
    setDireccionesLinea([]);
    setCoordinaciones([]);

    const num = val ? Number(val) : undefined;
    form.setValue("direccionGeneralId", num);
    form.setValue("direccionLineaId", undefined);
    form.setValue("coordinacionId", undefined);

    if (val) {
      setIsLoadingDL(true);
      getDireccionesLineaAction(Number(val))
        .then(setDireccionesLinea)
        .finally(() => setIsLoadingDL(false));
    }
  };

  const onSelectDirectionLine = (val: string) => {
    setSelectedDirectionLineId(val);
    setCoordinaciones([]);

    const num = val ? Number(val) : undefined;
    form.setValue("direccionLineaId", num);
    form.setValue("coordinacionId", undefined);

    if (val) {
      setIsLoadingCoord(true);
      getCoordinacionesAction(Number(val))
        .then(setCoordinaciones)
        .finally(() => setIsLoadingCoord(false));
    }
  };

  const onToggleDirectionGeneral = (bool: boolean) => {
    setActiveDirectionGeneral(bool);
    if (!bool) {
      form.setValue("direccionGeneralId", undefined);
      form.setValue("direccionLineaId", undefined);
      form.setValue("coordinacionId", undefined);
      setSelectedDirectionGeneralId("");
      setSelectedDirectionLineId("");
      setDireccionesLinea([]);
      setCoordinaciones([]);
      setActiveDirectionLine(false);
      setActiveCoordination(false);
    }
  };

  const onToggleDirectionLine = (bool: boolean) => {
    setActiveDirectionLine(bool);
    if (!bool) {
      form.setValue("direccionLineaId", undefined);
      form.setValue("coordinacionId", undefined);
      setSelectedDirectionLineId("");
      setCoordinaciones([]);
      setActiveCoordination(false);
    }
  };

  const onToggleCoordination = (bool: boolean) => {
    setActiveCoordination(bool);
    if (!bool) {
      form.setValue("coordinacionId", undefined);
    }
  };

  const onSubmit = (data: CrearCargoFormType) => {
    if (activeDirectionGeneral && !selectedDirectionGeneralId) {
      toast.error("Debe seleccionar una Dirección / Gerencia / Oficina.");
      return;
    }
    if (activeDirectionLine && !selectedDirectionLineId) {
      toast.error("Debe seleccionar una División / Coordinación.");
      return;
    }
    if (activeCoordination && !data.coordinacionId) {
      toast.error("Debe seleccionar una Coordinación.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          ...data,
          dependenciaId: dependencyId ? Number(dependencyId) : undefined,
          direccionGeneralId: activeDirectionGeneral && selectedDirectionGeneralId ? Number(selectedDirectionGeneralId) : undefined,
          direccionLineaId: activeDirectionLine && selectedDirectionLineId ? Number(selectedDirectionLineId) : undefined,
          coordinacionId: activeCoordination && data.coordinacionId ? Number(data.coordinacionId) : undefined,
        };

        const result = await crearCargoAction(payload);
        if (result && typeof result === "object" && "error" in result) {
          toast.error((result as { error: string }).error);
          return;
        }

        toast.success("Código de posición creado con éxito.");
        form.reset({
          denominacionId: undefined,
          especificaId: undefined,
          tipoNominaId: undefined,
          gradoId: undefined,
          dependenciaId: undefined,
          direccionGeneralId: undefined,
          direccionLineaId: undefined,
          coordinacionId: undefined,
        });
        setDependencyId("");
        setSelectedDirectionGeneralId("");
        setSelectedDirectionLineId("");
        setActiveDirectionGeneral(false);
        setActiveDirectionLine(false);
        setActiveCoordination(false);
        setDireccionesGenerales([]);
        setDireccionesLinea([]);
        setCoordinaciones([]);
        onSuccess?.();
      } catch {
        toast.error("Ocurrió un error al enviar la información.");
      }
    });
  };

  if (!puedeCrear) {
    return (
      <Card className="max-w-3xl bg-white dark:bg-card shadow-sm mt-4">
        <CardContent className="py-6">
          <p className="text-sm font-medium text-destructive">
            No tiene permisos para crear códigos de posición (requiere permiso cargos.crear).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-card shadow-sm mt-4">
      <CardHeader>
        <CardTitle>Registrar Código de Posición</CardTitle>
        <CardDescription>
          Ingrese los datos del nuevo código y sus atributos asociados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cargandoCatalogos ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 items-baseline gap-6 place-content-center">
                {/* Denominación De Cargo */}
                <FormField
                  control={form.control}
                  name="denominacionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Denominación De Cargo</FormLabel>
                      <FormControl>
                        <Combobox
                          options={denominaciones.map((cargo) => ({
                            value: `${cargo.id}`,
                            label: cargo.nombre,
                          }))}
                          value={field.value ? `${field.value}` : ""}
                          onChange={(val) => field.onChange(Number.parseInt(val))}
                          placeholder="Seleccione una Denominación De Cargo"
                          searchPlaceholder="Buscar cargo..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Denominación De Cargo Específico */}
                <FormField
                  control={form.control}
                  name="especificaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Denominación De Cargo Específico</FormLabel>
                      <FormControl>
                        <Combobox
                          options={especificas.map((cargo) => ({
                            value: `${cargo.id}`,
                            label: cargo.nombre,
                          }))}
                          value={field.value ? `${field.value}` : ""}
                          onChange={(val) => field.onChange(Number.parseInt(val))}
                          placeholder="Seleccione una Denominación De Cargo Específico"
                          searchPlaceholder="Buscar cargo especifico..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de Nomina */}
                <FormField
                  control={form.control}
                  name="tipoNominaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Nomina</FormLabel>
                      <Select
                        value={field.value ? `${field.value}` : undefined}
                        onValueChange={(val) => field.onChange(Number.parseInt(val))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue placeholder="Seleccione un Tipo de Nómina" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tiposNomina.map((nomina) => (
                            <SelectItem key={nomina.id} value={`${nomina.id}`}>
                              {nomina.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Grado */}
                <FormField
                  control={form.control}
                  name="gradoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado</FormLabel>
                      <Select
                        value={field.value ? `${field.value}` : undefined}
                        onValueChange={(val) => field.onChange(Number.parseInt(val))}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue placeholder="Seleccione un Grado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grados.map((grado) => (
                            <SelectItem key={grado.id} value={`${grado.id}`}>
                              {grado.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nivel (Dependencia) */}
                <FormField
                  name="dependenciaId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem
                      className={!activeDirectionGeneral ? "col-span-1 md:col-span-2" : "truncate"}
                    >
                      <FormLabel>Nivel</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? String(field.value) : undefined}
                          onValueChange={(val) => {
                            field.onChange(Number(val));
                            onSelectDependency(val);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar Nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Nivel</SelectLabel>
                              {dependencias.map((dp) => (
                                <SelectItem key={dp.id} value={`${dp.id}`}>
                                  {dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        <div className="flex flex-row items-center text-left gap-2 justify-center pt-1">
                          ¿Desea Agregarle Una Dirección / Gerencia / Oficina?
                          <Switch
                            checked={activeDirectionGeneral}
                            disabled={!dependencyId}
                            onCheckedChange={onToggleDirectionGeneral}
                          />
                        </div>
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* Dirección / Gerencia / Oficina */}
                {activeDirectionGeneral && (
                  <FormField
                    control={form.control}
                    name="direccionGeneralId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : undefined}
                          onValueChange={(val) => {
                            field.onChange(Number(val));
                            onSelectDirectionGeneral(val);
                          }}
                          disabled={isLoadingDG || direccionesGenerales.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingDG
                                    ? "Cargando Direcciones..."
                                    : direccionesGenerales.length === 0
                                    ? "No posee direcciones"
                                    : "Seleccione una Dirección"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {direccionesGenerales.map((general) => (
                              <SelectItem key={general.id} value={`${general.id}`}>
                                {general.codigo ? `${general.codigo}-` : ""}{general.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          <div className="flex flex-row items-center text-left gap-2 justify-center pt-1">
                            ¿Desea Agregarle Una División / Coordinación?
                            <Switch
                              checked={activeDirectionLine}
                              disabled={!selectedDirectionGeneralId}
                              onCheckedChange={onToggleDirectionLine}
                            />
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* División / Coordinación */}
                {activeDirectionLine && (
                  <>
                    <FormField
                      control={form.control}
                      name="direccionLineaId"
                      render={({ field }) => (
                        <FormItem
                          className={activeCoordination ? "" : "col-span-1 md:col-span-2"}
                        >
                          <FormLabel>División / Coordinación</FormLabel>
                          <Select
                            value={field.value ? String(field.value) : undefined}
                            onValueChange={(val) => {
                              field.onChange(Number(val));
                              onSelectDirectionLine(val);
                            }}
                            disabled={isLoadingDL || direccionesLinea.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingDL
                                      ? "Cargando Direcciones..."
                                      : direccionesLinea.length === 0
                                      ? "No posee divisiones"
                                      : "Seleccione una Dirección"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {direccionesLinea.map((line) => (
                                <SelectItem key={line.id} value={`${line.id}`}>
                                  {line.codigo ? `${line.codigo}-` : ""}{line.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            <div className="flex flex-row items-center text-left justify-center gap-2 pt-1">
                              ¿Desea Agregarle Una Coordinación?
                              <Switch
                                checked={activeCoordination}
                                disabled={!selectedDirectionLineId}
                                onCheckedChange={onToggleCoordination}
                              />
                            </div>
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Coordinación */}
                    {activeCoordination && (
                      <FormField
                        control={form.control}
                        name="coordinacionId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Coordinación</FormLabel>
                            <Select
                              value={field.value ? `${field.value}` : undefined}
                              onValueChange={(val) => field.onChange(Number.parseInt(val))}
                              disabled={isLoadingCoord || coordinaciones.length === 0}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={
                                      isLoadingCoord
                                        ? "Cargando Coordinaciones..."
                                        : coordinaciones.length === 0
                                        ? "No posee coordinaciones"
                                        : "Seleccione una Coordinación"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {coordinaciones.map((coord) => (
                                  <SelectItem key={coord.id} value={`${coord.id}`}>
                                    {coord.codigo ? `${coord.codigo}-` : ""}{coord.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                      Creando Nuevo Código…
                    </>
                  ) : (
                    "Crear Nuevo Código"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
