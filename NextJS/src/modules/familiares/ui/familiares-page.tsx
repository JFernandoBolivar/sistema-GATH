"use client";

/**
 * Página "Consultar Familiar" (/familiares/consultar):
 * Réplica visual y de comportamiento del legado:
 * 1. PageLayout con title="Consultar Familiar" y description="Consulte El Familiar Del Trabajador".
 * 2. Formulario de búsqueda horizontal:
 *    - Label: "Buscar Cédula Trabajador"
 *    - Input: placeholder="buscar cedula...", bg-white
 *    - Botones Buscar (Search) y Limpiar (Eraser).
 * 3. Indicador de carga animado Loading (promiseMessage="Cargando Información").
 * 4. Tabla de resultados tanstack DataTable con menú de acciones (Copiar C. Familiar, Ver Detalles).
 * 5. Sheet de DetalleFamiliar con cards por sección (Básica, Parentesco, Formación, Vestimenta, Salud, Documentos).
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { Eraser, Search } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Loading } from "@/shared/ui/components/loading";

import type { FamiliarDTO } from "../application/dtos/familiar-dto";
import {
  eliminarFamiliarAction,
  getFamiliaresPorEmpleadoAction,
} from "../infrastructure/actions/familiares-actions";
import { DetalleFamiliar } from "./detalle-familiar";
import { construirColumnasFamiliares } from "./familiares-columns";
import { familiaresPorEmpleadoSchema } from "./schema/schema-familiar";

export default function FamiliaresPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
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
          setFamiliares([]);
          return;
        }
        setFamiliares((resultado as FamiliarDTO[]) ?? []);
      } catch {
        setError("No fue posible cargar las cargas familiares.");
        setFamiliares([]);
      }
    });
  };

  const onBuscar = (data: { cedula: string }) => {
    if (!data.cedula.trim()) return;
    setEmpleadoCedula(data.cedula);
    setBuscado(true);
    cargarFamiliares(data.cedula);
  };

  const onLimpiar = () => {
    busquedaForm.reset({ cedula: "" });
    setEmpleadoCedula("");
    setBuscado(false);
    setFamiliares([]);
    setError(null);
  };

  const onVerDetalle = (familiar: FamiliarDTO) => {
    setViendoDetalle(familiar);
    setDetalleAbierto(true);
  };

  const onEliminar = (familiar: FamiliarDTO) => {
    if (
      !window.confirm(
        `¿Eliminar la carga familiar de ${familiar.primerNombre} ${familiar.primerApellido}?`,
      )
    )
      return;
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
    <PageLayout title="Consultar Familiar" description="Consulte El Familiar Del Trabajador">
      <div className="flex flex-col gap-4 mt-2">
        <Card className="bg-white">
          <CardContent className="p-4 bg-white">
            <form
              onSubmit={busquedaForm.handleSubmit(onBuscar)}
              className="flex flex-row items-end gap-2 flex-wrap"
              noValidate
            >
              <div className="flex-1 min-w-[220px] flex flex-col gap-1.5">
                <Label htmlFor="cedula_empleado">Buscar Cédula Trabajador</Label>
                <Input
                  id="cedula_empleado"
                  className="bg-white"
                  type="text"
                  placeholder="buscar cedula..."
                  {...busquedaForm.register("cedula")}
                  disabled={isPending}
                />
              </div>

              <Button type="submit" className="cursor-pointer shrink-0" disabled={isPending}>
                Buscar <Search className="size-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer shrink-0"
                type="button"
                onClick={onLimpiar}
                disabled={isPending}
              >
                Limpiar <Eraser className="size-4 ml-1" />
              </Button>
            </form>
            {busquedaForm.formState.errors.cedula && (
              <p role="alert" className="text-sm text-destructive mt-1.5">
                {busquedaForm.formState.errors.cedula.message}
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {isPending ? (
          <div className="py-6">
            <Loading promiseMessage="Cargando Información" />
          </div>
        ) : (
          buscado && (
            <div className="container mx-auto py-2">
              <DataTable
                columns={columnas}
                data={familiares}
                emptyMessage="Sin cargas familiares para este empleado."
              />
            </div>
          )
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
      </div>
    </PageLayout>
  );
}
