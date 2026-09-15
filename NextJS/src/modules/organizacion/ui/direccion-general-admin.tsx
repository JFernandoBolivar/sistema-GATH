"use client";

/**
 * CRUD de direcciones generales — uno de los "4 flujos separados" de
 * ubicación administrativa, en su propia ruta
 * (`/organizacion/direcciones-generales`).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
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

import type { DependenciaDTO, DireccionGeneralDTO } from "../application/dtos/organizacion-dto";
import {
  actualizarDireccionGeneralAction,
  crearDireccionGeneralAction,
  eliminarDireccionGeneralAction,
} from "../infrastructure/actions/organizacion-actions";
import { direccionGeneralSchema, type DireccionGeneralFormType } from "./schema/schema-organizacion";

type Resultado = { error?: string; success?: boolean };
const tieneError = (r: unknown): r is Resultado => !!r && typeof r === "object" && "error" in r;

function CatalogSelect({ id, value, onChange, options, placeholder, ariaInvalid }: {
  id: string;
  value: string | undefined;
  onChange: (v: number) => void;
  options: { id: number; nombre: string }[];
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
          <SelectItem key={o.id} value={String(o.id)}>{o.nombre}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function DireccionGeneralAdmin({ dependencias, items, onChanged }: { dependencias: DependenciaDTO[]; items: DireccionGeneralDTO[]; onChanged: () => void }) {
  const [editando, setEditando] = useState<DireccionGeneralDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DireccionGeneralFormType>({ resolver: zodResolver(direccionGeneralSchema), defaultValues: { codigo: "", nombre: "", dependenciaId: null } });

  const guardar = (data: DireccionGeneralFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { ...data, dependenciaId: data.dependenciaId ?? null };
      const resultado = editando
        ? await actualizarDireccionGeneralAction(editando.id, input)
        : await crearDireccionGeneralAction(input);
      if (tieneError(resultado)) { setError(resultado.error ?? "Error desconocido."); return; }
      setEditando(null);
      form.reset({ codigo: "", nombre: "", dependenciaId: null });
      onChanged();
    });
  };

  const editar = (d: DireccionGeneralDTO) => {
    setEditando(d);
    form.reset({ codigo: d.codigo ?? "", nombre: d.nombre, dependenciaId: d.dependenciaId });
  };

  const nombreDependencia = (id: number | null) => dependencias.find((d) => d.id === id)?.nombre ?? "—";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar dirección general" : "Nueva dirección general"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field data-invalid={!!form.formState.errors.codigo}>
              <Label htmlFor="dgCodigo">Código</Label>
              <Input id="dgCodigo" {...form.register("codigo")} aria-invalid={!!form.formState.errors.codigo} />
            </Field>
            <Field data-invalid={!!form.formState.errors.nombre}>
              <Label htmlFor="dgNombre">Nombre</Label>
              <Input id="dgNombre" {...form.register("nombre")} aria-invalid={!!form.formState.errors.nombre} />
            </Field>
            <Field data-invalid={!!form.formState.errors.dependenciaId}>
              <Label htmlFor="dgDependencia">Dependencia</Label>
              <CatalogSelect
                id="dgDependencia"
                value={form.watch("dependenciaId") ? String(form.watch("dependenciaId")) : undefined}
                onChange={(v) => form.setValue("dependenciaId", v)}
                options={dependencias}
                placeholder="Seleccione dependencia"
                ariaInvalid={!!form.formState.errors.dependenciaId}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}><Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}</Button>
            {editando && <Button type="button" variant="outline" onClick={() => { setEditando(null); form.reset({ codigo: "", nombre: "", dependenciaId: null }); }}>Cancelar</Button>}
          </div>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dependencia</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin direcciones generales.</TableCell></TableRow>
              ) : (
                items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.codigo ?? "—"}</TableCell>
                    <TableCell>{d.nombre}</TableCell>
                    <TableCell>{nombreDependencia(d.dependenciaId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editar(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarDireccionGeneralAction(d.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
