"use client";

/**
 * Página de usuarios del módulo identidad — paridad estructural con el
 * legado (`seguridad/gestionar-usuarios` + `seguridad/gestionar-roles`):
 * `DataTable` (tanstack) con menú de acciones por fila en vez de tabla HTML
 * plana con botones sueltos, alta de usuario en ruta propia
 * (`/usuarios/registrar`, antes vivía inline arriba de la tabla) y edición
 * vía diálogo consolidado en vez de un `Card` de formulario siempre visible.
 *
 * Simplificación deliberada frente al legado (documentada, no oculta): el
 * legado tenía `seguridad/gestionar-usuarios` y `seguridad/gestionar-roles`
 * como dos secciones de navegación totalmente separadas, cada una con su
 * propio layout; aquí ambas viven bajo una sola ruta (`/usuarios`) con
 * pestañas Usuarios/Roles/Permisos — decisión de IA ya tomada antes de este
 * ajuste, no se reintrodujo la fragmentación de rutas de nivel superior. La
 * alta de rol, al ser un formulario de un solo campo, se implementó como
 * diálogo reutilizado (`rol-dialog.tsx`) en vez de una ruta `/usuarios/roles/registrar`
 * separada — mismo criterio de "un solo diálogo" que ya se aplicó en
 * `modules/personal`.
 *
 * Cliente + react-hook-form (búsqueda) + useTransition (R8); delega a las
 * Server Actions del módulo (R7). Opera exclusivamente con DTOs (R5) y no
 * importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type {
  DepartamentoDTO,
  PermisoDTO,
  RolDTO,
  UsuarioDTO,
} from "../application/dtos/usuario-dto";
import {
  cambiarEstadoUsuarioAction,
  eliminarRolAction,
  getDepartamentosAction,
  getPermisosAction,
  getRolesAction,
  listarUsuariosAction,
} from "../infrastructure/actions/usuario-actions";
import RolDialog from "./rol-dialog";
import { construirColumnasRoles } from "./roles-columns";
import UsuarioEditarDialog from "./usuario-editar-dialog";
import { construirColumnasUsuarios } from "./usuarios-columns";
import { usuariosFiltrosSchema, type UsuariosFiltrosType } from "./schema/schema-usuario";

export default function UsuariosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrearUsuario = tienePermiso(permisos, "identidad.crear_usuarios");
  const puedeEditarUsuario = tienePermiso(permisos, "identidad.editar_usuarios") || tienePermiso(permisos, "identidad.desactivar_usuarios");
  const puedeCrearRol = tienePermiso(permisos, "identidad.crear_roles");
  const puedeEditarRol = tienePermiso(permisos, "identidad.editar_roles");
  const puedeEliminarRol = tienePermiso(permisos, "identidad.eliminar_roles");

  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([]);
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [permisosCatalogo, setPermisosCatalogo] = useState<PermisoDTO[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioDTO | null>(null);
  const [dialogoUsuarioAbierto, setDialogoUsuarioAbierto] = useState(false);

  const [rolEditando, setRolEditando] = useState<RolDTO | null>(null);
  const [dialogoRolAbierto, setDialogoRolAbierto] = useState(false);
  const [rolEliminando, setRolEliminando] = useState<RolDTO | null>(null);

  const filtroForm = useForm<UsuariosFiltrosType>({
    resolver: zodResolver(usuariosFiltrosSchema),
    defaultValues: {},
  });

  const cargarUsuarios = (busqueda?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        setUsuarios(await listarUsuariosAction({ busqueda: busqueda || undefined }));
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
        setPermisosCatalogo(p);
      } catch {
        setError("No fue posible cargar los catálogos.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBuscar = (data: UsuariosFiltrosType) => cargarUsuarios(data.busqueda ?? undefined);

  const onCambiarEstado = (u: UsuarioDTO) => {
    startTransition(async () => {
      const resultado = await cambiarEstadoUsuarioAction(u.id, !u.isActive);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success(u.isActive ? "Usuario bloqueado." : "Usuario activado.");
      cargarUsuarios();
    });
  };

  const onEliminarRol = () => {
    if (!rolEliminando) return;
    const rol = rolEliminando;
    startTransition(async () => {
      const resultado = await eliminarRolAction(rol.id);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
      } else {
        toast.success("Rol eliminado correctamente.");
        cargarRoles();
      }
      setRolEliminando(null);
    });
  };

  const columnasUsuarios = construirColumnasUsuarios(
    departamentos,
    roles,
    puedeEditarUsuario,
    (u) => {
      setUsuarioEditando(u);
      setDialogoUsuarioAbierto(true);
    },
    onCambiarEstado,
  );

  const columnasPermisos: ColumnDef<PermisoDTO>[] = [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ getValue }) => (
        <Badge variant="outline">
          <ShieldCheck className="size-3" aria-hidden="true" /> {getValue() as string}
        </Badge>
      ),
    },
    { accessorKey: "nombre", header: "Nombre" },
  ];

  const columnasRoles = construirColumnasRoles(
    puedeEditarRol,
    puedeEliminarRol,
    (r) => {
      setRolEditando(r);
      setDialogoRolAbierto(true);
    },
    (r) => setRolEliminando(r),
  );

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
          {isPending && usuarios.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            <DataTable
              columns={columnasUsuarios}
              data={usuarios}
              emptyMessage="No hay usuarios registrados."
              toolbar={
                <div className="flex items-center gap-2">
                  <form onSubmit={filtroForm.handleSubmit(onBuscar)} className="flex items-end gap-2" noValidate>
                    <Field>
                      <Label htmlFor="busqueda" className="sr-only">Búsqueda</Label>
                      <Input id="busqueda" placeholder="Cédula o nombre" {...filtroForm.register("busqueda")} />
                    </Field>
                    <Button type="submit" variant="outline" disabled={isPending}>
                      <Search className="size-4" aria-hidden="true" /> Buscar
                    </Button>
                  </form>
                  {puedeCrearUsuario && (
                    <Button asChild>
                      <Link href="/usuarios/registrar">
                        <Plus className="size-4" aria-hidden="true" /> Nuevo
                      </Link>
                    </Button>
                  )}
                </div>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="roles" className="flex flex-col gap-4">
          <DataTable
            columns={columnasRoles}
            data={roles}
            emptyMessage="No hay roles registrados."
            toolbar={
              puedeCrearRol ? (
                <Button
                  onClick={() => {
                    setRolEditando(null);
                    setDialogoRolAbierto(true);
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" /> Nuevo rol
                </Button>
              ) : undefined
            }
          />
        </TabsContent>

        <TabsContent value="permisos" className="flex flex-col gap-4">
          <DataTable
            columns={columnasPermisos}
            data={permisosCatalogo}
            emptyMessage="No hay permisos registrados."
            hideColumnsMenu
          />
        </TabsContent>
      </Tabs>

      <UsuarioEditarDialog
        open={dialogoUsuarioAbierto}
        onOpenChange={setDialogoUsuarioAbierto}
        usuario={usuarioEditando}
        departamentos={departamentos}
        roles={roles}
        onGuardado={cargarUsuarios}
      />

      <RolDialog
        open={dialogoRolAbierto}
        onOpenChange={setDialogoRolAbierto}
        rolEditando={rolEditando}
        onGuardado={cargarRoles}
      />

      <AlertDialog open={!!rolEliminando} onOpenChange={(open) => !open && setRolEliminando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar el rol {rolEliminando?.nombreRol}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. No se podrá eliminar si tiene cuentas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !puedeEliminarRol}
              onClick={(e) => {
                e.preventDefault();
                onEliminarRol();
              }}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
