"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/shared/ui/components/label";
import { Loading } from "@/shared/ui/components/loading";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";

import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import {
  getTiposNominaAction,
  getMotivosEgresoAction,
  procesarEgresoAction,
} from "@/modules/pasivos/infrastructure/actions/pasivos-actions";
import {
  getEstatusAction,
  getMotivosAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type { CatalogoPasivoApiItem } from "@/modules/pasivos/infrastructure/http/pasivos-api";
import type { CatalogoCargoItemDTO } from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaPasivoUI,
  type SchemaPasivoUIType,
} from "./schema/schema-cambiar-pasivo";

const ESTATUS_PERMITIDOS_EGRESOS = ["PASIVO", "EGRESADO"];

export function CambiarPasivoPage() {
  const [isPending, startTransition] = useTransition();

  // Catalogs
  const [nominaPasivo, setNominaPasivo] = useState<CatalogoPasivoApiItem[]>([]);
  const [statusEmployee, setStatusEmployee] = useState<CatalogoCargoItemDTO[]>([]);
  const [reasonLeaving, setReasonLeaving] = useState<CatalogoPasivoApiItem[]>([]);
  const [isLoadingNominaPasivo, setIsLoadingNominaPasivo] = useState(true);
  const [isLoadingStatusEmployee, setIsLoadingStatusEmployee] = useState(true);
  const [isLoadingReasonLeaving, setIsLoadingReasonLeaving] = useState(true);

  // Employee state
  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const form = useForm<SchemaPasivoUIType>({
    resolver: zodResolver(schemaPasivoUI),
    defaultValues: {
      estatus_id: 0,
      motivo: 0,
      tiponominaid: 0,
      liberar_activos: false,
    },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [nominas, allStatuses, reasons] = await Promise.all([
          getTiposNominaAction(true),
          getEstatusAction(),
          getMotivosEgresoAction().catch(async () => {
            const general = await getMotivosAction("EGRESO").catch(() => getMotivosAction());
            return general.map((g) => ({ id: g.id, nombre: g.nombre }));
          }),
        ]);
        if (!active) return;
        const nominasPasivoFiltradas = nominas.filter((n) => {
          const upper = n.nombre.toUpperCase();
          return upper.includes("JUBILAD") || upper.includes("PENSIONAD");
        });
        setNominaPasivo(nominasPasivoFiltradas.length > 0 ? nominasPasivoFiltradas : nominas);

        const filteredStatuses = allStatuses.filter((s) =>
          ESTATUS_PERMITIDOS_EGRESOS.includes(s.nombre.toUpperCase()),
        );
        setStatusEmployee(
          filteredStatuses.length > 0
            ? filteredStatuses
            : [
                { id: 1, nombre: "PASIVO" },
                { id: 2, nombre: "EGRESADO" },
              ],
        );

        setReasonLeaving(reasons && reasons.length > 0 ? reasons : []);
      } catch {
        // Silencioso
      } finally {
        if (active) {
          setIsLoadingNominaPasivo(false);
          setIsLoadingStatusEmployee(false);
          setIsLoadingReasonLeaving(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
        form.reset({
          estatus_id: 0,
          motivo: 0,
          tiponominaid: 0,
          liberar_activos: false,
        });
      } else {
        setEmployee(null);
        const err = res && "error" in res ? res.error : "Trabajador no encontrado";
        setEmployeeError(err);
      }
    } catch {
      setEmployee(null);
      setEmployeeError("Error al consultar el trabajador");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const clearEmployee = () => {
    setEmployee(null);
    setHasSearched(false);
    setEmployeeError(null);
    form.reset({
      estatus_id: 0,
      motivo: 0,
      tiponominaid: 0,
      liberar_activos: false,
    });
  };

  const estatusId = useWatch({
    control: form.control,
    name: "estatus_id",
  });

  const selectedStatusItem = statusEmployee.find((v) => v.id === estatusId);
  const validatePeace = selectedStatusItem?.nombre.toUpperCase() === "PASIVO";

  const onSubmit = (data: SchemaPasivoUIType) => {
    startTransition(async () => {
      if (!employee?.cedula) return;

      if (validatePeace && (!data.tiponominaid || data.tiponominaid <= 0)) {
        toast.error("Es obligatorio asignar una nómina para personal PASIVO");
        return;
      }

      const effectiveNominaId = validatePeace
        ? (data.tiponominaid ?? 0)
        : (data.tiponominaid && data.tiponominaid > 0
            ? data.tiponominaid
            : (nominaPasivo[0]?.id ?? 1));

      try {
        const response = await procesarEgresoAction({
          cedula: employee.cedula,
          motivoMovimientoId: data.motivo,
          tipoNominaId: effectiveNominaId,
          liberarActivos: validatePeace ? (data.liberar_activos ?? false) : true,
        });

        if (response && "error" in response) {
          toast.error(response.error);
        } else {
          toast.success("Gestión realizada exitosamente");
          form.reset();
          clearEmployee();
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Error al procesar el movimiento",
        );
      }
    });
  };

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Ejecutando Cambio..." />
      ) : (
        <Card className="bg-white">
          <CardContent className="gap-5 flex flex-col p-6">
            <EmployeeSearchForm onSearch={handleSearchEmployee} />

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
            />

            {employee && (
              <div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="estatus_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Egresado/Pasivo</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                            value={field.value && field.value > 0 ? `${field.value}` : ""}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingStatusEmployee
                                      ? "Cargando Listado"
                                      : "Seleccione Un Item"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusEmployee.map((status, i) => (
                                <SelectItem key={i} value={`${status.id}`}>
                                  {status.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {validatePeace && (
                      <>
                        <FormField
                          control={form.control}
                          name="tiponominaid"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Listado De Nominas De Jubilados</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                                value={field.value && field.value > 0 ? `${field.value}` : ""}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={
                                        isLoadingNominaPasivo
                                          ? "Cargando Nominas"
                                          : "Seleccione Una Nomina"
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {nominaPasivo.map((nomina, i) => (
                                    <SelectItem key={i} value={`${nomina.id}`}>
                                      {nomina.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex flex-row gap-2 justify-end items-center">
                          <Label>Desea Liberar El Cargo Activo</Label>
                          <Switch
                            checked={form.watch("liberar_activos")}
                            onCheckedChange={(checked) => {
                              form.setValue("liberar_activos", checked);
                            }}
                          />
                        </div>
                      </>
                    )}

                    <FormField
                      control={form.control}
                      name="motivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motivo De Egreso/Pasivo</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                            value={field.value && field.value > 0 ? `${field.value}` : ""}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    isLoadingReasonLeaving
                                      ? "Cargando Motivos De Egreso/Pasivo"
                                      : "Seleccione Un Motivo de Egreso/Pasivo"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {reasonLeaving.map((reason, i) => (
                                <SelectItem key={i} value={`${reason.id}`}>
                                  {reason.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button className="w-full mt-2" disabled={isPending}>
                      {isPending ? "Cargando..." : "Ejecutar Cambio"}
                    </Button>
                  </form>
                </Form>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default CambiarPasivoPage;
