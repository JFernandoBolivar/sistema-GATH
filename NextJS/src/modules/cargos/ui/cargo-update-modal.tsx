"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Airplay } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "@/shared/ui/components/select";
import { Loading } from "@/shared/ui/components/loading";
import { Combobox } from "@/shared/ui/components/combobox";

import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
  DenominacionCargoDTO,
  UnidadOrganizativaCargoDTO,
} from "../application/dtos/cargo-dto";
import {
  actualizarCargoAction,
  getCoordinacionesAction,
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getGradosAction,
  getOrganismosAdscritosAction,
  getTiposNominaAction,
} from "../infrastructure/actions/cargos-actions";
import {
  schemaUpdateCodeTable,
  type UpdateCodeTable,
} from "./schema/schema-update-code";

interface CargoUpdateModalProps {
  cargo: CargoAsignacionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export default function CargoUpdateModal({
  cargo,
  open,
  onOpenChange,
  onUpdated,
}: CargoUpdateModalProps) {
  const [isPending, startTransition] = useTransition();

  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [denominacionesEspecificas, setDenominacionesEspecificas] = useState<DenominacionCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [grados, setGrados] = useState<CatalogoCargoItemDTO[]>([]);
  const [organismosAds, setOrganismosAds] = useState<CatalogoCargoItemDTO[]>([]);
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);

  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);

  const [dependencyId, setDependencyId] = useState<number | string>("");
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] = useState<string>("");
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] = useState<string>("");

  const [isLoadingCatalogos, setIsLoadingCatalogos] = useState(false);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);

  const form = useForm<UpdateCodeTable>({
    resolver: zodResolver(schemaUpdateCodeTable),
    defaultValues: {
      denominacioncargoid: 0,
      denominacioncargoespecificoid: 0,
      tiponominaid: 0,
      gradoid: undefined,
      OrganismoAdscritoid: undefined,
      Dependencia: 0,
      DireccionGeneral: 0,
      DireccionLinea: 0,
      Coordinacion: 0,
    },
  });

  // Cargar catálogos base cuando se abre el modal
  useEffect(() => {
    if (!open) return;
    let active = true;
    setIsLoadingCatalogos(true);
    Promise.all([
      getDenominacionesAction(),
      getDenominacionesEspecificasAction(),
      getTiposNominaAction(),
      getGradosAction(),
      getOrganismosAdscritosAction(),
      getDependenciasAction(),
    ])
      .then(([denoms, especs, nominas, grds, orgs, deps]) => {
        if (!active) return;
        setDenominaciones(denoms);
        setDenominacionesEspecificas(especs);
        setTiposNomina(nominas);
        setGrados(grds);
        setOrganismosAds(orgs);
        setDependencias(deps);
      })
      .catch((e) => {
        console.error("Error al cargar catálogos:", e);
      })
      .finally(() => {
        if (active) setIsLoadingCatalogos(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  // Al seleccionar un cargo, inicializar formulario y cascadas
  useEffect(() => {
    if (!cargo || !open) return;

    form.reset({
      denominacioncargoid: cargo.denominacionId || 0,
      denominacioncargoespecificoid: cargo.especificaId || 0,
      tiponominaid: cargo.tipoNominaId || 0,
      gradoid: cargo.gradoId ?? undefined,
      OrganismoAdscritoid: cargo.organismoId ?? undefined,
      Dependencia: cargo.dependenciaId || 0,
      DireccionGeneral: cargo.direccionGeneralId || 0,
      DireccionLinea: cargo.direccionLineaId || 0,
      Coordinacion: cargo.coordinacionId || 0,
    });

    const depId = cargo.dependenciaId ? String(cargo.dependenciaId) : "";
    const dgId = cargo.direccionGeneralId ? String(cargo.direccionGeneralId) : "";
    const dlId = cargo.direccionLineaId ? String(cargo.direccionLineaId) : "";

    setDependencyId(depId);
    setSelecteIdDirectionGeneral(dgId);
    setSelecteIdDirectionLine(dlId);

    if (cargo.dependenciaId && cargo.dependenciaId > 0) {
      setIsLoadingDirectionGeneral(true);
      getDireccionesGeneralesAction(cargo.dependenciaId)
        .then((dgs) => setDireccionesGenerales(dgs))
        .finally(() => setIsLoadingDirectionGeneral(false));
    } else {
      setDireccionesGenerales([]);
    }

    if (cargo.direccionGeneralId && cargo.direccionGeneralId > 0) {
      setIsLoadingDirectionLine(true);
      getDireccionesLineaAction(cargo.direccionGeneralId)
        .then((dls) => setDireccionesLinea(dls))
        .finally(() => setIsLoadingDirectionLine(false));
    } else {
      setDireccionesLinea([]);
    }

    if (cargo.direccionLineaId && cargo.direccionLineaId > 0) {
      setIsLoadingCoordination(true);
      getCoordinacionesAction(cargo.direccionLineaId)
        .then((coords) => setCoordinaciones(coords))
        .finally(() => setIsLoadingCoordination(false));
    } else {
      setCoordinaciones([]);
    }
  }, [cargo, open, form]);

  const handleDependenciaChange = async (val: string) => {
    const num = Number.parseInt(val);
    setDependencyId(val);
    form.setValue("Dependencia", num);
    form.setValue("DireccionGeneral", 0);
    form.setValue("DireccionLinea", 0);
    form.setValue("Coordinacion", 0);
    setSelecteIdDirectionGeneral("");
    setSelecteIdDirectionLine("");
    setDireccionesGenerales([]);
    setDireccionesLinea([]);
    setCoordinaciones([]);

    if (num > 0) {
      setIsLoadingDirectionGeneral(true);
      try {
        const dgs = await getDireccionesGeneralesAction(num);
        setDireccionesGenerales(dgs);
      } catch (e) {
        console.error("Error al cargar direcciones generales:", e);
      } finally {
        setIsLoadingDirectionGeneral(false);
      }
    }
  };

  const handleDireccionGeneralChange = async (val: string) => {
    const num = Number.parseInt(val);
    setSelecteIdDirectionGeneral(val);
    form.setValue("DireccionGeneral", num);
    form.setValue("DireccionLinea", 0);
    form.setValue("Coordinacion", 0);
    setSelecteIdDirectionLine("");
    setDireccionesLinea([]);
    setCoordinaciones([]);

    if (num > 0) {
      setIsLoadingDirectionLine(true);
      try {
        const dls = await getDireccionesLineaAction(num);
        setDireccionesLinea(dls);
      } catch (e) {
        console.error("Error al cargar direcciones de línea:", e);
      } finally {
        setIsLoadingDirectionLine(false);
      }
    }
  };

  const handleDireccionLineaChange = async (val: string) => {
    const num = Number.parseInt(val);
    setSelecteIdDirectionLine(val);
    form.setValue("DireccionLinea", num);
    form.setValue("Coordinacion", 0);
    setCoordinaciones([]);

    if (num > 0) {
      setIsLoadingCoordination(true);
      try {
        const coords = await getCoordinacionesAction(num);
        setCoordinaciones(coords);
      } catch (e) {
        console.error("Error al cargar coordinaciones:", e);
      } finally {
        setIsLoadingCoordination(false);
      }
    }
  };

  const onSubmit = (values: UpdateCodeTable) => {
    if (!cargo) return;
    startTransition(async () => {
      const payload: UpdateCodeTable = {
        ...values,
        gradoid: values.gradoid && values.gradoid > 0 ? values.gradoid : undefined,
        OrganismoAdscritoid: values.OrganismoAdscritoid && values.OrganismoAdscritoid > 0 ? values.OrganismoAdscritoid : undefined,
      };
      const response = await actualizarCargoAction(cargo.id, payload);
      if (response.success) {
        toast.success(response.message);
        onOpenChange(false);
        onUpdated?.();
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isPending ? (
          <Loading promiseMessage="Actualizando Cargo" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="mb-2">
                ¿Esta Seguro Que Desea Actualizar El Cargo?
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="denominacioncargoid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Denominación De Cargo</FormLabel>
                        <FormControl>
                          <Combobox
                            options={denominaciones.map((item) => ({
                              value: String(item.id),
                              label: item.nombre,
                            }))}
                            value={field.value && field.value > 0 ? String(field.value) : ""}
                            onChange={(val) => field.onChange(Number.parseInt(val))}
                            placeholder={
                              isLoadingCatalogos
                                ? "Cargando Denominaciones De Cargo"
                                : "Seleccione una Denominación De Cargo"
                            }
                            searchPlaceholder="Buscar cargo..."
                            disabled={isLoadingCatalogos}
                          />
                        </FormControl>
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
                        <FormControl>
                          <Combobox
                            options={denominacionesEspecificas.map((item) => ({
                              value: String(item.id),
                              label: item.nombre,
                            }))}
                            value={field.value && field.value > 0 ? String(field.value) : ""}
                            onChange={(val) => field.onChange(Number.parseInt(val))}
                            placeholder={
                              isLoadingCatalogos
                                ? "Cargando Cargos Especificos"
                                : "Seleccione una Denominación De Cargo Específico"
                            }
                            searchPlaceholder="Buscar cargo especifico..."
                            disabled={isLoadingCatalogos}
                          />
                        </FormControl>
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
                          value={field.value && field.value > 0 ? String(field.value) : undefined}
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCatalogos
                                    ? "Cargando Nominas"
                                    : "Seleccione un Tipo de Nómina"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposNomina.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.nombre}
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
                          value={field.value && field.value > 0 ? String(field.value) : undefined}
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCatalogos
                                    ? "Cargando Grados"
                                    : "Seleccione un Grado"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {grados.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.nombre}
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
                      <FormItem className="col-span-2">
                        <FormLabel>Organismo Adscrito (Opcional)</FormLabel>
                        <Select
                          value={field.value && field.value > 0 ? String(field.value) : undefined}
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCatalogos
                                    ? "Cargando Organismos Adscritos"
                                    : "Seleccione Un Organismo Adscrito"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organismosAds.map((item) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.id}-{item.nombre}
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
                            value={field.value && field.value > 0 ? String(field.value) : undefined}
                            onValueChange={handleDependenciaChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  isLoadingCatalogos
                                    ? "Cargando Niveles"
                                    : "Seleccione Un Nivel"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Nivel</SelectLabel>
                                {dependencias.map((dp) => (
                                  <SelectItem key={dp.id} value={String(dp.id)}>
                                    {dp.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
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
                            value={field.value && field.value > 0 ? String(field.value) : undefined}
                            disabled={!dependencyId || Number(dependencyId) === 0}
                            onValueChange={handleDireccionGeneralChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={
                                  isLoadingDirectionGeneral
                                    ? "Cargando Direcciones Generales"
                                    : "Seleccionar Dirección General"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Direcciones Generales</SelectLabel>
                                {direccionesGenerales.map((general) => (
                                  <SelectItem key={general.id} value={String(general.id)}>
                                    {general.codigo ? `${general.codigo}-${general.nombre}` : general.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
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
                            value={field.value && field.value > 0 ? String(field.value) : undefined}
                            disabled={!selecteIdDirectionGeneral || Number(selecteIdDirectionGeneral) === 0}
                            onValueChange={handleDireccionLineaChange}
                          >
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingDirectionLine
                                    ? "Cargando Direcciones de Linea"
                                    : "Seleccionar Direcciones De Linea"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Direcciones De Linea</SelectLabel>
                                {direccionesLinea.map((line) => (
                                  <SelectItem key={line.id} value={String(line.id)}>
                                    {line.codigo ? `${line.codigo}-${line.nombre}` : line.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
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
                            value={field.value && field.value > 0 ? String(field.value) : undefined}
                            disabled={!selecteIdDirectionLine || Number(selecteIdDirectionLine) === 0}
                            onValueChange={(value) =>
                              field.onChange(Number.parseInt(value))
                            }
                          >
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCoordination
                                    ? "Cargando Coordinaciones"
                                    : "Seleccionar Coordinación"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Coordinaciones</SelectLabel>
                                {coordinaciones.map((coord) => (
                                  <SelectItem key={coord.id} value={String(coord.id)}>
                                    {coord.codigo ? `${coord.codigo}-${coord.nombre}` : coord.nombre}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={isPending} className="flex-1 cursor-pointer">
                  Actualizar Cargo <Airplay className="ml-2 size-4" />
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
