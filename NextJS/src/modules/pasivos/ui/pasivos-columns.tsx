"use client";

/**
 * Columnas del listado de pasivos. Acciones: copiar cédula, ver detalle y
 * descargar el PDF del expediente (si tiene `pasivos.exportar_pdf`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Eye, FileDown, MoreHorizontal } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";

export interface AccionesPasivo {
  onVerDetalle: (pasivo: PasivoDTO) => void;
  onDescargarPdf: (pasivo: PasivoDTO) => void | Promise<void>;
  puedeExportarPdf: boolean;
}

function AccionesCell({ pasivo, acciones }: { pasivo: PasivoDTO; acciones: AccionesPasivo }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(pasivo.cedula)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => acciones.onVerDetalle(pasivo)}>
          <Eye className="size-4" aria-hidden="true" /> Ver detalle
        </DropdownMenuItem>
        {acciones.puedeExportarPdf && (
          <DropdownMenuItem onClick={() => acciones.onDescargarPdf(pasivo)}>
            <FileDown className="size-4" aria-hidden="true" /> Descargar PDF
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasPasivos(acciones: AccionesPasivo): ColumnDef<PasivoDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "nombres",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nombres" />,
    },
    {
      accessorKey: "apellidos",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Apellidos" />,
    },
    {
      accessorKey: "sexoNombre",
      header: "Sexo",
      cell: ({ getValue }) => <span>{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      accessorKey: "fechaNacimiento",
      header: "F. Nacimiento",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{formatearFecha(getValue() as string | null, "—")}</span>
      ),
    },
    {
      accessorKey: "fechaIngresoOrganismo",
      header: "F. Ingreso Organismo",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{formatearFecha(getValue() as string | null, "—")}</span>
      ),
    },
    {
      accessorKey: "tipoPasivo",
      header: "Tipo de pasivo",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <AccionesCell pasivo={row.original} acciones={acciones} />,
    },
  ];
}
