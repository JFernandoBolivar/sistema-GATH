"use client";

/**
 * Página de usuarios del módulo identidad (Regla R5). Cliente +
 * react-hook-form + zodResolver; las acciones van envueltas en useTransition
 * (R8) y se delegan a las Server Actions del módulo (R7). Opera exclusivamente
 * con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type {
  DepartamentoDTO,
  PermisoDTO,
  RolDTO,
  UsuarioDTO,
} from "../application/dtos/usuario-dto";
import {
  actualizarRolAction,
  cambiarEstadoUsuarioAction,
  crearRolAction,
  editarUsuarioAction,
  eliminarRolAction,
  getDepartamentosAction,
  getPermisosAction,
  getRolesAction,
  listarUsuariosAction,
  registrarUsuarioAction,
} from "../infrastructure/actions/usuario-actions";
import {
  editarUsuarioSchema,
  rolSchema,
  usuarioFormSchema,
  usuariosFiltrosSchema,
  type RolFormType,
  type UsuarioFormType,
  type UsuariosFiltrosType,
} from "./schema/schema-usuario";

interface SelectOption {
  id: number;
  nombre: string;
}

function IdSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  allowNone,
}: {
  id: string;
  value: string | undefined;
  onChange: (v: number | null | undefined) => void;
  options: SelectOption[];
  placeholder: string;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ? (v === "__none" ? null : Number(v)) : undefined)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="__none">— Sin asignar —</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([]);
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [permisos, setPermisos] = useState<PermisoDTO[]>([]);
  const [editando, setEditando] = useState<UsuarioDTO | null>(null);
  const [editandoRol, setEditandoRol] = useState<RolDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filtroText, setFiltroText] = useState("");

  const rolOptions: SelectOption[] = roles.map((r) => ({ id: r.id, nombre: r.nombreRol }));

  const filtroForm = useForm<UsuariosFiltrosType>({
    resolver: zodResolver(usuariosFiltrosSchema),
    defaultValues: {},
  });
  const usuarioForm = useForm<UsuarioFormType>({
    resolver: zodResolver(usuarioFormSchema),
    defaultValues: {},
  });
  const rolForm = useForm<RolFormType>({
    resolver: zodResolver(rolSchema),
    defaultValues: {},
  });

  const cargarUsuarios = (filtros?: UsuariosFiltrosType) => {
    startTransition(async () => {
      setError(null);
      try {
        const resultado = await listarUsuariosAction({ busqueda: filtroText || undefined, ...filtros });
        setUsuarios(resultado);
      } catch {
        setError("No fue posible cargar los usuarios.");
      }
    });
  };

  const cargarRoles = () => {
    startTransition(async () => {
      setError(null);
      try {
        setRoles(await getRolesAction());
      } catch {
        setError("No fue posible cargar los roles.");
      }
    });
  };

  useEffect(() => {
    cargarUsuarios();
    startTransition(async () => {
      try {
        const [r, d, p] = await Promise.all([getRolesAction(), getDepartamentosAction(), getPermisosAction()]);
        setRoles(r);
        setDepartamentos(d);
        setPermisos(p);
      } catch {
        setError("No fue posible cargar los catálogos.");
      }
    });
  }, []);

  const onFiltro = (data: UsuariosFiltrosType) => {
    cargarUsuarios({
      departamentoId: data.departamentoId ?? undefined,
      rolId: data.rolId ?? undefined,
      isActive: data.isActive ?? undefined,
    });
  };

  const onGuardarUsuario = (data: UsuarioFormType) => {
    startTransition(async () => {
      setError(null);
      let resultado;
      if (editando) {
        const edicion = editarUsuarioSchema.safeParse(data);
        if (!edicion.success) {
          setError("Datos de edición inválidos. Revise los campos ingresados.");
          return;
        }
        resultado = await editarUsuarioAction(editando.id, {
          departamentoId: edicion.data.departamentoId ?? null,
          rolId: edicion.data.rolId ?? null,
          password: edicion.data.password?.trim() ? edicion.data.password.trim() : null,
        });
      } else {
        if (!data.password?.trim()) {
          setError("La contraseña es requerida para el alta de la cuenta.");
          return;
        }
        resultado = await registrarUsuarioAction({
          cedula: data.cedula,
          password: data.password.trim(),
          departamentoId: data.departamentoId ?? null,
          rolId: data.rolId ?? null,
        });
      }
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setEditando(null);
      usuarioForm.reset({});
      cargarUsuarios();
    });
  };

  const onEditarUsuario = (u: UsuarioDTO) => {
    setEditando(u);
    usuarioForm.reset({
      cedula: u.cedula,
      departamentoId: u.departamentoId ?? null,
      rolId: u.rolId ?? null,
    });
  };

  const onCambiarEstado = (u: UsuarioDTO) => {
    startTransition(async () => {
      setError(null);
      const resultado = await cambiarEstadoUsuarioAction(u.id, !u.isActive);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      cargarUsuarios();
    });
  };

  const onGuardarRol = (data: RolFormType) => {
    startTransition(async () => {
      setError(null);
      const resultado = editandoRol
        ? await actualizarRolAction(editandoRol.id, { nombreRol: data.nombreRol, descripcionRol: data.descripcionRol ?? "" })
        : await crearRolAction({ nombreRol: data.nombreRol, descripcionRol: data.descripcionRol ?? "" });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setEditandoRol(null);
      rolForm.reset({});
      cargarRoles();
    });
  };

  const onEditarRol = (r: RolDTO) => {
    setEditandoRol(r);
    rolForm.reset({ nombreRol: r.nombreRol, descripcionRol: r.descripcionRol });
  };

  const onEliminarRol = (id: number) => {
    startTransition(async () => {
      setError(null);
      const resultado = await eliminarRolAction(id);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      if (editandoRol?.id === id) setEditandoRol(null);
      cargarRoles();
    });
  };

  const nombreDepartamento = (id: number | null) =>
    departamentos.find((d) => d.id === id)?.nombre ?? "—";
  const nombreRol = (id: number | null) => roles.find((r) => r.id === id)?.nombreRol ?? "—";

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <Users className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Usuarios y Roles</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permisos">Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={filtroForm.handleSubmit(onFiltro)} className="flex flex-col gap-4" noValidate>
                  <Field>
                    <Label htmlFor="busqueda">Búsqueda</Label>
                    <Input
                      id="busqueda"
                      placeholder="Cédula o nombre"
                      value={filtroText}
                      onChange={(e) => setFiltroText(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field>
                      <Label htmlFor="filtroDepartamento">Departamento</Label>
                      <IdSelect
                        id="filtroDepartamento"
                        value={filtroForm.watch("departamentoId") ? String(filtroForm.watch("departamentoId")) : undefined}
                        onChange={(v) => filtroForm.setValue("departamentoId", v === undefined ? undefined : v)}
                        options={departamentos}
                        placeholder="Todos"
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="filtroRol">Rol</Label>
                      <IdSelect
                        id="filtroRol"
                        value={filtroForm.watch("rolId") ? String(filtroForm.watch("rolId")) : undefined}
                        onChange={(v) => filtroForm.setValue("rolId", v === undefined ? undefined : v)}
                        options={rolOptions}
                        placeholder="Todos"
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="filtroEstado">Estado</Label>
                      <Select
                        value={filtroForm.watch("isActive") === undefined ? undefined : String(filtroForm.watch("isActive"))}
                        onValueChange={(v) => filtroForm.setValue("isActive", v === "true" ? true : v === "false" ? false : undefined)}
                      >
                        <SelectTrigger id="filtroEstado" className="w-full">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Activos</SelectItem>
                          <SelectItem value="false">Inactivos</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div>
                    <Button type="submit" disabled={isPending}>
                      <Loader2 className="size-4" aria-hidden="true" /> Filtrar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle>{editando ? "Editar usuario" : "Registrar usuario"}</CardTitle>
                <CardDescription>{editando ? `Editando: ${editando.cedula}` : "Alta de una nueva cuenta."}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={usuarioForm.handleSubmit(onGuardarUsuario)} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field data-invalid={!!usuarioForm.formState.errors.cedula}>
                      <Label htmlFor="cedula">Cédula</Label>
                      <Input id="cedula" placeholder="Ej. 12345678" {...usuarioForm.register("cedula")} aria-invalid={!!usuarioForm.formState.errors.cedula} />
                    </Field>
                    <Field data-invalid={!!usuarioForm.formState.errors.password}>
                      <Label htmlFor="password">{editando ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
                      <Input type="password" id="password" placeholder={editando ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"} {...usuarioForm.register("password")} aria-invalid={!!usuarioForm.formState.errors.password} />
                      {usuarioForm.formState.errors.password && <p role="alert" className="text-sm text-destructive">{usuarioForm.formState.errors.password.message}</p>}
                    </Field>
                    <Field>
                      <Label htmlFor="usuarioDepartamento">Departamento</Label>
                      <IdSelect
                        id="usuarioDepartamento"
                        value={usuarioForm.watch("departamentoId") ? String(usuarioForm.watch("departamentoId")) : undefined}
                        onChange={(v) => usuarioForm.setValue("departamentoId", v ?? null)}
                        options={departamentos}
                        placeholder="Seleccione"
                        allowNone
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="usuarioRol">Rol</Label>
                      <IdSelect
                        id="usuarioRol"
                        value={usuarioForm.watch("rolId") ? String(usuarioForm.watch("rolId")) : undefined}
                        onChange={(v) => usuarioForm.setValue("rolId", v ?? null)}
                        options={rolOptions}
                        placeholder="Seleccione"
                        allowNone
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={isPending}>
                      <Plus className="size-4" aria-hidden="true" /> {editando ? "Actualizar" : "Registrar"}
                    </Button>
                    {editando && (
                      <Button type="button" variant="outline" onClick={() => { setEditando(null); usuarioForm.reset({}); }}>
                        <RotateCcw className="size-4" aria-hidden="true" /> Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && usuarios.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : !usuarios.length ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No hay usuarios registrados.</TableCell></TableRow>
                ) : (
                  usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.cedula}</TableCell>
                      <TableCell>{u.nombres} {u.apellidos}</TableCell>
                      <TableCell className="text-muted-foreground">{u.correo ?? "—"}</TableCell>
                      <TableCell>{nombreDepartamento(u.departamentoId)}</TableCell>
                      <TableCell>{nombreRol(u.rolId)}</TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? "secondary" : "outline"}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEditarUsuario(u)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => onCambiarEstado(u)} disabled={isPending}>
                            {u.isActive ? <RotateCcw className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>{editandoRol ? "Editar rol" : "Nuevo rol"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={rolForm.handleSubmit(onGuardarRol)} className="flex flex-col gap-4 md:max-w-lg" noValidate>
                <Field data-invalid={!!rolForm.formState.errors.nombreRol}>
                  <Label htmlFor="nombreRol">Nombre</Label>
                  <Input id="nombreRol" {...rolForm.register("nombreRol")} aria-invalid={!!rolForm.formState.errors.nombreRol} />
                  {rolForm.formState.errors.nombreRol && <p role="alert" className="text-sm text-destructive">{rolForm.formState.errors.nombreRol.message}</p>}
                </Field>
                <Field>
                  <Label htmlFor="descripcionRol">Descripción</Label>
                  <Input id="descripcionRol" {...rolForm.register("descripcionRol")} />
                </Field>
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isPending}>
                    <Plus className="size-4" aria-hidden="true" /> {editandoRol ? "Actualizar" : "Crear"}
                  </Button>
                  {editandoRol && (
                    <Button type="button" variant="outline" onClick={() => { setEditandoRol(null); rolForm.reset({}); }}>
                      <RotateCcw className="size-4" aria-hidden="true" /> Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Id</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!roles.length ? (
                  <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">No hay roles registrados.</TableCell></TableRow>
                ) : (
                  roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.id}</TableCell>
                      <TableCell>{r.nombreRol}</TableCell>
                      <TableCell>{r.descripcionRol || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEditarRol(r)} disabled={isPending}><Pencil className="size-4" aria-hidden="true" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => onEliminarRol(r.id)} disabled={isPending}><Trash2 className="size-4" aria-hidden="true" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="permisos" className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!permisos.length ? (
                  <TableRow><TableCell colSpan={2} className="h-16 text-center text-muted-foreground">No hay permisos registrados.</TableCell></TableRow>
                ) : (
                  permisos.map((p) => (
                    <TableRow key={p.codigo}>
                      <TableCell className="font-medium"><Badge variant="outline"><ShieldCheck className="size-3" aria-hidden="true" /> {p.codigo}</Badge></TableCell>
                      <TableCell>{p.nombre}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
