"use client";

/**
 * Página de cargas familiares: búsqueda por empleado, CRUD y documentos.
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { FileText, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

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

import type { DocumentoFamiliarDTO, FamiliarDTO, GuardarFamiliarInputDTO } from "../application/dtos/familiar-dto";
import {
  actualizarFamiliarAction,
  crearFamiliarAction,
  eliminarFamiliarAction,
  getDocumentosFamiliarAction,
  getFamiliaresPorEmpleadoAction,
} from "../infrastructure/actions/familiares-actions";
import {
  familiaresPorEmpleadoSchema,
  familiarSchema,
  type FamiliarFormType,
} from "./schema/schema-familiar";

export default function FamiliaresPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "familiares.crear");
  const puedeEditar = tienePermiso(permisos, "familiares.editar");
  const puedeEliminar = tienePermiso(permisos, "familiares.eliminar");

  const [familiares, setFamiliares] = useState<FamiliarDTO[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoFamiliarDTO[]>([]);
  const [empleadoCedula, setEmpleadoCedula] = useState<string>("");
  const [editando, setEditando] = useState<FamiliarDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const busquedaForm = useForm<{ cedula: string }>({
    resolver: zodResolver(familiaresPorEmpleadoSchema),
    defaultValues: { cedula: "" },
  });

  const form = useForm<FamiliarFormType>({
    resolver: zodResolver(familiarSchema),
    defaultValues: { mismoEnte: false, heredero: false },
  });

  const cargarFamiliares = (cedula: string) => {
    startTransition(async () => {
      setError(null);
      try {
        const resultado = await getFamiliaresPorEmpleadoAction(cedula);
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          return;
        }
        setFamiliares(resultado as FamiliarDTO[]);
      } catch {
        setError("No fue posible cargar las cargas familiares.");
      }
    });
  };

  const onBuscar = (data: { cedula: string }) => {
    setEmpleadoCedula(data.cedula);
    setDocumentos([]);
    cargarFamiliares(data.cedula);
  };

  const resetForm = () => {
    setEditando(null);
    form.reset({ mismoEnte: false, heredero: false });
  };

  const onGuardar = (data: FamiliarFormType) => {
    startTransition(async () => {
      setError(null);
      const input = { ...data, empleadoCedula };
      let resultado;
      if (editando) {
        resultado = await actualizarFamiliarAction(editando.id, input as Partial<GuardarFamiliarInputDTO>);
      } else if (empleadoCedula) {
        resultado = await crearFamiliarAction(input as GuardarFamiliarInputDTO);
      } else {
        setError("Primero busque un empleado para asociar la carga.");
        return;
      }
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      resetForm();
      cargarFamiliares(empleadoCedula);
    });
  };

  const onEliminar = (id: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await eliminarFamiliarAction(id);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      cargarFamiliares(empleadoCedula);
    });
  };

  const onEditar = (f: FamiliarDTO) => {
    setEditando(f);
    form.reset({
      cedulaFamiliar: f.cedulaFamiliar,
      primerNombre: f.primerNombre,
      segundoNombre: f.segundoNombre,
      primerApellido: f.primerApellido,
      segundoApellido: f.segundoApellido,
      parentescoId: f.parentescoId,
      fechaNacimiento: f.fechaNacimiento,
      sexoId: f.sexoId,
      mismoEnte: f.mismoEnte,
      heredero: f.heredero,
      observaciones: f.observaciones,
    });
  };

  const onDocumentos = (id: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await getDocumentosFamiliarAction(id);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setDocumentos(resultado as DocumentoFamiliarDTO[]);
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Users className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Cargas Familiares</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Buscar empleado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={busquedaForm.handleSubmit(onBuscar)} className="flex flex-col gap-4 md:max-w-md" noValidate>
            <Field data-invalid={!!busquedaForm.formState.errors.cedula}>
              <Label htmlFor="cedula">Cédula del empleado</Label>
              <Input id="cedula" placeholder="Ej. 12345678" {...busquedaForm.register("cedula")} aria-invalid={!!busquedaForm.formState.errors.cedula} />
              {busquedaForm.formState.errors.cedula && <p role="alert" className="text-sm text-destructive">{busquedaForm.formState.errors.cedula.message}</p>}
            </Field>
            <div>
              <Button type="submit" disabled={isPending}>
                <Users className="size-4" aria-hidden="true" /> Buscar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {(puedeCrear || puedeEditar) && (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{editando ? "Editar carga familiar" : "Nueva carga familiar"}</CardTitle>
          <CardDescription>{empleadoCedula ? `Empleado: ${empleadoCedula}` : "Busque un empleado primero."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field>
                <Label htmlFor="cedulaFamiliar">Cédula del familiar</Label>
                <Input id="cedulaFamiliar" {...form.register("cedulaFamiliar")} />
              </Field>
              <Field data-invalid={!!form.formState.errors.primerNombre}>
                <Label htmlFor="primerNombre">Primer nombre</Label>
                <Input id="primerNombre" {...form.register("primerNombre")} aria-invalid={!!form.formState.errors.primerNombre} />
              </Field>
              <Field>
                <Label htmlFor="segundoNombre">Segundo nombre</Label>
                <Input id="segundoNombre" {...form.register("segundoNombre")} />
              </Field>
              <Field data-invalid={!!form.formState.errors.primerApellido}>
                <Label htmlFor="primerApellido">Primer apellido</Label>
                <Input id="primerApellido" {...form.register("primerApellido")} aria-invalid={!!form.formState.errors.primerApellido} />
              </Field>
              <Field>
                <Label htmlFor="segundoApellido">Segundo apellido</Label>
                <Input id="segundoApellido" {...form.register("segundoApellido")} />
              </Field>
              <Field data-invalid={!!form.formState.errors.parentescoId}>
                <Label htmlFor="parentescoId">Parentesco (id)</Label>
                <Input type="number" id="parentescoId" {...form.register("parentescoId", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.parentescoId} />
              </Field>
              <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
                <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
                <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
              </Field>
              <Field data-invalid={!!form.formState.errors.sexoId}>
                <Label htmlFor="sexoId">Sexo (id)</Label>
                <Input type="number" id="sexoId" {...form.register("sexoId", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.sexoId} />
              </Field>
              <Field>
                <Label htmlFor="observaciones">Observaciones</Label>
                <Input id="observaciones" {...form.register("observaciones")} />
              </Field>
            </div>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("mismoEnte")} className="size-4" /> Mismo ente
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register("heredero")} className="size-4" /> Heredero
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                <Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Crear"}
              </Button>
              {editando && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cédula</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Parentesco</TableHead>
              <TableHead>Nacimiento</TableHead>
              <TableHead>Mismo ente</TableHead>
              <TableHead>Heredero</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {familiares.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">Sin cargas familiares. Busque un empleado.</TableCell></TableRow>
            ) : (
              familiares.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.cedulaFamiliar ?? "—"}</TableCell>
                  <TableCell>{f.primerNombre} {f.segundoNombre ?? ""} {f.primerApellido} {f.segundoApellido ?? ""}</TableCell>
                  <TableCell><Badge variant="secondary">{f.parentescoNombre}</Badge></TableCell>
                  <TableCell>{f.fechaNacimiento}</TableCell>
                  <TableCell>{f.mismoEnte ? "Sí" : "No"}</TableCell>
                  <TableCell>{f.heredero ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {puedeEditar && (
                        <Button variant="ghost" size="sm" onClick={() => onEditar(f)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                      )}
                      {puedeEliminar && (
                        <Button variant="ghost" size="sm" onClick={() => onEliminar(f.id)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onDocumentos(f.id)} disabled={isPending}><FileText className="size-4" aria-hidden="true" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {documentos.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Fecha de subida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.tipoDocumento}</TableCell>
                  <TableCell>{d.rutaArchivo}</TableCell>
                  <TableCell>{d.fechaSubida}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
