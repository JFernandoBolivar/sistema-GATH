"use client";
import {
  getCargo,
  getCargoEspecifico,
  getNominaPasivo,
  getOrganismosAds,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";
import { Spinner } from "../../../../../../components/ui/spinner";
import Loading from "../../../gestion-trabajadores/components/loading/loading";
import { createCodePasiveAction } from "../../cargos/crear-codigo/actions/createPasiveCode";
import { schemaCodePasive } from "../../cargos/crear-codigo/schemas/schemaCode";

interface CodigoCatalogFormProps {
  onSuccess?: (bool: boolean) => true | false;
}

export function CodigoCatalogForm({ onSuccess }: CodigoCatalogFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(schemaCodePasive),
    defaultValues: {
      codigo: "",
      denominacioncargoespecificoid: 0,
      denominacioncargoid: 0,
      gradoid: 0,
      tiponominaid: 0,
      OrganismoAdscritoid: 0,
    },
  });
  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAds(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR(
    "cargo",
    async () => await getCargo(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaPasivo",
    async () => await getNominaPasivo(),
  );

  async function onSubmit(data: z.infer<typeof schemaCodePasive>) {
    startTransition(async () => {
      try {
        const response = await createCodePasiveAction(data);
        if (response.success) {
          form.reset({
            codigo: "",
            denominacioncargoespecificoid: 0,
            denominacioncargoid: 0,
            tiponominaid: 0,
          });
          toast.success(response.message);
          onSuccess?.(true);
        } else {
          toast.error(response.message);
        }
      } catch {
        toast.error("Ocurrio Un Error Al Enviar La información");
      }
    });
  }
  return (
    <>
      {isPending ? (
        <Loading />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Código de Posición</CardTitle>
            <CardDescription>
              Ingrese los datos del nuevo código y sus atributos asociados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="space-y-2 grid grid-cols-2 items-baseline gap-6 place-content-center">
                  <FormField
                    control={form.control}
                    name="codigo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Código</FormLabel>
                        <FormControl>
                          <Input placeholder="000" {...field} />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="denominacioncargoid"
                    render={({ field }) => (
                      <FormItem className=" ">
                        <FormLabel>Denominación De Cargo</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${isLoadingCargo ? "Cargando Denominaciones De Cargo" : "Seleccione una Denominación De Cargo"}`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cargo?.data.map((cargo, i) => (
                              <SelectItem key={i} value={`${cargo.id}`}>
                                {cargo.cargo}
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
                    name="denominacioncargoespecificoid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Denominación De Cargo Específico</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${isLoadingCargoEspecifico ? "Cargando Cargos Especificos" : "Seleccione una Denominación De Cargo Específico"}`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cargoEspecifico?.data.map((cargo, i) => (
                              <SelectItem key={i} value={`${cargo.id}`}>
                                {cargo.cargo}
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
                    name="tiponominaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Nomina</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${isLoadingNomina ? "Cargando Nominas" : "Seleccione un Tipo de Nómina"}`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {nomina?.data.map((nomina, i) => (
                              <SelectItem key={i} value={`${nomina.id}`}>
                                {nomina.nomina}
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
                    name="OrganismoAdscritoid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organismo Adscrito (Opcional)</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${isLoadingOrganismoAds ? "Cargando Organismos Adscritos" : "Seleccione Un Organismo Adscrito"}`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organismoAds?.data.map((org, i) => (
                              <SelectItem key={i} value={`${org.id}`}>
                                {org.id}-{org.Organismoadscrito}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                      <>
                        <Spinner />
                        Creando Nuevo Código...
                      </>
                    ) : (
                      "Crear Nuevo Código"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
