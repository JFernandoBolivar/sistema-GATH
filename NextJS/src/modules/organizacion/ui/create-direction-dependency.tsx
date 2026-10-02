"use client";

/**
 * Formulario para crear Direcciones Administrativas (Dirección General, División/Línea o Coordinación).
 * Paridad 100% con `create-direction-dependency.tsx` del proyecto legado:
 * - Filtros jerárquicos superiores dinámicos (Nivel, D/O/G, División)
 * - RadioGroup para alternar entre Crear Dirección General, División/Coordinación y Coordinación
 * - Formulario reactivo correspondiente según la opción seleccionada
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox } from "@/shared/ui/components/combobox";

import type {
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
} from "../application/dtos/organizacion-dto";
import {
  crearCoordinacionAction,
  crearDireccionGeneralAction,
  crearDireccionLineaAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import {
  coordinacionSchema,
  direccionGeneralSchema,
  direccionLineaSchema,
  type CoordinacionFormType,
  type DireccionGeneralFormType,
  type DireccionLineaFormType,
} from "./schema/schema-organizacion";

interface CreateDirectionDependencyProps {
  onSuccess?: () => void;
}

export default function CreateDirectionDependency({ onSuccess }: CreateDirectionDependencyProps) {
  const [isPending, startTransition] = useTransition();
  const [createMode, setCreateMode] = useState<string>("create-direction-general");

  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLineas, setDirLineas] = useState<DireccionLineaDTO[]>([]);

  const [dependencyId, setDependencyId] = useState<string>("");
  const [selectionDirectionGeneralId, setSelectionDirectionGeneralId] = useState<string>("");
  const [selectionDirectionLineId, setSelectionDirectionLineId] = useState<string>("");

  const [isLoadingDep, setIsLoadingDep] = useState(true);
  const [isLoadingDG, setIsLoadingDG] = useState(false);
  const [isLoadingDL, setIsLoadingDL] = useState(false);

  // Forms
  const formDG = useForm<DireccionGeneralFormType>({
    resolver: zodResolver(direccionGeneralSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      dependenciaId: null,
    },
  });

  const formDL = useForm<DireccionLineaFormType>({
    resolver: zodResolver(direccionLineaSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      direccionGeneralId: null,
    },
  });

  const formCoord = useForm<CoordinacionFormType>({
    resolver: zodResolver(coordinacionSchema),
    defaultValues: {
      codigo: "",
      nombre: "",
      direccionLineaId: null,
    },
  });

  // Cargar dependencias iniciales
  useEffect(() => {
    getDependenciasAction()
      .then(setDependencias)
      .finally(() => setIsLoadingDep(false));
  }, []);

  // Manejar cambio de Nivel (Dependencia)
  const onSelectDependency = (val: string) => {
    setDependencyId(val);
    setSelectionDirectionGeneralId("");
    setSelectionDirectionLineId("");
    setDirGenerales([]);
    setDirLineas([]);

    const num = val ? Number(val) : null;
    formDG.setValue("dependenciaId", num);

    if (val) {
      setIsLoadingDG(true);
      getDireccionesGeneralesAction(Number(val))
        .then(setDirGenerales)
        .finally(() => setIsLoadingDG(false));
    }
  };

  // Manejar cambio de Dirección General
  const onSelectDirectionGeneral = (val: string) => {
    setSelectionDirectionGeneralId(val);
    setSelectionDirectionLineId("");
    setDirLineas([]);

    const num = val ? Number(val) : null;
    formDL.setValue("direccionGeneralId", num);

    if (val) {
      setIsLoadingDL(true);
      getDireccionesLineaAction(Number(val))
        .then(setDirLineas)
        .finally(() => setIsLoadingDL(false));
    }
  };

  // Manejar cambio de Dirección de Línea
  const onSelectDirectionLine = (val: string) => {
    setSelectionDirectionLineId(val);
    const num = val ? Number(val) : null;
    formCoord.setValue("direccionLineaId", num);
  };

  // Submit Dirección General
  const onSubmitDG = (data: DireccionGeneralFormType) => {
    if (!dependencyId) {
      toast.error("Debe seleccionar un Nivel (Dependencia) antes de crear la Dirección General.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await crearDireccionGeneralAction({
          ...data,
          dependenciaId: Number(dependencyId),
        });
        if ("id" in res) {
          toast.success("Dirección General creada con éxito.");
          formDG.reset({ codigo: "", nombre: "", dependenciaId: Number(dependencyId) });
          // Recargar lista de DG
          getDireccionesGeneralesAction(Number(dependencyId)).then(setDirGenerales);
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al crear la dirección general.");
      }
    });
  };

  // Submit Dirección de Línea
  const onSubmitDL = (data: DireccionLineaFormType) => {
    if (!selectionDirectionGeneralId) {
      toast.error("Debe seleccionar una Dirección / Gerencia / Oficina antes de crear la División.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await crearDireccionLineaAction({
          ...data,
          direccionGeneralId: Number(selectionDirectionGeneralId),
        });
        if ("id" in res) {
          toast.success("Dirección de Línea / División creada con éxito.");
          formDL.reset({ codigo: "", nombre: "", direccionGeneralId: Number(selectionDirectionGeneralId) });
          // Recargar lista de DL
          getDireccionesLineaAction(Number(selectionDirectionGeneralId)).then(setDirLineas);
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al crear la división.");
      }
    });
  };

  // Submit Coordinación
  const onSubmitCoord = (data: CoordinacionFormType) => {
    if (!selectionDirectionLineId) {
      toast.error("Debe seleccionar una División / Coordinación antes de crear la Coordinación.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await crearCoordinacionAction({
          ...data,
          direccionLineaId: Number(selectionDirectionLineId),
        });
        if ("id" in res) {
          toast.success("Coordinación creada con éxito.");
          formCoord.reset({ codigo: "", nombre: "", direccionLineaId: Number(selectionDirectionLineId) });
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al crear la coordinación.");
      }
    });
  };

  return (
    <Card className="bg-white dark:bg-card shadow-sm">
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 w-full gap-4">
            <div
              className={`flex flex-col gap-2 ${
                createMode === "create-direction-general" ? "col-span-1 md:col-span-2" : ""
              }`}
            >
              <Label>Nivel</Label>
              <Combobox
                options={dependencias.map((dp) => ({
                  value: `${dp.id}`,
                  label: dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre,
                }))}
                value={dependencyId}
                onChange={onSelectDependency}
                placeholder={isLoadingDep ? "Cargando Niveles..." : "Seleccionar Nivel"}
                searchPlaceholder="Buscar nivel..."
                disabled={isLoadingDep}
              />
            </div>

            {createMode === "create-direction-line" && (
              <div className="flex flex-col gap-2">
                <Label>Dirección / Gerencia / Oficina</Label>
                <Combobox
                  options={dirGenerales.map((general) => ({
                    value: `${general.id}`,
                    label: general.codigo ? `${general.codigo}-${general.nombre}` : general.nombre,
                  }))}
                  value={selectionDirectionGeneralId}
                  onChange={onSelectDirectionGeneral}
                  placeholder={
                    isLoadingDG
                      ? "Cargando Direcciones..."
                      : "Seleccionar Dirección"
                  }
                  searchPlaceholder="Buscar dirección..."
                  disabled={isLoadingDG || !dependencyId}
                />
              </div>
            )}

            {createMode === "create-coordination" && (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Dirección / Gerencia / Oficina</Label>
                  <Combobox
                    options={dirGenerales.map((general) => ({
                      value: `${general.id}`,
                      label: general.codigo ? `${general.codigo}-${general.nombre}` : general.nombre,
                    }))}
                    value={selectionDirectionGeneralId}
                    onChange={onSelectDirectionGeneral}
                    placeholder={
                      isLoadingDG
                        ? "Cargando Direcciones..."
                        : "Seleccionar Dirección"
                    }
                    searchPlaceholder="Buscar dirección..."
                    disabled={isLoadingDG || !dependencyId}
                  />
                </div>
                <div className="flex flex-col gap-2 col-span-1 md:col-span-2">
                  <Label>División / Coordinación</Label>
                  <Combobox
                    options={dirLineas.map((line) => ({
                      value: `${line.id}`,
                      label: line.codigo ? `${line.codigo}-${line.nombre}` : line.nombre,
                    }))}
                    value={selectionDirectionLineId}
                    onChange={onSelectDirectionLine}
                    placeholder={
                      isLoadingDL
                        ? "Cargando Direcciones..."
                        : "Seleccionar Dirección"
                    }
                    searchPlaceholder="Buscar división o coordinación..."
                    disabled={isLoadingDL || !selectionDirectionGeneralId}
                  />
                </div>
              </>
            )}
          </div>

          <RadioGroup
            value={createMode}
            onValueChange={setCreateMode}
            className="flex flex-wrap gap-6 pt-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                className="cursor-pointer"
                value="create-direction-general"
                id="r1"
              />
              <Label className="cursor-pointer font-normal" htmlFor="r1">
                Crear Dirección / Gerencia / Oficina
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                className="cursor-pointer"
                value="create-direction-line"
                id="r2"
              />
              <Label className="cursor-pointer font-normal" htmlFor="r2">
                Crear División / Coordinación
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                className="cursor-pointer"
                value="create-coordination"
                id="r3"
              />
              <Label className="cursor-pointer font-normal" htmlFor="r3">
                Crear Coordinación
              </Label>
            </div>
          </RadioGroup>
        </div>

        {createMode === "create-direction-general" && (
          <div>
            <Form {...formDG}>
              <form onSubmit={formDG.handleSubmit(onSubmitDG)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <FormField
                    name="codigo"
                    control={formDG.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Codigo de la Dirección / Gerencia / Oficina</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ej. 120" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="nombre"
                    control={formDG.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nombre De La Dirección / Gerencia / Oficina</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej. Gerencia de Planificación" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                      Creando Dirección...
                    </>
                  ) : (
                    "Crear Dirección"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {createMode === "create-direction-line" && (
          <div>
            <Form {...formDL}>
              <form onSubmit={formDL.handleSubmit(onSubmitDL)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <FormField
                    name="codigo"
                    control={formDL.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Código De La División / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ej. 121" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="nombre"
                    control={formDL.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nombre De La División / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej. División de Presupuesto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                      Creando Dirección...
                    </>
                  ) : (
                    "Crear Dirección"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {createMode === "create-coordination" && (
          <div>
            <Form {...formCoord}>
              <form onSubmit={formCoord.handleSubmit(onSubmitCoord)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <FormField
                    name="codigo"
                    control={formCoord.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Código De La Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ej. 1211" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="nombre"
                    control={formCoord.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nombre De La Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej. Coordinación de Control" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                      Creando Dirección...
                    </>
                  ) : (
                    "Crear Dirección"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
