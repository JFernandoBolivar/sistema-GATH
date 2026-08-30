"use client";

/**
 * Página de administración de la estructura organizacional.
 * Mantiene la cascada de lectura (explorar) y suma el CRUD de los cinco
 * niveles: dependencia, dirección general, dirección de línea, coordinación
 * y organismo adscrito. Cliente + react-hook-form + zodResolver; las
 * acciones van envueltas en useTransition (R8) y se delegan a las Server
 * Actions del módulo (R7). Opera exclusivamente con DTOs (R5) y no importa
 * de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Loader2,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
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
  actualizarCoordinacionAction,
  actualizarDependenciaAction,
  actualizarDireccionGeneralAction,
  actualizarDireccionLineaAction,
  actualizarOrganismoAdscritoAction,
  crearCoordinacionAction,
  crearDependenciaAction,
  crearDireccionGeneralAction,
  crearDireccionLineaAction,
  crearOrganismoAdscritoAction,
  eliminarCoordinacionAction,
  eliminarDependenciaAction,
  eliminarDireccionGeneralAction,
  eliminarDireccionLineaAction,
  eliminarOrganismoAdscritoAction,
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getOrganismosAdscritosAction,
} from "../infrastructure/actions/organizacion-actions";
import {
  coordinacionSchema,
  dependenciaSchema,
  direccionGeneralSchema,
  direccionLineaSchema,
  organismoAdscritoSchema,
  organizacionFilterSchema,
  type CoordinacionFormType,
  type DependenciaFormType,
  type DireccionGeneralFormType,
  type DireccionLineaFormType,
  type OrganizacionFilterType,
  type OrganismoAdscritoFormType,
} from "./schema/schema-organizacion";

type Resultado = { error?: string; success?: boolean };
const tieneError = (r: unknown): r is Resultado => !!r && typeof r === "object" && "error" in r;

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
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DependenciaAdmin({ dependencias, onChanged }: { dependencias: DependenciaDTO[]; onChanged: () => void }) {
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
                        <Button variant="ghost" size="sm" onClick={() => editar(d)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarDependenciaAction(d.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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

function DireccionGeneralAdmin({ dependencias, items, onChanged }: { dependencias: DependenciaDTO[]; items: DireccionGeneralDTO[]; onChanged: () => void }) {
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
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dependencia id</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin direcciones generales.</TableCell></TableRow>
              ) : (
                items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.codigo ?? "—"}</TableCell>
                    <TableCell>{d.nombre}</TableCell>
                    <TableCell>{d.dependenciaId ?? "—"}</TableCell>
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

function DireccionLineaAdmin({ dirGenerales, items, onChanged }: { dirGenerales: DireccionGeneralDTO[]; items: DireccionLineaDTO[]; onChanged: () => void }) {
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
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dir. general id</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin direcciones de línea.</TableCell></TableRow>
              ) : (
                items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.codigo ?? "—"}</TableCell>
                    <TableCell>{d.nombre}</TableCell>
                    <TableCell>{d.direccionGeneralId ?? "—"}</TableCell>
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

function CoordinacionAdmin({ dirLinea, items, onChanged }: { dirLinea: DireccionLineaDTO[]; items: CoordinacionDTO[]; onChanged: () => void }) {
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{editando ? "Editar coordinación" : "Nueva coordinación"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Dir. línea id</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell className="h-10 text-center text-muted-foreground">Sin coordinaciones.</TableCell></TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.codigo ?? "—"}</TableCell>
                    <TableCell>{c.nombre}</TableCell>
                    <TableCell>{c.direccionLineaId ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editar(c)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { startTransition(async () => { const r = await eliminarCoordinacionAction(c.id); if (tieneError(r)) setError(r.error ?? "Error."); else onChanged(); }); }} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
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

function OrganismoAdmin({ items, onChanged }: { items: OrganismoAdscritoDTO[]; onChanged: () => void }) {
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

  const cargarAdmin = () => {
    startTransition(async () => {
      setError(null);
      try {
        const [deps, dgs, dls, cos, orgs] = await Promise.all([
          getDependenciasAction(),
          getDireccionesGeneralesAction(),
          getDireccionesLineaAction(),
          getCoordinacionesAction(),
          getOrganismosAdscritosAction(),
        ]);
        setDependencias(deps);
        setDirGenerales(dgs);
        setDirLinea(dls);
        setCoordinaciones(cos);
        setOrganismos(orgs);
      } catch {
        setError("No fue posible cargar la administración.");
      }
    });
  };

  useEffect(() => {
    cargarDependencias();
    cargarOrganismos();
  }, []);

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

      <Tabs defaultValue="explorar" onValueChange={(v) => { if (v === "administrar") cargarAdmin(); }}>
        <TabsList>
          <TabsTrigger value="explorar">Explorar</TabsTrigger>
          <TabsTrigger value="administrar">Administrar</TabsTrigger>
        </TabsList>

        <TabsContent value="explorar" className="flex flex-col gap-4">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Coordinaciones</TableHead></TableRow>
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
        </TabsContent>

        <TabsContent value="administrar" className="flex flex-col gap-6">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DependenciaAdmin dependencias={dependencias} onChanged={cargarAdmin} />
          <DireccionGeneralAdmin dependencias={dependencias} items={dirGenerales} onChanged={cargarAdmin} />
          <DireccionLineaAdmin dirGenerales={dirGenerales} items={dirLinea} onChanged={cargarAdmin} />
          <CoordinacionAdmin dirLinea={dirLinea} items={coordinaciones} onChanged={cargarAdmin} />
          <OrganismoAdmin items={organismos} onChanged={cargarAdmin} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
