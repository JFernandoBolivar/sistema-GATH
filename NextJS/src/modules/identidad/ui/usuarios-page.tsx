"use client";

/**
 * Administración del sistema → Usuarios y roles (D4).
 *
 * Listado paginado en el servidor (10 por defecto, tope 50) con filtros por
 * cédula, nombre, correo, rol, estado y condición ACTIVO/PASIVO. Columnas:
 * cédula, nombre, correo de acceso, rol, estado, último acceso y contraseña
 * inicial pendiente. Las acciones llevan al detalle del usuario.
 *
 * D3: no se muestra ni se edita el departamento.
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Search, UserPlus, Users } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { CuentaInexistente } from "./cuenta-inexistente";

import type {
  PaginaUsuariosDTO,
  RolDTO,
  UsuariosFiltrosDTO,
} from "../application/dtos/usuario-dto";
import { getRolesAction, listarUsuariosAction } from "../infrastructure/actions/usuario-actions";

const FILTROS_INICIALES: UsuariosFiltrosDTO = { pagina: 1, pageSize: 10 };

function fechaLegible(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

export default function UsuariosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, "identidad.ver_usuarios");
  const puedeCrear = tienePermiso(permisos, "identidad.crear_usuarios");
  const puedeCorreo = tienePermiso(permisos, "identidad.cambiar_correo_acceso");

  const [filtros, setFiltros] = useState<UsuariosFiltrosDTO>(FILTROS_INICIALES);
  const [borrador, setBorrador] = useState<UsuariosFiltrosDTO>(FILTROS_INICIALES);
  const [pagina, setPagina] = useState<PaginaUsuariosDTO | null>(null);
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [cargando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cargar = (siguientes: UsuariosFiltrosDTO) => {
    startTransition(async () => {
      setError(null);
      let resultado: Awaited<ReturnType<typeof listarUsuariosAction>>;
      try {
        resultado = await listarUsuariosAction(siguientes);
      } catch (e) {
        // Un fallo del transporte de la server action (proxy, timeout, petición cortada al
        // paginar muy rápido) no debe tumbar la pantalla: se informa y se queda en la página.
        unstable_rethrow(e);
        setError("No fue posible cargar los usuarios. Intente de nuevo.");
        return;
      }
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setPagina(resultado as PaginaUsuariosDTO);
    });
  };

  useEffect(() => {
    if (!puedeVer) return;
    cargar(FILTROS_INICIALES);
    getRolesAction()
      .then(setRoles)
      .catch(() => setError("No fue posible cargar los roles."));
  }, [puedeVer]);

  const aplicar = () => {
    const siguientes = { ...borrador, pagina: 1 };
    setFiltros(siguientes);
    cargar(siguientes);
  };

  const limpiar = () => {
    setBorrador(FILTROS_INICIALES);
    setFiltros(FILTROS_INICIALES);
    cargar(FILTROS_INICIALES);
  };

  const cambiarPagina = (nueva: number) => {
    if (!pagina) return;
    if (nueva < 1 || nueva > pagina.totalPaginas) return;
    const siguientes = { ...filtros, pagina: nueva };
    setFiltros(siguientes);
    cargar(siguientes);
  };

  const cambiarTamano = (valor: string) => {
    const siguientes = { ...filtros, pageSize: Number(valor), pagina: 1 };
    setFiltros(siguientes);
    cargar(siguientes);
  };

  if (!puedeVer) {
    return (
      <section className="px-6 py-4">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          No tiene el permiso «identidad.ver_usuarios» para consultar los usuarios.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        </div>
        <div className="flex items-center gap-2">
          {puedeCrear && (
            <Button asChild>
              <Link href="/usuarios/registrar">
                <UserPlus className="size-4" aria-hidden="true" /> Nuevo usuario
              </Link>
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar();
            }}
            noValidate
          >
            <Field>
              <Label htmlFor="filtro-cedula">Cédula</Label>
              <Input
                id="filtro-cedula"
                maxLength={20}
                value={borrador.cedula ?? ""}
                onChange={(e) => setBorrador({ ...borrador, cedula: e.target.value })}
              />
            </Field>
            <Field>
              <Label htmlFor="filtro-nombre">Nombre</Label>
              <Input
                id="filtro-nombre"
                maxLength={100}
                value={borrador.nombre ?? ""}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              />
            </Field>
            <Field>
              <Label htmlFor="filtro-correo">Correo</Label>
              <Input
                id="filtro-correo"
                maxLength={120}
                value={borrador.correo ?? ""}
                onChange={(e) => setBorrador({ ...borrador, correo: e.target.value })}
              />
            </Field>
            <Field>
              <Label htmlFor="filtro-rol">Rol</Label>
              <Select
                value={borrador.rolId ? String(borrador.rolId) : "todos"}
                onValueChange={(v) =>
                  setBorrador({ ...borrador, rolId: v === "todos" ? undefined : Number(v) })
                }
              >
                <SelectTrigger id="filtro-rol">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.nombreVisible}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="filtro-estado">Estado</Label>
              <Select
                value={
                  borrador.isActive === undefined
                    ? "todos"
                    : borrador.isActive
                      ? "activos"
                      : "inactivos"
                }
                onValueChange={(v) =>
                  setBorrador({
                    ...borrador,
                    isActive: v === "todos" ? undefined : v === "activos",
                  })
                }
              >
                <SelectTrigger id="filtro-estado">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="filtro-condicion">Condición</Label>
              <Select
                value={borrador.condicion ?? "todos"}
                onValueChange={(v) =>
                  setBorrador({
                    ...borrador,
                    condicion: v === "todos" ? undefined : (v as "ACTIVO" | "PASIVO"),
                  })
                }
              >
                <SelectTrigger id="filtro-condicion">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="PASIVO">Pasivo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end gap-2 lg:col-span-2">
              <Button type="submit" disabled={cargando}>
                {cargando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="size-4" aria-hidden="true" />
                )}
                Filtrar
              </Button>
              <Button type="button" variant="outline" onClick={limpiar} disabled={cargando}>
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {cargando && !pagina ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (!pagina || pagina.resultados.length === 0) &&
        /^\d{5,10}$/.test((filtros.cedula ?? "").trim()) ? (
        // Búsqueda por cédula sin cuenta: se ofrece crearla (QA 2026-11-03).
        <CuentaInexistente
          key={filtros.cedula}
          cedula={(filtros.cedula ?? "").trim()}
          puedeCrear={puedeCorreo}
          onCreada={() => cargar(filtros)}
        />
      ) : !pagina || pagina.resultados.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay usuarios para los filtros seleccionados.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border bg-card">
            <Table>
              <TableCaption>
                {pagina.total} usuario(s); página {pagina.pagina} de {pagina.totalPaginas}.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo de acceso</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Contraseña inicial</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagina.resultados.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.cedula}</TableCell>
                    <TableCell>
                      {usuario.nombres} {usuario.apellidos}
                      <span className="block text-xs text-muted-foreground">
                        {usuario.condicion ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs">{usuario.correo ?? "—"}</span>
                          {usuario.correo && (
                            <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal leading-tight">
                              Acceso
                            </Badge>
                          )}
                        </div>
                        {usuario.correoAlternativo &&
                          usuario.correoAlternativo.trim().toLowerCase() !==
                            (usuario.correo ?? "").trim().toLowerCase() && (
                            <span className="text-[11px] text-muted-foreground">
                              Alt: {usuario.correoAlternativo}
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>{usuario.rolNombreVisible ?? usuario.rolNombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={usuario.isActive ? "secondary" : "outline"}>
                        {usuario.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fechaLegible(usuario.ultimoAcceso)}
                    </TableCell>
                    <TableCell>
                      {usuario.passwordInicialPendiente ? (
                        <Badge variant="outline">Pendiente</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/usuarios/${usuario.id}`}>Ver detalle</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="tamano-pagina" className="text-sm">
                Filas
              </Label>
              <Select value={String(pagina.tamano)} onValueChange={cambiarTamano}>
                <SelectTrigger id="tamano-pagina" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cambiarPagina(pagina.pagina - 1)}
                disabled={pagina.pagina <= 1 || cargando}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagina.pagina} de {pagina.totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cambiarPagina(pagina.pagina + 1)}
                disabled={pagina.pagina >= pagina.totalPaginas || cargando}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
