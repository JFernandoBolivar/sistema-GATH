"use client";

/**
 * Formulario para crear una ubicación administrativa (dependencia) con opción de
 * crear en cascada sus niveles subordinados (Dirección General, Dirección de Línea, Coordinación).
 * Paridad 100% con `create-dependency.tsx` del proyecto legado.
 */
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";

import {
  hierarchyDependencySchema,
  type HierarchyDependencyFormType,
} from "./schema/schema-organizacion";
import { crearJerarquiaDependenciaAction } from "../infrastructure/actions/organizacion-actions";

interface CreateDependencyProps {
  onSuccess?: () => void;
}

export default function CreateDependency({ onSuccess }: CreateDependencyProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<HierarchyDependencyFormType>({
    resolver: zodResolver(hierarchyDependencySchema),
    defaultValues: {
      dependency: {
        codigo: "",
        nombre: "",
      },
      direction_general: {
        codigo: "",
        nombre: "",
      },
      direction_line: {
        codigo: "",
        nombre: "",
      },
      coordination: {
        codigo: "",
        nombre: "",
      },
      activeDirectionGeneral: false,
      activeDirectionLine: false,
      activeCoordination: false,
    },
  });

  const activeDirectionGeneral = useWatch({
    control: form.control,
    name: "activeDirectionGeneral",
  });

  const activeDirectionLine = useWatch({
    control: form.control,
    name: "activeDirectionLine",
  });

  const activeCoordination = useWatch({
    control: form.control,
    name: "activeCoordination",
  });

  const onSubmit = (data: HierarchyDependencyFormType) => {
    startTransition(async () => {
      try {
        const response = await crearJerarquiaDependenciaAction(data);
        if ("success" in response && response.success) {
          toast.success(response.message ?? "Dependencia creada con éxito.");
          form.reset({
            dependency: { codigo: "", nombre: "" },
            direction_general: { codigo: "", nombre: "" },
            direction_line: { codigo: "", nombre: "" },
            coordination: { codigo: "", nombre: "" },
            activeDirectionGeneral: false,
            activeDirectionLine: false,
            activeCoordination: false,
          });
          onSuccess?.();
        } else if ("error" in response) {
          toast.error(response.error ?? "Ocurrió un error al crear la dependencia.");
        }
      } catch {
        toast.error("Ocurrió un error inesperado al procesar la solicitud.");
      }
    });
  };

  return (
    <Card className="text-black dark:text-white bg-white dark:bg-card shadow-sm">
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <FormField
                name="dependency.codigo"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Código De La Dependencia</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="Ej. 100" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="dependency.nombre"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormLabel>Nombre De La Dependencia</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej. Dirección General" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-row items-center justify-end gap-3 pt-2">
              <FormField
                control={form.control}
                name="activeDirectionGeneral"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormLabel className="cursor-pointer">
                      ¿Desea Asignarle una Dirección General a la Dependencia?
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {activeDirectionGeneral && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4 rounded-lg bg-muted/40 border border-muted">
                  <FormField
                    name="direction_general.codigo"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Código De La D / O / G / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ej. 110" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="direction_general.nombre"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nombre De La Dirección General / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej. Oficina de Gestión Humana" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-row items-center justify-end gap-3">
                  <FormField
                    control={form.control}
                    name="activeDirectionLine"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormLabel className="cursor-pointer">
                          ¿Desea Asignarle una Dirección De Linea A La D / O / G?
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {activeDirectionLine && activeDirectionGeneral && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4 rounded-lg bg-muted/40 border border-muted">
                  <FormField
                    name="direction_line.codigo"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Código De La División / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="Ej. 111" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="direction_line.nombre"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Nombre De La División / Coordinación</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej. División de Nómina" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-row items-center justify-end gap-3">
                  <FormField
                    control={form.control}
                    name="activeCoordination"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2 space-y-0">
                        <FormLabel className="cursor-pointer">
                          ¿Desea Asignarle una Coordinación A La Dirección De Linea?
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {activeCoordination && activeDirectionLine && activeDirectionGeneral && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4 rounded-lg bg-muted/40 border border-muted">
                <FormField
                  name="coordination.codigo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Código De La Coordinación</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" placeholder="Ej. 1111" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="coordination.nombre"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Nombre De La Coordinación</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej. Coordinación de Pagos" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-4" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                  Creando Depedencia
                </>
              ) : (
                "Crear Dependencia"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
