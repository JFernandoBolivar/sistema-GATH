"use client";

/**
 * Página de consulta de trabajadores pasivos (jubilados/pensionados).
 * Cliente + react-hook-form + zodResolver; la consulta va envuelta en
 * useTransition (R8) y se delega a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { Loader2, Search, UserRound } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
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

import type { PasivoDTO } from "../application/dtos/pasivos-dto";
import { getPasivosAction } from "../infrastructure/actions/pasivos-actions";
import { listadoPasivosSchema, type ListadoPasivosFormType } from "./schema/schema-pasivo";

function PasivoRow({ pasivo }: { pasivo: PasivoDTO }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{pasivo.cedula}</TableCell>
      <TableCell>
        {pasivo.nombres} {pasivo.apellidos}
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{pasivo.tipoPasivo}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {pasivo.fechaEgreso ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {pasivo.resolucion ?? "—"}
      </TableCell>
    </TableRow>
  );
}

export default function PasivosPage() {
  const [busqueda, setBusqueda] = useState("");
  const [isPending, startTransition] = useTransition();

  const form = useForm<ListadoPasivosFormType>({
    resolver: zodResolver(listadoPasivosSchema),
    defaultValues: { busqueda: "" },
  });

  const { data: pasivos, error, isLoading, mutate } = useSWR<PasivoDTO[]>(
    `pasivos-${busqueda}`,
    () => getPasivosAction(busqueda || undefined),
  );

  const onSubmit = (data: ListadoPasivosFormType) => {
    startTransition(() => {
      setBusqueda(data.busqueda ?? "");
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Trabajadores Pasivos</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Buscar</CardTitle>
          <CardDescription>
            Liste los trabajadores jubilados y pensionados o busque por cédula/nombre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            <Field data-invalid={!!form.formState.errors.busqueda}>
              <Label htmlFor="busqueda">Búsqueda</Label>
              <Input
                {...form.register("busqueda")}
                id="busqueda"
                placeholder="Cédula o nombre"
                aria-invalid={!!form.formState.errors.busqueda}
              />
              {form.formState.errors.busqueda && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.busqueda.message}
                </p>
              )}
            </Field>
            <Button type="submit" className="w-fit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cédula</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha de egreso</TableHead>
              <TableHead>Resolución</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-destructive">
                  No fue posible cargar el listado de pasivos.
                </TableCell>
              </TableRow>
            ) : !pasivos?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay trabajadores pasivos registrados.
                </TableCell>
              </TableRow>
            ) : (
              pasivos.map((p) => <PasivoRow key={p.id} pasivo={p} />)
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
