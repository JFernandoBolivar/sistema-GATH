"use client";

/**
 * CRUD de dependencias — uno de los "4 flujos separados" de ubicación
 * administrativa (dependencia, dirección general, línea, coordinación),
 * cada uno en su propia ruta (`/organizacion/dependencias`), paridad
 * estructural con el legado (`crear-ubicacion/`+`actualizar-ubicacion/`
 * separados de los otros 3 niveles).
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

import type { DependenciaDTO } from "../application/dtos/organizacion-dto";
import {
  actualizarDependenciaAction,
  crearDependenciaAction,
  eliminarDependenciaAction,
} from "../infrastructure/actions/organizacion-actions";
import { dependenciaSchema, type DependenciaFormType } from "./schema/schema-organizacion";

type Resultado = { error?: string; success?: boolean };
const tieneError = (r: unknown): r is Resultado => !!r && typeof r === "object" && "error" in r;

export default function DependenciaAdmin({ dependencias, onChanged }: { dependencias: DependenciaDTO[]; onChanged: () => void }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "organizacion.crear");
  const puedeEditar = tienePermiso(permisos, "organizacion.editar");
  const puedeEliminar = tienePermiso(permisos, "organizacion.eliminar");

  const [editando, setEditando] = useState<DependenciaDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DependenciaFormType>({ resolver: zodResolver(dependenciaSchema), defaultValues: { codigo: "", nombre: "" } });

  const guardar = (data: DependenciaFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = editando
        ? await actualizarDependenciaAction(editando.id, data)
        : await crearDependenciaAction(data);
      if (tieneError(resultado)) { setError(resultado.error ?? "Error desconocido."); return; }
      setEditando(null);
      form.reset({ codigo: "", nombre: "" });
      onChanged();
    });
  };

  const editar = (d: DependenciaDTO) => {
    setEditando(d);
    form.reset({ codigo: d.codigo ?? "", nombre: d.nombre });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar dependencia" : "Nueva dependencia"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(editando ? puedeEditar : puedeCrear) && (
          <form onSubmit={form.handleSubmit(guardar)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.codigo}>
                <Label htmlFor="depCodigo">Código</Label>
                <Input id="depCodigo" {...form.register("codigo")} aria-invalid={!!form.formState.errors.codigo} />
              </Field>
              <Field data-invalid={!!form.formState.errors.nombre}>
                <Label htmlFor="depNombre">Nombre</Label>
                <Input id="depNombre" {...form.register("nombre")} aria-invalid={!!form.formState.errors.nombre} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}><Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}</Button>
              {editando && <Button type="button" variant="outline" onClick={() => { setEditando(null); form.reset({ codigo: "", nombre: "" }); }}>Cancelar</Button>}
            </div>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {dependencias.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin dependencias.</TableCell></TableRow>
              ) : (
                dependencias.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.codigo ?? "—"}</TableCell>
                    <TableCell>{d.nombre}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {puedeEditar && (
                          <Button variant="ghost" size="sm" onClick={() => editar(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        )}
                        {puedeEliminar && (
                          <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarDependenciaAction(d.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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
