"use client";

/**
 * Página de personal: listado con búsqueda, registro/edición y subida de foto.
 * Cliente + react-hook-form + zodResolver; las acciones van envueltas en
 * useTransition (R8) y se delegan a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2, Pencil, Search, UserPlus, Users } from "lucide-react";

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

import type { EmpleadoDTO, GuardarEmpleadoInputDTO } from "../application/dtos/empleado-dto";
import {
  actualizarEmpleadoAction,
  getEmpleadoPorCedulaAction,
  getEmpleadosAction,
  registrarEmpleadoAction,
  subirFotoEmpleadoAction,
} from "../infrastructure/actions/personal-actions";
import {
  empleadoCedulaSchema,
  empleadoSchema,
  type EmpleadoFormType,
  listadoEmpleadosSchema,
  type ListadoEmpleadosFormType,
} from "./schema/schema-empleado";

export default function PersonalPage() {
  const [empleados, setEmpleados] = useState<EmpleadoDTO[]>([]);
  const [editando, setEditando] = useState<EmpleadoDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busquedaForm = useForm<ListadoEmpleadosFormType>({ resolver: zodResolver(listadoEmpleadosSchema), defaultValues: {} });
  const form = useForm<EmpleadoFormType>({ resolver: zodResolver(empleadoSchema), defaultValues: {} });

  const cargar = (busqueda?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        setEmpleados(await getEmpleadosAction({ busqueda }));
      } catch {
        setError("No fue posible cargar el personal.");
      }
    });
  };

  useEffect(() => {
    cargar();
  }, []);

  const onBuscar = (data: ListadoEmpleadosFormType) => cargar(data.busqueda ?? undefined);

  const resetForm = () => {
    setEditando(null);
    form.reset({});
  };

  const onGuardar = (data: EmpleadoFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = editando
        ? await actualizarEmpleadoAction(editando.cedula, data as Partial<GuardarEmpleadoInputDTO>)
        : await registrarEmpleadoAction(data as GuardarEmpleadoInputDTO);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      resetForm();
      cargar();
    });
  };

  const onBuscarParaEditar = (cedula: string) => {
    startTransition(async () => {
      setError(null);
      const resultado = await getEmpleadoPorCedulaAction(cedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      const emp = resultado as EmpleadoDTO;
      setEditando(emp);
      form.reset({
        cedula: emp.cedula,
        nombres: emp.nombres,
        apellidos: emp.apellidos,
        sexoId: emp.sexoId,
        fechaNacimiento: emp.fechaNacimiento ?? undefined,
        correo: emp.correo,
        telefonoMovil: emp.telefonoMovil,
        telefonoHabitacion: emp.telefonoHabitacion,
        estadoCivilId: emp.estadoCivilId ?? undefined,
        carnetPatria: emp.carnetPatria,
      });
    });
  };

  const onSubirFoto = (cedula: string) => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setError(null);
      try {
        await subirFotoEmpleadoAction(cedula, formData);
        cargar();
      } catch {
        setError("No fue posible subir la foto.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Users className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>{editando ? "Editar empleado" : "Registrar empleado"}</CardTitle>
          {editando && <CardDescription>Editando a {editando.nombreCompleto}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onGuardar)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field data-invalid={!!form.formState.errors.cedula}>
                <Label htmlFor="cedula">Cédula</Label>
                <Input id="cedula" {...form.register("cedula")} aria-invalid={!!form.formState.errors.cedula} />
              </Field>
              <Field data-invalid={!!form.formState.errors.nombres}>
                <Label htmlFor="nombres">Nombres</Label>
                <Input id="nombres" {...form.register("nombres")} aria-invalid={!!form.formState.errors.nombres} />
              </Field>
              <Field data-invalid={!!form.formState.errors.apellidos}>
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input id="apellidos" {...form.register("apellidos")} aria-invalid={!!form.formState.errors.apellidos} />
              </Field>
              <Field data-invalid={!!form.formState.errors.sexoId}>
                <Label htmlFor="sexoId">Sexo (id)</Label>
                <Input type="number" id="sexoId" {...form.register("sexoId", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.sexoId} />
              </Field>
              <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
                <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
                <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
              </Field>
              <Field>
                <Label htmlFor="correo">Correo</Label>
                <Input id="correo" {...form.register("correo")} />
              </Field>
              <Field>
                <Label htmlFor="telefonoMovil">Teléfono móvil</Label>
                <Input id="telefonoMovil" {...form.register("telefonoMovil")} />
              </Field>
              <Field>
                <Label htmlFor="telefonoHabitacion">Teléfono habitación</Label>
                <Input id="telefonoHabitacion" {...form.register("telefonoHabitacion")} />
              </Field>
              <Field>
                <Label htmlFor="estadoCivilId">Estado civil (id)</Label>
                <Input type="number" id="estadoCivilId" {...form.register("estadoCivilId", { valueAsNumber: true })} />
              </Field>
              <Field>
                <Label htmlFor="carnetPatria">Carnet de la patria</Label>
                <Input id="carnetPatria" {...form.register("carnetPatria")} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isPending}>
                <UserPlus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Registrar"}
              </Button>
              {editando && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Buscar / editar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={busquedaForm.handleSubmit(onBuscar)} className="flex items-end gap-2" noValidate>
            <Field>
              <Label htmlFor="busqueda">Búsqueda</Label>
              <Input id="busqueda" placeholder="Cédula o nombre" {...busquedaForm.register("busqueda")} />
            </Field>
            <Button type="submit" variant="outline" disabled={isPending}><Search className="size-4" aria-hidden="true" /> Buscar</Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
          </form>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cédula</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Sexo</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>APN</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : empleados.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Sin empleados.</TableCell></TableRow>
            ) : (
              empleados.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.cedula}</TableCell>
                  <TableCell>{e.nombreCompleto}</TableCell>
                  <TableCell><Badge variant="secondary">{e.sexoNombre}</Badge></TableCell>
                  <TableCell>{e.correo ?? "—"}</TableCell>
                  <TableCell>{e.totalAnosApn}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onBuscarParaEditar(e.cedula)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onSubirFoto(e.cedula)} disabled={isPending}><Camera className="size-4" aria-hidden="true" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
