import {
  getCargo,
  getCargoEspecifico,
  getNominaPasivo,
  getOrganismosAds,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import { Code } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Airplay } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { updateCodeTable } from "../actions/update-code";
import {
  schemaUpdateCodeTable,
  UpdateCodeTable,
} from "../schema/schema-update-code";
import { useSearchStore } from "@/hooks/use-search-params";
interface Props {
  code: Code;
}
export default function UpdateCode({ code }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  useState<string>();

  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAds(),
  );

  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );

  const { data: cargo, isLoading: isLoadingCargo } = useSWR(
    "cargo",
    async () => await getCargo(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaPasivo",
    async () => await getNominaPasivo(),
  );

  const form = useForm({
    defaultValues: {
      OrganismoAdscritoid: undefined,
      denominacioncargoespecificoid: 0,
      denominacioncargoid: 0,
      gradoid: undefined,
      tiponominaid: 0,
    },
    resolver: zodResolver(schemaUpdateCodeTable),
  });

  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmit = (values: UpdateCodeTable) => {
    startTransition(async () => {
      const response = await updateCodeTable(values, code.id);
      if (response.success) {
        toast.success(response.message);
        setOpen(!response.success);
        mutate(["api/cargos/pasivo", searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button>Actualizar Código</Button>
      </DialogTrigger>
      <DialogContent>
        {isPending ? (
          <Loading promiseMessage="Actualizando Cargo"></Loading>
        ) : (
          <DialogHeader>
            <DialogTitle className="mb-2">
              ¿Esta Seguro Que Desea Actualizar El Cargo?
            </DialogTitle>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col space-y-4"
              >
                <div className="grid grid-cols-2 gap-2">
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

                <Button className="flex-1">
                  Actualizar Cargo <Airplay />
                </Button>
              </form>
            </Form>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
