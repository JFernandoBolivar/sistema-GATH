"use client";

/**
 * CRUD de direcciones de línea — uno de los "4 flujos separados" de
 * ubicación administrativa, en su propia ruta
 * (`/organizacion/direcciones-linea`).
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

import type { DireccionGeneralDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  actualizarDireccionLineaAction,
  crearDireccionLineaAction,
  eliminarDireccionLineaAction,
} from "../infrastructure/actions/organizacion-actions";
import { direccionLineaSchema, type DireccionLineaFormType } from "./schema/schema-organizacion";

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

export default function DireccionLineaAdmin({ dirGenerales, items, onChanged }: { dirGenerales: DireccionGeneralDTO[]; items: DireccionLineaDTO[]; onChanged: () => void }) {
  const [editando, setEditando] = useState<DireccionLineaDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DireccionLineaFormType>({ resolver: zodResolver(direccionLineaSchema), defaultValues: { codigo: "", nombre: "", direccionGeneralId: null } });

  const guardar = (data: DireccionLineaFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { ...data, direccionGeneralId: data.direccionGeneralId ?? null };
      const resultado = editando
        ? await actualizarDireccionLineaAction(editando.id, input)
        : await crearDireccionLineaAction(input);
      if (tieneError(resultado)) { setError(resultado.error ?? "Error desconocido."); return; }
      setEditando(null);
      form.reset({ codigo: "", nombre: "", direccionGeneralId: null });
      onChanged();
    });
  };

  const editar = (d: DireccionLineaDTO) => {
    setEditando(d);
    form.reset({ codigo: d.codigo ?? "", nombre: d.nombre, direccionGeneralId: d.direccionGeneralId });
  };

  const nombreDireccionGeneral = (id: number | null) => dirGenerales.find((d) => d.id === id)?.nombre ?? "—";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar dirección de línea" : "Nueva dirección de línea"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field data-invalid={!!form.formState.errors.codigo}>
              <Label htmlFor="dlCodigo">Código</Label>
              <Input id="dlCodigo" {...form.register("codigo")} aria-invalid={!!form.formState.errors.codigo} />
            </Field>
            <Field data-invalid={!!form.formState.errors.nombre}>
              <Label htmlFor="dlNombre">Nombre</Label>
              <Input id="dlNombre" {...form.register("nombre")} aria-invalid={!!form.formState.errors.nombre} />
            </Field>
            <Field data-invalid={!!form.formState.errors.direccionGeneralId}>
              <Label htmlFor="dlDirGeneral">Dirección general</Label>
              <CatalogSelect
                id="dlDirGeneral"
                value={form.watch("direccionGeneralId") ? String(form.watch("direccionGeneralId")) : undefined}
                onChange={(v) => form.setValue("direccionGeneralId", v)}
                options={dirGenerales}
                placeholder="Seleccione dirección general"
                ariaInvalid={!!form.formState.errors.direccionGeneralId}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}><Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}</Button>
            {editando && <Button type="button" variant="outline" onClick={() => { setEditando(null); form.reset({ codigo: "", nombre: "", direccionGeneralId: null }); }}>Cancelar</Button>}
          </div>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dirección general</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin direcciones de línea.</TableCell></TableRow>
              ) : (
                items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.codigo ?? "—"}</TableCell>
                    <TableCell>{d.nombre}</TableCell>
                    <TableCell>{nombreDireccionGeneral(d.direccionGeneralId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editar(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarDireccionLineaAction(d.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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
