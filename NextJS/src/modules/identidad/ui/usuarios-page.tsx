"use client";

/**
 * Página de usuarios del módulo identidad (paso 15 del checklist §II.8).
 * Cliente + SWR sobre la Server Action; opera exclusivamente con DTOs (R5) y
 * no importa de `infrastructure/` (R3). Tabla simple: sin lógica de negocio.
 * El thin wrapper en `app/(app)/` se registrará cuando exista navegación.
 */
import useSWR from "swr";
import { Loader2, Users } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import type { UsuarioItemDTO } from "../application/dtos/usuario-dto";
import { listarUsuariosAction } from "../infrastructure/actions/usuario-actions";

function UsuarioRow({ usuario }: { usuario: UsuarioItemDTO }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{usuario.cedula}</TableCell>
      <TableCell>
        {usuario.nombres} {usuario.apellidos}
      </TableCell>
      <TableCell className="text-muted-foreground">{usuario.correo}</TableCell>
    </TableRow>
  );
}

export default function UsuariosPage() {
  const { data: usuarios, error, isLoading, mutate } = useSWR(
    "identidad-usuarios",
    () => listarUsuariosAction({}),
  );

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm font-medium text-destructive">
          No fue posible cargar el listado de usuarios.
        </p>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro visual del slice mínimo: la búsqueda real se conecta al
              conectar la navegación y los parámetros de `listarUsuariosAction`. */}
          <Input placeholder="Buscar por cédula o nombre (próximamente)" disabled />
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            Refrescar
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cédula</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Correo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : !usuarios?.length ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => <UsuarioRow key={u.id} usuario={u} />)
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
