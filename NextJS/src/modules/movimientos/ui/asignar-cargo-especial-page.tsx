"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Combobox } from "@/shared/ui/components/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { ContratoInlineForm } from "@/shared/components/contrato-inline-form";
import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import {
  asignarCargoEspecialAction,
  getCoordinacionesAction,
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getGradosAction,
  getOrganismosAdscritosAction,
  getTiposNominaAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import { getTiposProcedenciaAction } from "@/modules/catalogos/infrastructure/actions/catalogos-actions";
import type {
  CatalogoCargoItemDTO,
  DenominacionCargoDTO,
  UnidadOrganizativaCargoDTO,
} from "@/modules/cargos/application/dtos/cargo-dto";
import type { CatalogoItemDTO } from "@/modules/catalogos/application/dtos/catalogos-dto";
import {
  schemaCodeEspecial,
  type SchemaCodeEspecialType,
} from "@/modules/cargos/ui/schema/schema-asignar-cargo";

interface CodigoCatalogFormProps {
  onSuccess?: (bool: boolean) => void;
}

export function AsignarCargoEspecialPage({ onSuccess }: CodigoCatalogFormProps) {
  const [dependencyId, setDependencyId] = useState<number | string>("");
  const [activeDirectionGeneral, setActiveDirectionGeneral] = useState<boolean>(false);
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] = useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] = useState<string>();

  const [activeDirectionLine, setActiveDirectionLine] = useState<boolean>(false);
  const [activeCoordination, setActiveCoordination] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [employeeReady, setEmployeeReady] = useState(false);

  // Catalogs
  const [denominaciones, setDenominaciones] = useState<DenominacionCargoDTO[]>([]);
  const [especificas, setEspecificas] = useState<DenominacionCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [grados, setGrados] = useState<CatalogoCargoItemDTO[]>([]);
  const [organismosAds, setOrganismosAds] = useState<CatalogoCargoItemDTO[]>([]);
  const [tiposProcedencia, setTiposProcedencia] = useState<CatalogoItemDTO[]>([]);
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);

  const [isLoadingCargo, setIsLoadingCargo] = useState(true);
  const [isLoadingCargoEspecifico, setIsLoadingCargoEspecifico] = useState(true);
  const [isLoadingNomina, setIsLoadingNomina] = useState(true);
  const [isLoadingGrado, setIsLoadingGrado] = useState(true);
  const [isLoadingOrganismoAds, setIsLoadingOrganismoAds] = useState(true);
  const [isLoadingTiposProcedencia, setIsLoadingTiposProcedencia] = useState(true);
  const [isLoadingDependency, setIsLoadingDependency] = useState(true);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);

  const form = useForm<SchemaCodeEspecialType>({
    resolver: zodResolver(schemaCodeEspecial),
    defaultValues: {
      employee: "",
      OrganismoAdscritoid: 0,
      denominacioncargoespecificoid: 0,
      denominacioncargoid: 0,
      gradoid: 0,
      tiponominaid: 0,
      Dependencia: 0,
      DireccionGeneral: 0,
      DireccionLinea: 0,
      Coordinacion: 0,
      tipo_procedencia: 0,
    },
  });

  const validateDirectionGeneral = () => {
    if (!activeDirectionGeneral) form.setValue("DireccionGeneral", 0);
  };
  const validateDirectionLine = () => {
    if (!activeDirectionLine || !activeDirectionGeneral)
      form.setValue("DireccionLinea", 0);
  };
  const validateCoordination = () => {
    if (
      !activeCoordination ||
      !activeDirectionLine ||
      !activeDirectionGeneral
    ) {
      form.setValue("Coordinacion", 0);
    }
  };

  // Initial catalogs fetch
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cargos, esp, noms, grds, orgs, procs, deps] = await Promise.all([
          getDenominacionesAction(),
          getDenominacionesEspecificasAction(),
          getTiposNominaAction(),
          getGradosAction(),
          getOrganismosAdscritosAction(),
          getTiposProcedenciaAction(),
          getDependenciasAction(),
        ]);
        if (!active) return;
        setDenominaciones(cargos);
        setEspecificas(esp);
        setTiposNomina(noms);
        setGrados(grds);
        setOrganismosAds(orgs);
        setTiposProcedencia(procs);
        setDependencias(deps);
      } catch {
        // Silencioso
      } finally {
        if (active) {
          setIsLoadingCargo(false);
          setIsLoadingCargoEspecifico(false);
          setIsLoadingNomina(false);
          setIsLoadingGrado(false);
          setIsLoadingOrganismoAds(false);
          setIsLoadingTiposProcedencia(false);
          setIsLoadingDependency(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  // Cascading: dependencyId -> Direcciones Generales
  useEffect(() => {
    if (!dependencyId || Number(dependencyId) === 0) {
      setDireccionesGenerales([]);
      return;
    }
    let active = true;
    setIsLoadingDirectionGeneral(true);
    getDireccionesGeneralesAction(Number(dependencyId))
      .then((data) => {
        if (active) setDireccionesGenerales(data);
      })
      .finally(() => {
        if (active) setIsLoadingDirectionGeneral(false);
      });
    return () => { active = false; };
  }, [dependencyId]);

  // Cascading: selecteIdDirectionGeneral -> Direcciones de Línea
  useEffect(() => {
    if (!selecteIdDirectionGeneral || Number(selecteIdDirectionGeneral) === 0) {
      setDireccionesLinea([]);
      return;
    }
    let active = true;
    setIsLoadingDirectionLine(true);
    getDireccionesLineaAction(Number(selecteIdDirectionGeneral))
      .then((data) => {
        if (active) setDireccionesLinea(data);
      })
      .finally(() => {
        if (active) setIsLoadingDirectionLine(false);
      });
    return () => { active = false; };
  }, [selecteIdDirectionGeneral]);

  // Cascading: selecteIdDirectionLine -> Coordinaciones
  useEffect(() => {
    if (!selecteIdDirectionLine || Number(selecteIdDirectionLine) === 0) {
      setCoordinaciones([]);
      return;
    }
    let active = true;
    setIsLoadingCoordination(true);
    getCoordinacionesAction(Number(selecteIdDirectionLine))
      .then((data) => {
        if (active) setCoordinaciones(data);
      })
      .finally(() => {
        if (active) setIsLoadingCoordination(false);
      });
    return () => { active = false; };
  }, [selecteIdDirectionLine]);

  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const handleSearchEmployee = async (cedula: string) => {
    const term = cedula.trim();
    if (!term) return;
    setIsLoadingSearch(true);
    setHasSearched(true);
    setEmployeeError(null);
    try {
      const res = await getEmpleadoPorCedulaAction(term);
      if (res && "cedula" in res) {
        setEmployee(res);
        form.setValue("employee", res.cedula, {
          shouldValidate: true,
          shouldDirty: true,
        });
        const hasContratoActivo =
          !!res.contratoActual &&
          res.contratoActual.estatusNombre !== "VENCIDO" &&
          res.contratoActual.estatusNombre !== "CULMINADO";
        setEmployeeReady(hasContratoActivo);
      } else {
        setEmployee(null);
        setEmployeeReady(false);
        const err = res && "error" in res ? res.error : "Trabajador no encontrado";
        setEmployeeError(err);
      }
    } catch {
      setEmployee(null);
      setEmployeeReady(false);
      setEmployeeError("Error al consultar el trabajador");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const clearEmployee = () => {
    setEmployee(null);
    setHasSearched(false);
    setEmployeeReady(false);
    setEmployeeError(null);
    form.setValue("employee", "");
  };

  useEffect(() => {
    if (!employee) setEmployeeReady(false);
  }, [employee]);

  const onSubmit = (values: SchemaCodeEspecialType) => {
    startTransition(async () => {
      const response = await asignarCargoEspecialAction({
        cedulaEmpleado: values.employee,
        denominacionId: values.denominacioncargoid,
        especificaId: values.denominacioncargoespecificoid,
        tipoNominaId: values.tiponominaid,
        dependenciaId: values.Dependencia,
        direccionGeneralId: values.DireccionGeneral,
        direccionLineaId: values.DireccionLinea || undefined,
        coordinacionId: values.Coordinacion || undefined,
        organismoId: values.OrganismoAdscritoid || undefined,
        gradoId: values.gradoid || undefined,
      });

      if (response.success) {
        toast.success(response.message);
        onSuccess?.(true);
        clearEmployee();
        form.reset();
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Registrar Código de Posición</CardTitle>
        <CardDescription>
          Ingrese los datos del nuevo código y sus atributos asociados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmployeeSearchForm onSearch={handleSearchEmployee} />

        <div className="mt-4">
          <EmployeeInfoBanner
            employee={
              employee
                ? {
                    nombres: employee.nombres,
                    apellidos: employee.apellidos,
                    cedulaidentidad: employee.cedula,
                    cedula: employee.cedula,
                  }
                : null
            }
            hasSearched={hasSearched}
            isLoading={isLoadingSearch}
            errorMessage={employeeError ?? undefined}
            extraFields={
              employee?.estadoCivilNombre
                ? [{ label: "Estado Civil", value: employee.estadoCivilNombre }]
                : []
            }
          />
        </div>

        <ContratoInlineForm
          employee={
            employee
              ? {
                  id: employee.id,
                  cedulaidentidad: employee.cedula,
                  contratoActual: employee.contratoActual,
                }
              : undefined
          }
          onSuccess={() => setEmployeeReady(true)}
          className="mt-3"
        />

        {employee && employeeReady && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="gap-6 mt-3"
            >
              <div className="grid grid-cols-2 items-baseline gap-6 place-content-center">
                <FormField
                  control={form.control}
                  name="denominacioncargoid"
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
                          onChange={(value) => field.onChange(Number.parseInt(value))}
                          placeholder={
                            isLoadingCargo
                              ? "Cargando Cargos"
                              : "Seleccione una Denominación De Cargo"
                          }
                          searchPlaceholder="Buscar cargo..."
                          disabled={isLoadingCargo}
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
                          options={especificas.map((cargo) => ({
                            value: `${cargo.id}`,
                            label: cargo.nombre,
                          }))}
                          value={field.value ? `${field.value}` : ""}
                          onChange={(value) => field.onChange(Number.parseInt(value))}
                          placeholder={
                            isLoadingCargoEspecifico
                              ? "Cargando Cargos Especificos"
                              : "Seleccione una Denominación De Cargo Específico"
                          }
                          searchPlaceholder="Buscar cargo especifico..."
                          disabled={isLoadingCargoEspecifico}
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
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingNomina
                                  ? "Cargando Nominas"
                                  : "Seleccione un Tipo de Nomina"
                              }
                            />
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

                <FormField
                  control={form.control}
                  name="gradoid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado (Opcional)</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingGrado
                                  ? "Cargando Grados"
                                  : "Seleccione un Grado"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grados.map((g) => (
                            <SelectItem key={g.id} value={`${g.id}`}>
                              {g.nombre}
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
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingOrganismoAds
                                  ? "Cargando Organismos Adscritos"
                                  : "Seleccione Un Organismo Adscrito"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organismosAds.map((org) => (
                            <SelectItem key={org.id} value={`${org.id}`}>
                              {org.id}-{org.nombre}
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
                  name="tipo_procedencia"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Tipo De Procedencia</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingTiposProcedencia
                                  ? "Cargando Tipos De Procedencia"
                                  : "Seleccione Un Tipo De Procedencia"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tiposProcedencia.map((tipo) => (
                            <SelectItem key={tipo.id} value={`${tipo.id}`}>
                              {tipo.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="Dependencia"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem
                      className={`${
                        !activeDirectionGeneral ? "col-span-2" : "truncate"
                      }`}
                    >
                      <FormLabel>Nivel</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => {
                            setDependencyId(value);
                            field.onChange(Number.parseInt(value));
                          }}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={isLoadingDependency ? "Cargando Niveles" : "Seleccionar Nivel"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>
                                Dirección / Gerencia / Oficina
                              </SelectLabel>
                              {dependencias.map((dp) => (
                                <SelectItem key={dp.id} value={`${dp.id}`}>
                                  {dp.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        <div className="flex flex-row items-center text-left gap-2 justify-center">
                          ¿Desea Agregarle Una División / Coordinación?
                          <Switch
                            onCheckedChange={(bool) => {
                              setActiveDirectionGeneral(bool);
                              validateDirectionGeneral();
                            }}
                          />
                        </div>
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {activeDirectionGeneral && direccionesGenerales.length > 0 && (
                  <FormField
                    control={form.control}
                    name="DireccionGeneral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                            setSelecteIdDirectionGeneral(values);
                          }}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingDirectionGeneral
                                    ? "Cargando Direcciones"
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
                          <div className="flex flex-row items-center text-left gap-2 justify-center">
                            ¿Desea Agregarle Una División / Coordinación?
                            <Switch
                              onCheckedChange={(bool) => {
                                setActiveDirectionLine(bool);
                                validateDirectionLine();
                              }}
                            />
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {activeDirectionLine && direccionesLinea.length > 0 && (
                  <FormField
                    control={form.control}
                    name="DireccionLinea"
                    render={({ field }) => (
                      <FormItem
                        className={`${activeCoordination ? "" : "col-span-2"}`}
                      >
                        <FormLabel>División / Coordinación</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                            setSelecteIdDirectionLine(values);
                          }}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingDirectionLine
                                    ? "Cargando División / Coordinación"
                                    : "Seleccione una División / Coordinación"
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
                          <div className="flex flex-row items-center text-left justify-center gap-2">
                            ¿Desea Agregarle Una Coordinación?
                            <Switch
                              onCheckedChange={(bool) => {
                                setActiveCoordination(bool);
                                validateCoordination();
                              }}
                            />
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {activeCoordination && coordinaciones.length > 0 && (
                  <FormField
                    control={form.control}
                    name="Coordinacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinación</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  isLoadingCoordination
                                    ? "Cargando Coordinaciones"
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
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 justify-end mt-4">
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Asignando Código Especial…
                    </>
                  ) : (
                    "Asignar Código Especial"
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

export default AsignarCargoEspecialPage;
