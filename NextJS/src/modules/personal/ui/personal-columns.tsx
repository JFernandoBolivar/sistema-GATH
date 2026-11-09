"use client";

/**
 * Definición de columnas del listado de personal para `DataTable` (tanstack).
 * 100% Paridad visual y estructural con el sistema de referencia
 * (`tableEmployees/columns.tsx`):
 * - Cédula (ordenable con DataTableColumnHeader)
 * - Nombres
 * - Apellidos
 * - Sexo (primera letra M/F)
 * - F. Nacimiento (dd/MM/yyyy)
 * - Estatus Contrato (Badge verde ACTIVO / amarillo POR VENCER / rojo VENCIDO o N/A)
 * - F. Ingreso Organismo (fecha de ingreso del contrato o N/A)
 * - Menú de acciones:
 *   - Acciones: "Copiar Cédula De Identidad"
 *   - Extras: "Expediente PDF" (ExportButton) y botón azul "Ver Detalles"
 */
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/shared/ui/components/badge";
import {
  AccionesListadoMenu,
  type ItemAccionListado,
} from "@/shared/ui/components/acciones-listado-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";

function AccionesCell({
  empleado,
  puedeExportarPdf,
  onVerDetalle,
  onExportarPdfDirecto,
}: {
  empleado: EmpleadoDTO;
  puedeExportarPdf: boolean;
  onVerDetalle: (cedula: string) => void;
  onExportarPdfDirecto?: (cedula: string) => void | Promise<void>;
}) {
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const handleDescargarPdf = async () => {
    if (!onExportarPdfDirecto || generandoPdf) return;
    setGenerandoPdf(true);
    try {
      await onExportarPdfDirecto(empleado.cedula);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const extras: ItemAccionListado[] = puedeExportarPdf
    ? [
        {
          etiqueta: generandoPdf ? "Generando archivo…" : "Descargar PDF",
          deshabilitado: generandoPdf,
          onSelect: handleDescargarPdf,
        },
      ]
    : [];

  return (
    <AccionesListadoMenu
      etiquetaMenu="Abrir Menu"
      acciones={[
        {
          etiqueta: "Copiar Cédula De Identidad",
          onSelect: () => navigator.clipboard.writeText(empleado.cedula),
        },
      ]}
      extras={extras}
      accionPrincipal={{
        etiqueta: "Ver Detalles",
        onSelect: () => onVerDetalle(empleado.cedula),
      }}
    />
  );
}

export function construirColumnasPersonal(
  puedeVerDetalle: boolean,
  puedeEditar: boolean,
  onVerDetalle: (cedula: string) => void,
  onSubirFoto: (cedula: string) => void,
  puedeExportarPdf: boolean = false,
  onExportarPdfDirecto?: (cedula: string) => void,
): ColumnDef<EmpleadoDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedula}</span>,
    },
    { accessorKey: "nombres", header: "Nombres" },
    { accessorKey: "apellidos", header: "Apellidos" },
    {
      accessorKey: "sexoNombre",
      header: "Sexo",
      cell: ({ getValue }) => <span>{(getValue() as string)?.[0] ?? "N/A"}</span>,
    },
    {
      accessorKey: "fechaNacimiento",
      header: "F. Nacimiento",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span>N/A</span>;
        // Normalizar a dd/MM/yyyy
        const parts = val.split("-");
        if (parts.length === 3) {
          return <span>{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>;
        }
        return <span>{val}</span>;
      },
    },
    {
      id: "estatus_contrato",
      header: "Estatus Contrato",
      cell: ({ row }) => {
        const estatus = row.original.contratoActual?.estatusNombre?.toUpperCase();
        if (!estatus) return <span>N/A</span>;
        const color =
          estatus === "ACTIVO"
            ? "bg-success"
            : estatus === "POR VENCER"
            ? "bg-warning"
            : "bg-danger";
        return <Badge className={`${color} text-white`}>{estatus}</Badge>;
      },
    },
    {
      id: "fecha_ingreso_org",
      header: "F. Ingreso Organismo",
      cell: ({ row }) => {
        const fecha = row.original.contratoActual?.fechaIngreso;
        if (!fecha) return <span>N/A</span>;
        const parts = fecha.split("-");
        if (parts.length === 3) {
          return <span>{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>;
        }
        return <span>{fecha}</span>;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          empleado={row.original}
          puedeExportarPdf={puedeExportarPdf}
          onVerDetalle={onVerDetalle}
          onExportarPdfDirecto={onExportarPdfDirecto}
        />
      ),
    },
  ];
}
