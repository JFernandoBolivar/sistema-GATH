"use client";

/**
 * CRUD de coordinaciones — uno de los "4 flujos separados" de ubicación
 * administrativa, en su propia ruta (`/organizacion/coordinaciones`).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
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

import type { CoordinacionDTO, DireccionLineaDTO } from "../application/dtos/organizacion-dto";
import {
  actualizarCoordinacionAction,
  crearCoordinacionAction,
  eliminarCoordinacionAction,
} from "../infrastructure/actions/organizacion-actions";
import { coordinacionSchema, type CoordinacionFormType } from "./schema/schema-organizacion";

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

export default function CoordinacionAdmin({ dirLinea, items, onChanged }: { dirLinea: DireccionLineaDTO[]; items: CoordinacionDTO[]; onChanged: () => void }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "organizacion.crear");
  const puedeEditar = tienePermiso(permisos, "organizacion.editar");
  const puedeEliminar = tienePermiso(permisos, "organizacion.eliminar");

  const [editando, setEditando] = useState<CoordinacionDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CoordinacionFormType>({ resolver: zodResolver(coordinacionSchema), defaultValues: { codigo: "", nombre: "", direccionLineaId: null } });

  const guardar = (data: CoordinacionFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { ...data, direccionLineaId: data.direccionLineaId ?? null };
      const resultado = editando
        ? await actualizarCoordinacionAction(editando.id, input)
        : await crearCoordinacionAction(input);
      if (tieneError(resultado)) { setError(resultado.error ?? "Error desconocido."); return; }
      setEditando(null);
      form.reset({ codigo: "", nombre: "", direccionLineaId: null });
      onChanged();
    });
  };

  const editar = (c: CoordinacionDTO) => {
    setEditando(c);
    form.reset({ codigo: c.codigo ?? "", nombre: c.nombre, direccionLineaId: c.direccionLineaId });
  };

  const nombreDireccionLinea = (id: number | null) => dirLinea.find((d) => d.id === id)?.nombre ?? "—";

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar coordinación" : "Nueva coordinación"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(editando ? puedeEditar : puedeCrear) && (
          <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field data-invalid={!!form.formState.errors.codigo}>
                <Label htmlFor="coCodigo">Código</Label>
                <Input id="coCodigo" {...form.register("codigo")} aria-invalid={!!form.formState.errors.codigo} />
              </Field>
              <Field data-invalid={!!form.formState.errors.nombre}>
                <Label htmlFor="coNombre">Nombre</Label>
                <Input id="coNombre" {...form.register("nombre")} aria-invalid={!!form.formState.errors.nombre} />
              </Field>
              <Field data-invalid={!!form.formState.errors.direccionLineaId}>
                <Label htmlFor="coDirLinea">Dirección de línea</Label>
                <CatalogSelect
                  id="coDirLinea"
                  value={form.watch("direccionLineaId") ? String(form.watch("direccionLineaId")) : undefined}
                  onChange={(v) => form.setValue("direccionLineaId", v)}
                  options={dirLinea}
                  placeholder="Seleccione dirección de línea"
                  ariaInvalid={!!form.formState.errors.direccionLineaId}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}><Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}</Button>
              {editando && <Button type="button" variant="outline" onClick={() => { setEditando(null); form.reset({ codigo: "", nombre: "", direccionLineaId: null }); }}>Cancelar</Button>}
            </div>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dirección de línea</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin coordinaciones.</TableCell></TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.codigo ?? "—"}</TableCell>
                    <TableCell>{c.nombre}</TableCell>
                    <TableCell>{nombreDireccionLinea(c.direccionLineaId)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {puedeEditar && (
                          <Button variant="ghost" size="sm" onClick={() => editar(c)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        )}
                        {puedeEliminar && (
                          <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarCoordinacionAction(c.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
                        )}
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
