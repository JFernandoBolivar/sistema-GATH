"use client";

/**
 * Página de consulta de trabajadores pasivos (jubilados/pensionados) y
 * gestión de la transición activo → pasivo. Cliente + react-hook-form +
 * zodResolver; las acciones van envueltas en useTransition (R8) y se delegan
 * a las Server Actions del módulo (R7). Opera exclusivamente con DTOs (R5) y
 * no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { Loader2, LogOut, Search, UserRound } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { CatalogoPasivoDTO, PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  getMotivosEgresoAction,
  getPasivosAction,
  getTiposNominaAction,
  procesarEgresoAction,
} from "../infrastructure/actions/pasivos-actions";
import {
  listadoPasivosSchema,
  procesarEgresoSchema,
  type ListadoPasivosFormType,
  type ProcesarEgresoFormType,
} from "./schema/schema-pasivo";

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

function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaInvalid,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: number) => void;
  options: CatalogoPasivoDTO[];
  placeholder: string;
  ariaInvalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ? Number(v) : 0)} aria-invalid={ariaInvalid}>
      <SelectTrigger id={id} aria-invalid={ariaInvalid} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function PasivosPage() {
  const [busqueda, setBusqueda] = useState("");
  const [motivos, setMotivos] = useState<CatalogoPasivoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoPasivoDTO[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ListadoPasivosFormType>({
    resolver: zodResolver(listadoPasivosSchema),
    defaultValues: { busqueda: "" },
  });

  const egresoForm = useForm<ProcesarEgresoFormType>({
    resolver: zodResolver(procesarEgresoSchema),
    defaultValues: { cedula: "", liberarActivos: true },
  });

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      try {
        const [motivosList, tiposList] = await Promise.all([getMotivosEgresoAction(), getTiposNominaAction()]);
        setMotivos(motivosList);
        setTiposNomina(tiposList);
      } catch {
        setError("No fue posible cargar los catálogos del egreso.");
      }
    });
  }, []);

  const { data: pasivos, error: errorLista, isLoading, mutate } = useSWR<PasivoDTO[]>(
    `pasivos-${busqueda}`,
    () => getPasivosAction(busqueda || undefined),
  );

  const onSubmit = (data: ListadoPasivosFormType) => {
    startTransition(() => {
      setBusqueda(data.busqueda ?? "");
    });
  };

  const onProcesarEgreso = (data: ProcesarEgresoFormType) => {
    startTransition(async () => {
      setError(null);
      const result = await procesarEgresoAction({
        cedula: data.cedula,
        motivoMovimientoId: data.motivoMovimientoId,
        tipoNominaId: data.tipoNominaId,
        liberarActivos: data.liberarActivos ?? true,
      });
      if (result && typeof result === "object" && "error" in result) {
        setError((result as { error: string }).error);
        return;
      }
      egresoForm.reset({ cedula: "", liberarActivos: true });
      mutate();
      setBusqueda("");
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Trabajadores Pasivos</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Procesar egreso</CardTitle>
          <CardDescription>
            Transforme un trabajador activo en pasivo (jubilación/pensión).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={egresoForm.handleSubmit(onProcesarEgreso)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
            noValidate
          >
            <Field data-invalid={!!egresoForm.formState.errors.cedula}>
              <Label htmlFor="egresoCedula">Cédula</Label>
              <Input
                {...egresoForm.register("cedula")}
                id="egresoCedula"
                placeholder="Ej. V-12345678"
                aria-invalid={!!egresoForm.formState.errors.cedula}
              />
              {egresoForm.formState.errors.cedula && (
                <p role="alert" className="text-sm text-destructive">
                  {egresoForm.formState.errors.cedula.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!egresoForm.formState.errors.motivoMovimientoId}>
              <Label htmlFor="egresoMotivo">Motivo</Label>
              <CatalogSelect
                id="egresoMotivo"
                value={egresoForm.watch("motivoMovimientoId") ? String(egresoForm.watch("motivoMovimientoId")) : undefined}
                onChange={(v) => egresoForm.setValue("motivoMovimientoId", v)}
                options={motivos}
                placeholder="Seleccione un motivo"
                ariaInvalid={!!egresoForm.formState.errors.motivoMovimientoId}
              />
              {egresoForm.formState.errors.motivoMovimientoId && (
                <p role="alert" className="text-sm text-destructive">
                  {egresoForm.formState.errors.motivoMovimientoId.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!egresoForm.formState.errors.tipoNominaId}>
              <Label htmlFor="egresoTipoNomina">Tipo de nómina</Label>
              <CatalogSelect
                id="egresoTipoNomina"
                value={egresoForm.watch("tipoNominaId") ? String(egresoForm.watch("tipoNominaId")) : undefined}
                onChange={(v) => egresoForm.setValue("tipoNominaId", v)}
                options={tiposNomina}
                placeholder="Seleccione un tipo de nómina"
                ariaInvalid={!!egresoForm.formState.errors.tipoNominaId}
              />
              {egresoForm.formState.errors.tipoNominaId && (
                <p role="alert" className="text-sm text-destructive">
                  {egresoForm.formState.errors.tipoNominaId.message}
                </p>
              )}
            </Field>
            <Field className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={egresoForm.watch("liberarActivos") ?? true}
                  onCheckedChange={(c) => egresoForm.setValue("liberarActivos", c === true)}
                />
                Liberar activos
              </label>
            </Field>
            <div className="md:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
                Procesar egreso
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
            ) : errorLista ? (
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
