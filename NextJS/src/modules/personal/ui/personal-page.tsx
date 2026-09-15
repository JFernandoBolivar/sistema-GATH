"use client";

/**
 * Página de listado de personal — paridad estructural con el legado
 * (`tableEmployees/page.tsx` + `data-table.tsx` + `columns.tsx`): tabla
 * tanstack (`DataTable` compartido) con menú de acciones por fila en vez de
 * botones sueltos, búsqueda, botón "Nuevo" que lleva a la ruta propia
 * `/personal/registrar` (antes el alta vivía inline en esta misma página),
 * y Sheet de detalle con edición vía diálogo (`empleado-detalle-sheet.tsx`).
 * Cliente + react-hook-form (solo el buscador) + useTransition (R8);
 * delega a las Server Actions del módulo (R7). Opera exclusivamente con
 * DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Search, Users } from "lucide-react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { Button } from "@/shared/ui/components/button";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";
import {
  getCatalogosExpedienteAction,
  getEmpleadoPorCedulaAction,
  getEmpleadosAction,
  subirFotoEmpleadoAction,
} from "../infrastructure/actions/personal-actions";
import EmpleadoDetalleSheet from "./empleado-detalle-sheet";
import { EmpleadoDetallePdf } from "./empleado-detalle-pdf";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";
import { construirColumnasPersonal } from "./personal-columns";
import { listadoEmpleadosSchema, type ListadoEmpleadosFormType } from "./schema/schema-empleado";

export default function PersonalPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeCrear = tienePermiso(permisos, "personal.crear");
  const puedeEditar = tienePermiso(permisos, "personal.editar_personales");
  const puedeVerDetalle = tienePermiso(permisos, "personal.ver_detalle");
  const puedeExportarPdf = tienePermiso(permisos, "personal.exportar_pdf");

  const [empleados, setEmpleados] = useState<EmpleadoDTO[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [viendoDetalle, setViendoDetalle] = useState<EmpleadoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cedulaFotoRef = useRef<string | null>(null);

  const busquedaForm = useForm<ListadoEmpleadosFormType>({ resolver: zodResolver(listadoEmpleadosSchema), defaultValues: {} });

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
    startTransition(async () => {
      setError(null);
      try {
        setCatalogos(await getCatalogosExpedienteAction());
      } catch {
        setError("No fue posible cargar los catálogos del expediente.");
      }
    });
  }, []);

  const onBuscar = (data: ListadoEmpleadosFormType) => cargar(data.busqueda ?? undefined);

  const onVerDetalle = (cedula: string) => {
    setDetalleAbierto(true);
    setViendoDetalle(null);
    startTransition(async () => {
      setError(null);
      const resultado = await getEmpleadoPorCedulaAction(cedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        setDetalleAbierto(false);
        return;
      }
      setViendoDetalle(resultado as EmpleadoDTO);
    });
  };

  const onSubirFotoClick = (cedula: string) => {
    cedulaFotoRef.current = cedula;
    fileInputRef.current?.click();
  };

  const onFotoSeleccionada = () => {
    const file = fileInputRef.current?.files?.[0];
    const cedula = cedulaFotoRef.current;
    if (!file || !cedula) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setError(null);
      try {
        await subirFotoEmpleadoAction(cedula, formData);
        cargar();
      } catch {
        setError("No fue posible subir la foto.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const onExportarPdf = () => {
    if (!viendoDetalle || !catalogos) return;
    setExportandoPdf(true);
    startTransition(async () => {
      try {
        const detalleVM = construirDetalleExpediente(viendoDetalle, catalogos);
        const { pdf } = await import("@react-pdf/renderer");
        const blob = await pdf(
          <EmpleadoDetallePdf
            detalle={detalleVM}
            generadoPor={session?.user?.name ?? undefined}
            generadoEn={new Date().toLocaleString("es-VE")}
          />,
        ).toBlob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `expediente-${viendoDetalle.cedula}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError("No fue posible generar el PDF del expediente.");
      } finally {
        setExportandoPdf(false);
      }
    });
  };

  const columnas = construirColumnasPersonal(puedeVerDetalle, puedeEditar, onVerDetalle, onSubirFotoClick);

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
        </div>
        {puedeCrear && (
          <Button asChild>
            <Link href="/personal/registrar">
              <Plus className="size-4" aria-hidden="true" /> Nuevo
            </Link>
          </Button>
        )}
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!puedeCrear && !puedeEditar && !puedeVerDetalle && (
        <p className="text-sm text-muted-foreground">Su perfil solo tiene acceso de consulta al personal.</p>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFotoSeleccionada} />

      {isPending && empleados.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : (
        <DataTable
          columns={columnas}
          data={empleados}
          emptyMessage="Sin empleados."
          toolbar={
            <form onSubmit={busquedaForm.handleSubmit(onBuscar)} className="flex items-end gap-2" noValidate>
              <Field>
                <Label htmlFor="busqueda" className="sr-only">Búsqueda</Label>
                <Input id="busqueda" placeholder="Cédula o nombre" {...busquedaForm.register("busqueda")} />
              </Field>
              <Button type="submit" variant="outline" disabled={isPending}>
                <Search className="size-4" aria-hidden="true" /> Buscar
              </Button>
            </form>
          }
        />
      )}

      <EmpleadoDetalleSheet
        open={detalleAbierto}
        onOpenChange={(open) => {
          setDetalleAbierto(open);
          if (!open) setViendoDetalle(null);
        }}
        empleado={viendoDetalle}
        catalogos={catalogos}
        detalle={viendoDetalle && catalogos ? construirDetalleExpediente(viendoDetalle, catalogos) : null}
        onExportarPdf={onExportarPdf}
        onGuardado={() => {
          cargar();
          if (viendoDetalle) onVerDetalle(viendoDetalle.cedula);
        }}
        exportandoPdf={exportandoPdf}
        puedeExportarPdf={puedeExportarPdf}
        puedeEditar={puedeEditar}
      />
    </section>
  );
}
