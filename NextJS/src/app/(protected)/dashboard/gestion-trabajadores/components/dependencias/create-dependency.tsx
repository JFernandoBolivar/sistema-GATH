"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { CreateDependencyAction } from "../../ubicacion-administrativa/crear-ubicacion/actions/create-dependencys";
import {
  schemaCreateDependency,
  schemaCreateDirectionAdm,
} from "../../ubicacion-administrativa/crear-ubicacion/schema/schemaCreateDependency";
import { Button } from "../../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../../components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";
import { Input } from "../../../../../../components/ui/input";
import { Switch } from "../../../../../../components/ui/switch";
export default function CreateUbication() {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schemaCreateDirectionAdm),
    defaultValues: {
      dependency: {
        Codigo: "",
        dependencia: "",
      },
      direction_general: {
        Codigo: "",
        direccion_general: "",
      },
      direction_line: {
        Codigo: "",
        direccion_linea: "",
      },
      coordination: {
        Codigo: "",
        coordinacion: "",
      },
      activeCoordination: false,
      activeDirectionLine: false,
      activeDirectionGeneral: false,
    },
  });
  const onSubmit = (data: z.infer<typeof schemaCreateDirectionAdm>) => {
    startTransition(async () => {
      const response = await CreateDependencyAction(data);
      if (response.success) {
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
    });
  };
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
  return (
    <>
      <Card className="text-black">
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 ">
              <div className="grid grid-cols-2  place-content-stretch place-items-start gap-3 w-full ">
                <FormField
                  name="dependency.Codigo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="w-full truncate p-0.5">
                      <FormLabel>Código De La Dependencia</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="dependency.dependencia"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="w-full truncate p-0.5">
                      <FormLabel>Nombre De La Dependencia</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex flex-row gap-2 items-center justify-end">
                <FormField
                  control={form.control}
                  name="activeDirectionGeneral"
                  render={({ field }) => (
                    <FormItem className="flex flex-row">
                      <FormLabel>
                        ¿Desea Asignarle una Dirección General a la Dependencia?
                      </FormLabel>
                      <FormControl>
                        <Switch onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {activeDirectionGeneral && (
                <>
                  <div className="grid grid-cols-2  place-content-stretch place-items-start gap-3 w-full ">
                    <FormField
                      name="direction_general.Codigo"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="w-full truncate p-0.5">
                          <FormLabel>
                            Código De La D / O / G / Coordinación
                          </FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="direction_general.direccion_general"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="w-full truncate p-0.5">
                          <FormLabel>
                            Nombre De La Dirección General / Coordinación
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex flex-row gap-2 items-center justify-end">
                    <FormField
                      control={form.control}
                      name="activeDirectionLine"
                      render={({ field }) => (
                        <FormItem className="flex flex-row">
                          <FormLabel>
                            ¿Desea Asignarle una Dirección De Linea A La D / O /
                            G?
                          </FormLabel>
                          <FormControl>
                            <Switch onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              {activeDirectionLine && activeDirectionGeneral && (
                <>
                  <div className="grid grid-cols-2  place-content-stretch place-items-start gap-3 w-full ">
                    <FormField
                      name="direction_line.Codigo"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="w-full truncate p-0.5">
                          <FormLabel>
                            Código De La División / Coordinación
                          </FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="direction_line.direccion_linea"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="w-full truncate p-0.5">
                          <FormLabel>
                            Nombre De La División / Coordinación
                          </FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex flex-row gap-2 items-center justify-end">
                    <FormField
                      control={form.control}
                      name="activeCoordination"
                      render={({ field }) => (
                        <FormItem className="flex flex-row">
                          <FormLabel>
                            ¿Desea Asignarle una Coordinación A La Dirección De
                            Linea?
                          </FormLabel>
                          <FormControl>
                            <Switch onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
              {activeCoordination &&
                activeDirectionLine &&
                activeDirectionGeneral && (
                  <>
                    <div className="grid grid-cols-2  place-content-stretch place-items-start gap-3 w-full ">
                      <FormField
                        name="coordination.Codigo"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem className="w-full truncate p-0.5">
                            <FormLabel>Código De La Coordinación</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name="coordination.coordinacion"
                        control={form.control}
                        render={({ field }) => (
                          <FormItem className="w-full truncate p-0.5">
                            <FormLabel>Nombre De La Coordinación</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              <Button className="w-full" disabled={isPending}>
                {" "}
                {isPending ? "Creando Depedencia" : "Crear Dependencia"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
