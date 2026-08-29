"use client";

/**
 * Página de consulta de la estructura organizacional (solo lectura).
 * Cliente + react-hook-form + zodResolver; las consultas van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, Network, RefreshCw } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
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

import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
  OrganismoAdscritoDTO,
} from "../application/dtos/organizacion-dto";
import {
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getOrganismosAdscritosAction,
} from "../infrastructure/actions/organizacion-actions";
import {
  organizacionFilterSchema,
  type OrganizacionFilterType,
} from "./schema/schema-organizacion";

export default function OrganizacionPage() {
  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLinea, setDirLinea] = useState<DireccionLineaDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<CoordinacionDTO[]>([]);
  const [organismos, setOrganismos] = useState<OrganismoAdscritoDTO[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<OrganizacionFilterType>({
    resolver: zodResolver(organizacionFilterSchema),
    defaultValues: { dependenciaId: undefined, direccionGeneralId: undefined, direccionLineaId: undefined },
  });

  const cargar = (fn: () => Promise<unknown>, setter: (d: never[]) => void) => {
    startTransition(async () => {
      setError(null);
      try {
        setter((await fn()) as never[]);
      } catch {
        setError("No fue posible cargar la información de organización.");
      }
    });
  };

  const cargarDependencias = () => cargar(getDependenciasAction, setDependencias);
  const cargarOrganismos = () => cargar(getOrganismosAdscritosAction, setOrganismos);

  const onDependencia = (dependenciaId: number) => {
    form.setValue("dependenciaId", dependenciaId);
    form.setValue("direccionGeneralId", undefined);
    form.setValue("direccionLineaId", undefined);
    setDirGenerales([]);
    setDirLinea([]);
    setCoordinaciones([]);
    cargar(() => getDireccionesGeneralesAction(dependenciaId), setDirGenerales);
  };

  const onDireccionGeneral = (direccionGeneralId: number) => {
    form.setValue("direccionGeneralId", direccionGeneralId);
    form.setValue("direccionLineaId", undefined);
    setDirLinea([]);
    setCoordinaciones([]);
    cargar(() => getDireccionesLineaAction(direccionGeneralId), setDirLinea);
  };

  const onDireccionLinea = (direccionLineaId: number) => {
    form.setValue("direccionLineaId", direccionLineaId);
    setCoordinaciones([]);
    cargar(() => getCoordinacionesAction(direccionLineaId), setCoordinaciones);
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Organización</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Explorar estructura</CardTitle>
          <CardDescription>
            Seleccione los niveles para ver jerarquías y organismos adscritos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <Label htmlFor="dependenciaId">Dependencia</Label>
              <Select value={form.watch("dependenciaId")?.toString() ?? ""} onValueChange={(v) => onDependencia(Number(v))}>
                <SelectTrigger id="dependenciaId">
                  <SelectValue placeholder="Seleccione una dependencia" />
                </SelectTrigger>
                <SelectContent>
                  {dependencias.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="direccionGeneralId">Dirección general</Label>
              <Select value={form.watch("direccionGeneralId")?.toString() ?? ""} onValueChange={(v) => onDireccionGeneral(Number(v))}>
                <SelectTrigger id="direccionGeneralId">
                  <SelectValue placeholder={dirGenerales.length ? "Seleccione" : "Seleccione una dependencia primero"} />
                </SelectTrigger>
                <SelectContent>
                  {dirGenerales.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="direccionLineaId">Dirección de línea</Label>
              <Select value={form.watch("direccionLineaId")?.toString() ?? ""} onValueChange={(v) => onDireccionLinea(Number(v))}>
                <SelectTrigger id="direccionLineaId">
                  <SelectValue placeholder={dirLinea.length ? "Seleccione" : "Seleccione una dirección general primero"} />
                </SelectTrigger>
                <SelectContent>
                  {dirLinea.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={cargarDependencias} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Network className="size-4" aria-hidden="true" />}
              Cargar dependencias
            </Button>
            <Button type="button" variant="outline" onClick={cargarOrganismos} disabled={isPending}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Organismos adscritos
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coordinaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coordinaciones.length === 0 ? (
                <TableRow><TableCell className="h-16 text-center text-muted-foreground">Sin coordenaciones en el nivel seleccionado.</TableCell></TableRow>
              ) : (
                coordinaciones.map((c) => (
                  <TableRow key={c.id}><TableCell>{c.nombre}</TableCell></TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Organismos adscritos</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {organismos.length === 0 ? (
                <TableRow><TableCell className="h-16 text-center text-muted-foreground">Sin organismos adscritos.</TableCell></TableRow>
              ) : (
                organismos.map((o) => (
                  <TableRow key={o.id}><TableCell>{o.nombre}</TableCell></TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
