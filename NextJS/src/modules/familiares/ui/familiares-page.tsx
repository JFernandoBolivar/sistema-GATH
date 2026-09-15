"use client";

/**
 * Página de cargas familiares: búsqueda por empleado + listado con
 * `DataTable` (tanstack) y menú de acciones por fila, paridad de patrón con
 * `modules/personal/ui/personal-page.tsx`. A diferencia de personal, no hay
 * un listado global de familiares (el backend solo expone `GET
 * .../empleado/<cedula>/`, nunca todos los familiares): la búsqueda de
 * empleado sigue siendo el primer paso obligatorio, no una ruta de alta
 * separada — ver `familiar-form-dialog.tsx` para la justificación de por
 * qué el alta es un diálogo y no una página propia aquí, a diferencia del
 * legado (`personal-trabajador/familiares/agregar-familiar/page.tsx`).
 * Cliente + react-hook-form (solo el buscador) + useTransition (R8);
 * delega a las Server Actions del módulo (R7). Opera exclusivamente con
 * DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Loader2, Users } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { FamiliarDTO } from "../application/dtos/familiar-dto";
import {
  eliminarFamiliarAction,
  getFamiliaresPorEmpleadoAction,
} from "../infrastructure/actions/familiares-actions";
import { DetalleFamiliar } from "./detalle-familiar";
import { construirColumnasFamiliares } from "./familiares-columns";
import { FamiliarFormDialog } from "./familiar-form-dialog";
import { familiaresPorEmpleadoSchema } from "./schema/schema-familiar";

export default function FamiliaresPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "familiares.crear");
  const puedeEditar = tienePermiso(permisos, "familiares.editar");
  const puedeEliminar = tienePermiso(permisos, "familiares.eliminar");

  const [familiares, setFamiliares] = useState<FamiliarDTO[]>([]);
  const [empleadoCedula, setEmpleadoCedula] = useState<string>("");
  const [buscado, setBuscado] = useState(false);
  const [viendoDetalle, setViendoDetalle] = useState<FamiliarDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const busquedaForm = useForm<{ cedula: string }>({
    resolver: zodResolver(familiaresPorEmpleadoSchema),
    defaultValues: { cedula: "" },
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
    setBuscado(true);
    cargarFamiliares(data.cedula);
  };

  const onVerDetalle = (familiar: FamiliarDTO) => {
    setViendoDetalle(familiar);
    setDetalleAbierto(true);
  };

  const onEliminar = (familiar: FamiliarDTO) => {
    if (!window.confirm(`¿Eliminar la carga familiar de ${familiar.primerNombre} ${familiar.primerApellido}?`)) return;
    startTransition(async () => {
      setError(null);
      const resultado = await eliminarFamiliarAction(familiar.id);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      cargarFamiliares(empleadoCedula);
    });
  };

  const columnas = construirColumnasFamiliares(puedeEliminar, onVerDetalle, onEliminar);

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

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {!buscado ? (
        <p className="text-sm text-muted-foreground">Busque un empleado para ver sus cargas familiares.</p>
      ) : isPending && familiares.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <DataTable
          columns={columnas}
          data={familiares}
          emptyMessage="Sin cargas familiares para este empleado."
          toolbar={puedeCrear ? <FamiliarFormDialog empleadoCedula={empleadoCedula} onGuardado={() => cargarFamiliares(empleadoCedula)} /> : undefined}
        />
      )}

      {viendoDetalle && (
        <DetalleFamiliar
          familiar={viendoDetalle}
          open={detalleAbierto}
          onOpenChange={setDetalleAbierto}
          puedeEditar={puedeEditar}
          onGuardado={(actualizado) => {
            cargarFamiliares(empleadoCedula);
            setViendoDetalle(actualizado);
          }}
        />
      )}
    </section>
  );
}
