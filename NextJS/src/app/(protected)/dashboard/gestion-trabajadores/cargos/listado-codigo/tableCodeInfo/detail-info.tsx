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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Airplay } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import {
  getCargo,
  getCargoEspecifico,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getGrado,
  getNomina,
  getNominaGeneral,
  getOrganismosAds,
} from "../../../api/getInfoRac";
import Loading from "../../../components/loading/loading";
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
  const [dependencyId, setDependencyId] = useState<number | string>("");
  const [isPending, startTransition] = useTransition();
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      dependencyId ? ["directionGeneral", dependencyId] : null,
      async () => await getDirectionGeneralById(dependencyId),
    );
  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAds(),
  );
  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    selecteIdDirectionGeneral
      ? ["directionLine", selecteIdDirectionGeneral]
      : "",
    async () => await getDirectionLine(selecteIdDirectionGeneral!),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    selecteIdDirectionLine ? ["coordination", selecteIdDirectionLine] : null,
    async () => await getCoordination(selecteIdDirectionLine!),
  );
  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR(
    "cargo",
    async () => await getCargo(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNominaGeneral(),
  );
  const { data: grado, isLoading: isLoadingGrado } = useSWR("grado", async () =>
    getGrado(),
  );
  const form = useForm({
    defaultValues: {
      Coordinacion: 0,
      OrganismoAdscritoid: undefined,
      denominacioncargoespecificoid: 0,
      denominacioncargoid: 0,
      Dependencia: 0,
      DireccionGeneral: 0,
      DireccionLinea: 0,
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
        mutate(["api/cargos", searchParams]);
        setOpen(!response.success);
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
                                placeholder={`${
                                  isLoadingCargo
                                    ? "Cargando Denominaciones De Cargo"
                                    : "Seleccione una Denominación De Cargo"
                                }`}
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
                                placeholder={`${
                                  isLoadingCargoEspecifico
                                    ? "Cargando Cargos Especificos"
                                    : "Seleccione una Denominación De Cargo Específico"
                                }`}
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
                      <FormItem className=" ">
                        <FormLabel>Tipo de Nomina</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${
                                  isLoadingNomina
                                    ? "Cargando Nominas"
                                    : "Seleccione un Tipo de Nómina"
                                }`}
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
                    name="gradoid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grado</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${
                                  isLoadingGrado
                                    ? "Cargando Grados"
                                    : "Seleccione un Grado"
                                }`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grado?.data.map((grado, i) => (
                              <SelectItem key={i} value={`${grado.id}`}>
                                {grado.grado}
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
                      <FormItem className={`col-span-2`}>
                        <FormLabel>Organismo Adscrito (Opcional)</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${
                                  isLoadingGrado
                                    ? "Cargando Organismos Adscritos"
                                    : "Seleccione Un Organismo Adscrito"
                                }`}
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
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    name="Dependencia"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="truncate">
                        <FormLabel>Nivel</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              setDependencyId(value);
                              field.onChange(Number.parseInt(value));
                            }}
                          >
                            <SelectTrigger className="w-full ">
                              <SelectValue
                                placeholder={
                                  isLoadingDependency
                                    ? `Cargando Niveles`
                                    : "Seleccione Un Nivel"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>Nivel</SelectLabel>
                                  {dependency?.data.map((dp, i) => (
                                    <SelectItem key={i} value={`${dp.id}`}>
                                      {dp.dependencia}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="DireccionGeneral"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="truncate">
                        <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              setSelecteIdDirectionGeneral(value);
                              field.onChange(Number.parseInt(value));
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={`${
                                  isLoadingDirectionGeneral
                                    ? "Cargando Direcciones Generales"
                                    : "Seleccionar Dirección General"
                                }`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>
                                  Direcciones De Generales
                                </SelectLabel>
                                {directionGeneral?.data.map((general, i) => (
                                  <SelectItem key={i} value={`${general.id}`}>
                                    {general.Codigo}-{general.direccion_general}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="DireccionLinea"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>División / Coordinación</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) => {
                              setSelecteIdDirectionLine(value);
                              field.onChange(Number.parseInt(value));
                            }}
                          >
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={` ${
                                  isLoadingDirectionLine
                                    ? "Cargando Direcciones de Linea"
                                    : "Seleccionar Direcciones De Linea"
                                }`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Direcciones De Linea</SelectLabel>
                                {directionLine?.data.map((line, i) => (
                                  <SelectItem key={i} value={`${line.id}`}>
                                    {line.Codigo}-{line.direccion_linea}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="Coordinacion"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinación</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(value) =>
                              field.onChange(Number.parseInt(value))
                            }
                          >
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${
                                  isLoadingCoordination
                                    ? "Cargando Coordinaciones"
                                    : "Seleccionar Coordinación"
                                } `}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Coordinaciones</SelectLabel>
                                {coordination?.data.map((coord, i) => (
                                  <SelectItem key={i} value={`${coord.id}`}>
                                    {coord.Codigo}-{coord.coordinacion}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
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
