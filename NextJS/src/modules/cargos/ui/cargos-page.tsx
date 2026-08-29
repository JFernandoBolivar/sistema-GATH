"use client";

/**
 * Página de cargos: listado con filtros, asignación y desasignación.
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Loader2, RefreshCw, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { CargoAsignacionDTO } from "../application/dtos/cargo-dto";
import {
  asignarCargoAction,
  desasignarCargoAction,
  getCargosAction,
} from "../infrastructure/actions/cargos-actions";
import {
  asignarCargoSchema,
  type AsignarCargoFormType,
  cargosFiltroSchema,
  type CargosFiltroFormType,
} from "./schema/schema-asignar-cargo";

export default function CargosPage() {
  const [cargos, setCargos] = useState<CargoAsignacionDTO[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtroForm = useForm<CargosFiltroFormType>({
    resolver: zodResolver(cargosFiltroSchema),
    defaultValues: {},
  });

  const asignarForm = useForm<AsignarCargoFormType>({
    resolver: zodResolver(asignarCargoSchema),
    defaultValues: { cargoId: undefined, empleadoCedula: "" },
  });

  const cargar = (filtros?: { dependenciaId?: number; soloVacantes?: boolean }) => {
    startTransition(async () => {
      setError(null);
      try {
        setCargos(await getCargosAction(filtros));
      } catch {
        setError("No fue posible cargar los cargos.");
      }
    });
  };

  useEffect(() => {
    cargar();
  }, []);

  const onFiltro = (data: CargosFiltroFormType) => {
    cargar({ dependenciaId: data.dependenciaId ?? undefined, soloVacantes: data.soloVacantes });
  };

  const onAsignar = (data: AsignarCargoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await asignarCargoAction(data.cargoId, data.empleadoCedula);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      asignarForm.reset({ cargoId: undefined, empleadoCedula: "" });
      cargar();
    });
  };

  const onDesasignar = (cargoId: number) => {
    startTransition(async () => {
      setError(null);
      const result = await desasignarCargoAction(cargoId);
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      cargar();
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Cargos</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={filtroForm.handleSubmit(onFiltro)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <Field>
                  <Label htmlFor="dependenciaId">Dependencia (opcional)</Label>
                  <Input type="number" id="dependenciaId" placeholder="Id" {...filtroForm.register("dependenciaId", { valueAsNumber: true })} />
                </Field>
                <Field className="flex items-end gap-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...filtroForm.register("soloVacantes")}
                      className="size-4"
                    />
                    Solo vacantes
                  </label>
                </Field>
              </div>
              <div>
                <Button type="submit" disabled={isPending}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Buscar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Asignar cargo</CardTitle>
            <CardDescription>Asigne un puesto a un empleado por cédula.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={asignarForm.handleSubmit(onAsignar)} className="flex flex-col gap-4" noValidate>
              <Field data-invalid={!!asignarForm.formState.errors.cargoId}>
                <Label htmlFor="cargoId">Id del cargo</Label>
                <Input
                  type="number"
                  id="cargoId"
                  placeholder="Código del puesto"
                  {...asignarForm.register("cargoId", { valueAsNumber: true })}
                  aria-invalid={!!asignarForm.formState.errors.cargoId}
                />
                {asignarForm.formState.errors.cargoId && (
                  <p role="alert" className="text-sm text-destructive">{asignarForm.formState.errors.cargoId.message}</p>
                )}
              </Field>
              <Field data-invalid={!!asignarForm.formState.errors.empleadoCedula}>
                <Label htmlFor="empleadoCedula">Cédula del empleado</Label>
                <Input
                  id="empleadoCedula"
                  placeholder="Ej. V-12345678"
                  {...asignarForm.register("empleadoCedula")}
                  aria-invalid={!!asignarForm.formState.errors.empleadoCedula}
                />
                {asignarForm.formState.errors.empleadoCedula && (
                  <p role="alert" className="text-sm text-destructive">{asignarForm.formState.errors.empleadoCedula.message}</p>
                )}
              </Field>
              <div>
                <Button type="submit" disabled={isPending}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Asignar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Id</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Denominación</TableHead>
              <TableHead>Dependencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : cargos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">No hay cargos.</TableCell></TableRow>
            ) : (
              cargos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>{c.codigoNomina ?? "—"}</TableCell>
                  <TableCell>{c.empleadoNombre ?? "Vacante"}</TableCell>
                  <TableCell>{c.denominacionCargoNombre}</TableCell>
                  <TableCell>{c.dependenciaNombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.estaVacante ? "outline" : "secondary"}>
                      {c.estaVacante ? "Vacante" : "Ocupado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!c.estaVacante && (
                      <Button variant="ghost" size="sm" onClick={() => onDesasignar(c.id)} disabled={isPending}>
                        <UserMinus className="size-4" aria-hidden="true" />
                        Desasignar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
