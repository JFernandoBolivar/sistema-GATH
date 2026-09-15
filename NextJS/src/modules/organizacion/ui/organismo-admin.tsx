"use client";

/**
 * CRUD de organismos adscritos. En el legado esta gestión vive en un módulo
 * separado ("retroalimentacion"), no dentro de `ubicacion-administrativa`;
 * en el backend nuevo pertenece a `apps.organizacion` — se mantiene aquí
 * como pestaña del listado principal en vez de inventar una ruta/módulo
 * nuevo fuera del alcance de este ajuste de capa `ui/`.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { OrganismoAdscritoDTO } from "../application/dtos/organizacion-dto";
import {
  actualizarOrganismoAdscritoAction,
  crearOrganismoAdscritoAction,
  eliminarOrganismoAdscritoAction,
} from "../infrastructure/actions/organizacion-actions";
import { organismoAdscritoSchema, type OrganismoAdscritoFormType } from "./schema/schema-organizacion";

type Resultado = { error?: string; success?: boolean };
const tieneError = (r: unknown): r is Resultado => !!r && typeof r === "object" && "error" in r;

export default function OrganismoAdmin({ items, onChanged }: { items: OrganismoAdscritoDTO[]; onChanged: () => void }) {
  const [editando, setEditando] = useState<OrganismoAdscritoDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<OrganismoAdscritoFormType>({ resolver: zodResolver(organismoAdscritoSchema), defaultValues: { nombre: "", parentId: null } });

  const guardar = (data: OrganismoAdscritoFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { ...data, parentId: data.parentId ?? null };
      const resultado = editando
        ? await actualizarOrganismoAdscritoAction(editando.id, input)
        : await crearOrganismoAdscritoAction(input);
      if (tieneError(resultado)) { setError(resultado.error ?? "Error desconocido."); return; }
      setEditando(null);
      form.reset({ nombre: "", parentId: null });
      onChanged();
    });
  };

  const editar = (o: OrganismoAdscritoDTO) => {
    setEditando(o);
    form.reset({ nombre: o.nombre, parentId: o.parentId ?? null });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar organismo adscrito" : "Nuevo organismo adscrito"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field data-invalid={!!form.formState.errors.nombre}>
              <Label htmlFor="orgNombre">Nombre</Label>
              <Input id="orgNombre" {...form.register("nombre")} aria-invalid={!!form.formState.errors.nombre} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}><Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}</Button>
            {editando && <Button type="button" variant="outline" onClick={() => { setEditando(null); form.reset({ nombre: "", parentId: null }); }}>Cancelar</Button>}
          </div>
        </form>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Parent id</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin organismos adscritos.</TableCell></TableRow>
              ) : (
                items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nombre}</TableCell>
                    <TableCell>{o.parentId ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editar(o)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarOrganismoAdscritoAction(o.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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
