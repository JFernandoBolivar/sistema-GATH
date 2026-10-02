"use client";

/**
 * Vista para Actualizar Información De Dependencias.
 * Paridad 100% con `actualizar-ubicacion/page.tsx` del proyecto legado:
 * - Pestañas: Dirección / Gerencia / Oficina, División / Coordinación, Coordinación, y Dependencia
 * - Cascadas de Comboboxes para seleccionar la unidad a editar
 * - Inputs pre-rellenados con el código y nombre actual para edición
 * - Botón "Actualizar" con feedback y toasts
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/shared/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import { Combobox } from "@/shared/ui/components/combobox";

import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
} from "../application/dtos/organizacion-dto";
import {
  actualizarCoordinacionAction,
  actualizarDependenciaAction,
  actualizarDireccionGeneralAction,
  actualizarDireccionLineaAction,
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import {
  updateCoordinacionSchema,
  updateDependenciaSchema,
  updateDireccionGeneralSchema,
  updateDireccionLineaSchema,
  type UpdateCoordinacionFormType,
  type UpdateDependenciaFormType,
  type UpdateDireccionGeneralFormType,
  type UpdateDireccionLineaFormType,
} from "./schema/schema-organizacion";

interface ActualizarUbicacionViewProps {
  onUpdated?: () => void;
}

export default function ActualizarUbicacionView({ onUpdated }: ActualizarUbicacionViewProps) {
  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);

  const cargarDependencias = () => {
    getDependenciasAction().then(setDependencias);
  };

  useEffect(() => {
    cargarDependencias();
  }, []);

  return (
    <Tabs defaultValue="direccion-general/coord" className="w-full">
      <TabsList className="flex flex-wrap gap-1 mb-4">
        <TabsTrigger value="direccion-general/coord">
          Dirección / Gerencia / Oficina
        </TabsTrigger>
        <TabsTrigger value="direccion-linea/coord">
          División / Coordinación
        </TabsTrigger>
        <TabsTrigger value="coord">Coordinación</TabsTrigger>
        <TabsTrigger value="dependencia">Dependencia</TabsTrigger>
      </TabsList>

      <TabsContent value="direccion-general/coord">
        <Card className="bg-white dark:bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Actualizar Dirección / Gerencia / Oficina</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateDireccionGeneralSection
              dependencias={dependencias}
              onSuccess={onUpdated}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="direccion-linea/coord">
        <Card className="bg-white dark:bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Actualizar División / Coordinación</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateDireccionLineaSection
              dependencias={dependencias}
              onSuccess={onUpdated}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="coord">
        <Card className="bg-white dark:bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Actualizar Coordinación</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateCoordinacionSection
              dependencias={dependencias}
              onSuccess={onUpdated}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="dependencia">
        <Card className="bg-white dark:bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Actualizar Dependencia</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateDependenciaSection
              dependencias={dependencias}
              onSuccess={() => {
                cargarDependencias();
                onUpdated?.();
              }}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------
// Sub-sección 1: Actualizar Dirección General
// ---------------------------------------------------------
function UpdateDireccionGeneralSection({
  dependencias,
  onSuccess,
}: {
  dependencias: DependenciaDTO[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [isLoadingDG, setIsLoadingDG] = useState(false);

  const form = useForm<UpdateDireccionGeneralFormType>({
    resolver: zodResolver(updateDireccionGeneralSchema),
    defaultValues: {
      id: 0,
      dependenciaId: 0,
      codigo: "",
      nombre: "",
    },
  });

  const onSelectNivel = (val: string) => {
    const num = Number(val);
    form.setValue("dependenciaId", num);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setDirGenerales([]);

    if (num) {
      setIsLoadingDG(true);
      getDireccionesGeneralesAction(num)
        .then(setDirGenerales)
        .finally(() => setIsLoadingDG(false));
    }
  };

  const onSelectDG = (val: string) => {
    const num = Number(val);
    form.setValue("id", num);
    const found = dirGenerales.find((d) => d.id === num);
    if (found) {
      form.setValue("codigo", found.codigo ?? "");
      form.setValue("nombre", found.nombre);
    }
  };

  const onSubmit = (values: UpdateDireccionGeneralFormType) => {
    startTransition(async () => {
      try {
        const res = await actualizarDireccionGeneralAction(values.id, {
          codigo: values.codigo,
          nombre: values.nombre,
          dependenciaId: values.dependenciaId,
        });
        if ("id" in res) {
          toast.success("Dirección General actualizada exitosamente.");
          // Refrescar DG
          getDireccionesGeneralesAction(values.dependenciaId).then(setDirGenerales);
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al actualizar.");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="dependenciaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nivel</FormLabel>
              <FormControl>
                <Combobox
                  options={dependencias.map((dp) => ({
                    value: `${dp.id}`,
                    label: dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectNivel(val);
                  }}
                  placeholder="Seleccione un Nivel"
                  searchPlaceholder="Buscar nivel..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
              <FormControl>
                <Combobox
                  options={dirGenerales.map((dg) => ({
                    value: `${dg.id}`,
                    label: dg.codigo ? `${dg.codigo}-${dg.nombre}` : dg.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectDG(val);
                  }}
                  placeholder={
                    isLoadingDG
                      ? "Cargando Direcciones Generales..."
                      : "Seleccione una D / O / G"
                  }
                  searchPlaceholder="Buscar dirección..."
                  disabled={isLoadingDG || !form.watch("dependenciaId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codigo</FormLabel>
              <FormControl>
                <Input {...field} type="number" placeholder="Ej. 00000000000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuevo nombre de la Dirección / Gerencia / Oficina</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. Dirección ....." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            "Actualizar"
          )}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------
// Sub-sección 2: Actualizar División / Coordinación (Dirección de Línea)
// ---------------------------------------------------------
function UpdateDireccionLineaSection({
  dependencias,
  onSuccess,
}: {
  dependencias: DependenciaDTO[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLineas, setDirLineas] = useState<DireccionLineaDTO[]>([]);
  const [isLoadingDG, setIsLoadingDG] = useState(false);
  const [isLoadingDL, setIsLoadingDL] = useState(false);

  const form = useForm<UpdateDireccionLineaFormType>({
    resolver: zodResolver(updateDireccionLineaSchema),
    defaultValues: {
      id: 0,
      dependenciaId: 0,
      direccionGeneralId: 0,
      codigo: "",
      nombre: "",
    },
  });

  const onSelectNivel = (val: string) => {
    const num = Number(val);
    form.setValue("dependenciaId", num);
    form.setValue("direccionGeneralId", 0);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setDirGenerales([]);
    setDirLineas([]);

    if (num) {
      setIsLoadingDG(true);
      getDireccionesGeneralesAction(num)
        .then(setDirGenerales)
        .finally(() => setIsLoadingDG(false));
    }
  };

  const onSelectDG = (val: string) => {
    const num = Number(val);
    form.setValue("direccionGeneralId", num);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setDirLineas([]);

    if (num) {
      setIsLoadingDL(true);
      getDireccionesLineaAction(num)
        .then(setDirLineas)
        .finally(() => setIsLoadingDL(false));
    }
  };

  const onSelectDL = (val: string) => {
    const num = Number(val);
    form.setValue("id", num);
    const found = dirLineas.find((d) => d.id === num);
    if (found) {
      form.setValue("codigo", found.codigo ?? "");
      form.setValue("nombre", found.nombre);
    }
  };

  const onSubmit = (values: UpdateDireccionLineaFormType) => {
    startTransition(async () => {
      try {
        const res = await actualizarDireccionLineaAction(values.id, {
          codigo: values.codigo,
          nombre: values.nombre,
          direccionGeneralId: values.direccionGeneralId,
        });
        if ("id" in res) {
          toast.success("División / Coordinación actualizada exitosamente.");
          // Refrescar DL
          getDireccionesLineaAction(values.direccionGeneralId).then(setDirLineas);
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al actualizar.");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="dependenciaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nivel</FormLabel>
              <FormControl>
                <Combobox
                  options={dependencias.map((dp) => ({
                    value: `${dp.id}`,
                    label: dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectNivel(val);
                  }}
                  placeholder="Seleccione un Nivel"
                  searchPlaceholder="Buscar nivel..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="direccionGeneralId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
              <FormControl>
                <Combobox
                  options={dirGenerales.map((dg) => ({
                    value: `${dg.id}`,
                    label: dg.codigo ? `${dg.codigo}-${dg.nombre}` : dg.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectDG(val);
                  }}
                  placeholder={
                    isLoadingDG
                      ? "Cargando Direcciones Generales..."
                      : "Seleccione una Dirección"
                  }
                  searchPlaceholder="Buscar dirección..."
                  disabled={isLoadingDG || !form.watch("dependenciaId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>División / Coordinación</FormLabel>
              <FormControl>
                <Combobox
                  options={dirLineas.map((dl) => ({
                    value: `${dl.id}`,
                    label: dl.codigo ? `${dl.codigo}-${dl.nombre}` : dl.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectDL(val);
                  }}
                  placeholder={
                    isLoadingDL
                      ? "Cargando División / Coordinación..."
                      : "Seleccione una División / Coordinación"
                  }
                  searchPlaceholder="Buscar división o coordinación..."
                  disabled={isLoadingDL || !form.watch("direccionGeneralId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codigo</FormLabel>
              <FormControl>
                <Input {...field} type="number" placeholder="Ej. 00000000000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuevo nombre de la División / Coordinación</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. Dirección ....." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            "Actualizar"
          )}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------
// Sub-sección 3: Actualizar Coordinación
// ---------------------------------------------------------
function UpdateCoordinacionSection({
  dependencias,
  onSuccess,
}: {
  dependencias: DependenciaDTO[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLineas, setDirLineas] = useState<DireccionLineaDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<CoordinacionDTO[]>([]);
  const [isLoadingDG, setIsLoadingDG] = useState(false);
  const [isLoadingDL, setIsLoadingDL] = useState(false);
  const [isLoadingCoord, setIsLoadingCoord] = useState(false);

  const form = useForm<UpdateCoordinacionFormType>({
    resolver: zodResolver(updateCoordinacionSchema),
    defaultValues: {
      id: 0,
      dependenciaId: 0,
      direccionGeneralId: 0,
      direccionLineaId: 0,
      codigo: "",
      nombre: "",
    },
  });

  const onSelectNivel = (val: string) => {
    const num = Number(val);
    form.setValue("dependenciaId", num);
    form.setValue("direccionGeneralId", 0);
    form.setValue("direccionLineaId", 0);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setDirGenerales([]);
    setDirLineas([]);
    setCoordinaciones([]);

    if (num) {
      setIsLoadingDG(true);
      getDireccionesGeneralesAction(num)
        .then(setDirGenerales)
        .finally(() => setIsLoadingDG(false));
    }
  };

  const onSelectDG = (val: string) => {
    const num = Number(val);
    form.setValue("direccionGeneralId", num);
    form.setValue("direccionLineaId", 0);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setDirLineas([]);
    setCoordinaciones([]);

    if (num) {
      setIsLoadingDL(true);
      getDireccionesLineaAction(num)
        .then(setDirLineas)
        .finally(() => setIsLoadingDL(false));
    }
  };

  const onSelectDL = (val: string) => {
    const num = Number(val);
    form.setValue("direccionLineaId", num);
    form.setValue("id", 0);
    form.setValue("codigo", "");
    form.setValue("nombre", "");
    setCoordinaciones([]);

    if (num) {
      setIsLoadingCoord(true);
      getCoordinacionesAction(num)
        .then(setCoordinaciones)
        .finally(() => setIsLoadingCoord(false));
    }
  };

  const onSelectCoord = (val: string) => {
    const num = Number(val);
    form.setValue("id", num);
    const found = coordinaciones.find((c) => c.id === num);
    if (found) {
      form.setValue("codigo", found.codigo ?? "");
      form.setValue("nombre", found.nombre);
    }
  };

  const onSubmit = (values: UpdateCoordinacionFormType) => {
    startTransition(async () => {
      try {
        const res = await actualizarCoordinacionAction(values.id, {
          codigo: values.codigo,
          nombre: values.nombre,
          direccionLineaId: values.direccionLineaId,
        });
        if ("id" in res) {
          toast.success("Coordinación actualizada exitosamente.");
          // Refrescar coordinaciones
          getCoordinacionesAction(values.direccionLineaId).then(setCoordinaciones);
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al actualizar.");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="dependenciaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nivel</FormLabel>
              <FormControl>
                <Combobox
                  options={dependencias.map((dp) => ({
                    value: `${dp.id}`,
                    label: dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectNivel(val);
                  }}
                  placeholder="Seleccione un Nivel"
                  searchPlaceholder="Buscar nivel..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="direccionGeneralId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
              <FormControl>
                <Combobox
                  options={dirGenerales.map((dg) => ({
                    value: `${dg.id}`,
                    label: dg.codigo ? `${dg.codigo}-${dg.nombre}` : dg.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectDG(val);
                  }}
                  placeholder={
                    isLoadingDG
                      ? "Cargando Direcciones Generales..."
                      : "Seleccione una D / O / G"
                  }
                  searchPlaceholder="Buscar dirección..."
                  disabled={isLoadingDG || !form.watch("dependenciaId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="direccionLineaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>División / Coordinación</FormLabel>
              <FormControl>
                <Combobox
                  options={dirLineas.map((dl) => ({
                    value: `${dl.id}`,
                    label: dl.codigo ? `${dl.codigo}-${dl.nombre}` : dl.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectDL(val);
                  }}
                  placeholder={
                    isLoadingDL
                      ? "Cargando División / Coordinación..."
                      : "Seleccione una División / Coordinación"
                  }
                  searchPlaceholder="Buscar división o coordinación..."
                  disabled={isLoadingDL || !form.watch("direccionGeneralId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Coordinación</FormLabel>
              <FormControl>
                <Combobox
                  options={coordinaciones.map((c) => ({
                    value: `${c.id}`,
                    label: c.codigo ? `${c.codigo}-${c.nombre}` : c.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectCoord(val);
                  }}
                  placeholder={
                    isLoadingCoord
                      ? "Cargando Coordinaciones..."
                      : "Seleccione una Coordinación"
                  }
                  searchPlaceholder="Buscar coordinación..."
                  disabled={isLoadingCoord || !form.watch("direccionLineaId")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codigo</FormLabel>
              <FormControl>
                <Input {...field} type="number" placeholder="Ej. 00000000000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuevo nombre de la coordinación</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. D / O / G....." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            "Actualizar"
          )}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------
// Sub-sección 4: Actualizar Dependencia
// ---------------------------------------------------------
function UpdateDependenciaSection({
  dependencias,
  onSuccess,
}: {
  dependencias: DependenciaDTO[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateDependenciaFormType>({
    resolver: zodResolver(updateDependenciaSchema),
    defaultValues: {
      id: 0,
      codigo: "",
      nombre: "",
    },
  });

  const onSelectNivel = (val: string) => {
    const num = Number(val);
    form.setValue("id", num);
    const found = dependencias.find((d) => d.id === num);
    if (found) {
      form.setValue("codigo", found.codigo ?? "");
      form.setValue("nombre", found.nombre);
    }
  };

  const onSubmit = (values: UpdateDependenciaFormType) => {
    startTransition(async () => {
      try {
        const res = await actualizarDependenciaAction(values.id, {
          codigo: values.codigo,
          nombre: values.nombre,
        });
        if ("id" in res) {
          toast.success("Dependencia actualizada exitosamente.");
          onSuccess?.();
        } else if ("error" in res) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Ocurrió un error al actualizar.");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nivel</FormLabel>
              <FormControl>
                <Combobox
                  options={dependencias.map((dp) => ({
                    value: `${dp.id}`,
                    label: dp.codigo ? `${dp.codigo}-${dp.nombre}` : dp.nombre,
                  }))}
                  value={field.value ? `${field.value}` : ""}
                  onChange={(val) => {
                    field.onChange(Number(val));
                    onSelectNivel(val);
                  }}
                  placeholder="Seleccione un Nivel"
                  searchPlaceholder="Buscar nivel..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codigo</FormLabel>
              <FormControl>
                <Input {...field} type="number" placeholder="Ej. 00000000000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuevo nombre de la dependencia</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. Ministerio....." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            "Actualizar"
          )}
        </Button>
      </form>
    </Form>
  );
}
