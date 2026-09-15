"use client";

/**
 * Página de consulta del historial de movimientos de cargo (solo lectura).
 * `DataTable` (tanstack, shared/ui) con menú de acciones por fila (Copiar
 * código de puesto, Ver detalle) en vez de una tabla HTML plana — paridad
 * de patrón con `modules/personal`/`modules/familiares`. Cliente +
 * react-hook-form + zodResolver; la consulta va envuelta en useTransition
 * (R8) y se delega a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 * Sin mutaciones: únicamente GET del historial por empleado o por cargo.
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { Briefcase, History, Loader2, Search, User } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";
import {
  getHistorialPorCargoAction,
  getHistorialPorEmpleadoAction,
} from "../infrastructure/actions/movimientos-actions";
import { DetalleMovimiento } from "./detalle-movimiento";
import { construirColumnasMovimientos } from "./movimientos-columns";
import {
  historialCargoSchema,
  historialEmpleadoSchema,
  type HistorialCargoFormType,
  type HistorialEmpleadoFormType,
} from "./schema/schema-historial";

type Consulta = { tipo: "empleado" | "cargo"; valor: string } | null;

export default function MovimientosPage() {
  const [tab, setTab] = useState<"empleado" | "cargo">("empleado");
  const [consulta, setConsulta] = useState<Consulta>(null);
  const [isPending, startTransition] = useTransition();
  const [viendoDetalle, setViendoDetalle] = useState<MovimientoCargoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const { data: movimientos, error, isLoading, mutate } = useSWR<MovimientoCargoDTO[]>(
    consulta ? `movimientos-${consulta.tipo}-${consulta.valor}` : null,
    async () => {
      if (!consulta) return [];
      const resultado =
        consulta.tipo === "empleado"
          ? await getHistorialPorEmpleadoAction(consulta.valor)
          : await getHistorialPorCargoAction(consulta.valor);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        throw new Error((resultado as { error: string }).error);
      }
      return resultado as MovimientoCargoDTO[];
    },
  );

  const formEmpleado = useForm<HistorialEmpleadoFormType>({
    resolver: zodResolver(historialEmpleadoSchema),
    defaultValues: { empleadoCedula: "" },
  });

  const formCargo = useForm<HistorialCargoFormType>({
    resolver: zodResolver(historialCargoSchema),
    defaultValues: { codigoPuesto: "" },
  });

  const onBuscarEmpleado = (data: HistorialEmpleadoFormType) => {
    startTransition(() => {
      setConsulta({ tipo: "empleado", valor: data.empleadoCedula });
    });
  };

  const onBuscarCargo = (data: HistorialCargoFormType) => {
    startTransition(() => {
      setConsulta({ tipo: "cargo", valor: data.codigoPuesto.toUpperCase() });
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <History className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Historial de Movimientos</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Consultar historial</CardTitle>
          <CardDescription>
            Busque los movimientos de cargo de un empleado por cédula o los de un
            puesto por su código.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(value) => setTab(value as "empleado" | "cargo")}>
            <TabsList>
              <TabsTrigger value="empleado">
                <User className="size-4" aria-hidden="true" />
                Por empleado
              </TabsTrigger>
              <TabsTrigger value="cargo">
                <Briefcase className="size-4" aria-hidden="true" />
                Por cargo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="empleado">
              <form
                onSubmit={formEmpleado.handleSubmit(onBuscarEmpleado)}
                className="flex flex-col gap-5"
                noValidate
              >
                <Field data-invalid={!!formEmpleado.formState.errors.empleadoCedula}>
                  <Label htmlFor="empleadoCedula">Cédula del empleado</Label>
                  <Input
                    {...formEmpleado.register("empleadoCedula")}
                    id="empleadoCedula"
                    placeholder="Ej. V-12345678"
                    aria-invalid={!!formEmpleado.formState.errors.empleadoCedula}
                  />
                  {formEmpleado.formState.errors.empleadoCedula && (
                    <p role="alert" className="text-sm text-destructive">
                      {formEmpleado.formState.errors.empleadoCedula.message}
                    </p>
                  )}
                </Field>
                <Button
                  type="submit"
                  className="w-fit"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="size-4" aria-hidden="true" />
                  )}
                  Buscar historial
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="cargo">
              <form
                onSubmit={formCargo.handleSubmit(onBuscarCargo)}
                className="flex flex-col gap-5"
                noValidate
              >
                <Field data-invalid={!!formCargo.formState.errors.codigoPuesto}>
                  <Label htmlFor="codigoPuesto">Código de puesto</Label>
                  <Input
                    {...formCargo.register("codigoPuesto")}
                    id="codigoPuesto"
                    placeholder="Ej. 0-00-000000-00"
                    aria-invalid={!!formCargo.formState.errors.codigoPuesto}
                  />
                  {formCargo.formState.errors.codigoPuesto && (
                    <p role="alert" className="text-sm text-destructive">
                      {formCargo.formState.errors.codigoPuesto.message}
                    </p>
                  )}
                </Field>
                <Button
                  type="submit"
                  className="w-fit"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="size-4" aria-hidden="true" />
                  )}
                  Buscar historial
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {!consulta ? (
        <p className="text-sm text-muted-foreground">
          Seleccione una opción y ejecute una búsqueda para ver los movimientos.
        </p>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm font-medium text-destructive">
            No fue posible cargar el historial de movimientos.
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading || isPending ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <DataTable
          columns={construirColumnasMovimientos((movimiento) => {
            setViendoDetalle(movimiento);
            setDetalleAbierto(true);
          })}
          data={movimientos ?? []}
          emptyMessage="No hay movimientos registrados para la consulta."
        />
      )}

      <DetalleMovimiento
        movimiento={viendoDetalle}
        open={detalleAbierto}
        onOpenChange={setDetalleAbierto}
      />
    </section>
  );
}
