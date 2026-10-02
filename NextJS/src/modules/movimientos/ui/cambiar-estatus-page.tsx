"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Loading } from "@/shared/ui/components/loading";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { ErrorCard } from "./components/error-card";

import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import {
  getEstatusAction,
  getMotivosAction,
  gestionarEstatusAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type { CatalogoCargoItemDTO } from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaStatusChangeUI,
  type SchemaStatusChangeUIType,
} from "./schema/schema-cambiar-estatus";

const ESTATUS_PERMITIDOS_GESTION = ["SUSPENDIDO", "BLOQUEADO", "ACTIVO"];

export function CambiarEstatusPage() {
  const [isPending, startTransition] = useTransition();

  // Catalogs
  const [statusNomina, setStatusNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [internalReason, setInternalReason] = useState<CatalogoCargoItemDTO[]>([]);
  const [isLoadingStatusNomina, setIsLoadingStatusNomina] = useState(true);
  const [isLoadingInternalReason, setIsLoadingInternalReason] = useState(true);

  // Employee state
  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const form = useForm<SchemaStatusChangeUIType>({
    resolver: zodResolver(schemaStatusChangeUI),
    defaultValues: {
      estatus_id: 0,
      cargo: 0,
      motivo: 0,
    },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [allStatuses, reasons] = await Promise.all([
          getEstatusAction(),
          getMotivosAction("ESTATUS").catch(() => getMotivosAction()),
        ]);
        if (!active) return;
        const filteredStatuses = allStatuses.filter((s) =>
          ESTATUS_PERMITIDOS_GESTION.includes(s.nombre.toUpperCase()),
        );
        setStatusNomina(filteredStatuses.length > 0 ? filteredStatuses : allStatuses);
        setInternalReason(reasons && reasons.length > 0 ? reasons : await getMotivosAction());
      } catch {
        // Silencioso
      } finally {
        if (active) {
          setIsLoadingStatusNomina(false);
          setIsLoadingInternalReason(false);
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
          cargo: 0,
          estatus_id: 0,
          motivo: 0,
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
      cargo: 0,
      estatus_id: 0,
      motivo: 0,
    });
  };

  const onSubmit = (data: SchemaStatusChangeUIType) => {
    startTransition(async () => {
      try {
        const response = await gestionarEstatusAction({
          cargoId: data.cargo,
          estatusId: data.estatus_id,
          motivoId: data.motivo,
        });
        if (response && "error" in response) {
          toast.error(response.error);
        } else {
          toast.success("Estatus del cargo actualizado correctamente.");
          clearEmployee();
        }
      } catch (err: unknown) {
        toast.error(
          err instanceof Error ? err.message : "Ocurrió un error al cambiar el estatus",
        );
      }
    });
  };

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Cambiando Estatus..." />
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
                {!employee.asignaciones || employee.asignaciones.length === 0 ? (
                  <ErrorCard
                    errorMessage="El Trabajador No Posee Asignaciones De Cargo"
                    className="scale-100"
                  />
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="cargo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Listado De Cargos Del Empleado</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                              value={field.value && field.value > 0 ? `${field.value}` : ""}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue placeholder="Seleccione Un Código" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {employee.asignaciones?.map((cargo, i) => (
                                  <SelectItem key={i} value={`${cargo.id}`}>
                                    {cargo.codigo} -{" "}
                                    {cargo.denominacionCargoEspecifico || cargo.denominacionCargo}
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
                        name="estatus_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Listado De Estatus</FormLabel>
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
                                      isLoadingStatusNomina
                                        ? "Cargando Estatus De Codigos"
                                        : "Seleccione Un Código"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {statusNomina.map((status, i) => (
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

                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Motivo De Cambio De Estatus</FormLabel>
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
                                      isLoadingInternalReason
                                        ? "Cargando Motivos De Cambio De Estatus"
                                        : "Seleccione Un Motivo De Cambio de Estatus"
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {internalReason.map((reason, i) => (
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

                      <Button disabled={isPending} className="w-full mt-2">
                        {isPending ? "Cargando..." : "Cambiar Estatus"}
                      </Button>
                    </form>
                  </Form>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default CambiarEstatusPage;
