"use client";

/**
 * Columnas del listado de pasivos. El menú de acciones comparte estructura y
 * diseño con el de personal (`AccionesListadoMenu`): secciones «Acciones» y
 * «Extras», separador y botón principal, conservando solo las acciones propias
 * de pasivos (copiar cédula, ver detalle y descargar el PDF del expediente).
 */
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/shared/ui/components/badge";
import {
  AccionesListadoMenu,
  type ItemAccionListado,
} from "@/shared/ui/components/acciones-listado-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";

export interface AccionesPasivo {
  onVerDetalle: (pasivo: PasivoDTO) => void;
  onDescargarPdf: (pasivo: PasivoDTO) => void | Promise<void>;
  puedeExportarPdf: boolean;
}

function AccionesCell({ pasivo, acciones }: { pasivo: PasivoDTO; acciones: AccionesPasivo }) {
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const handleDescargarPdf = async () => {
    if (generandoPdf) return;
    setGenerandoPdf(true);
    try {
      await acciones.onDescargarPdf(pasivo);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const extras: ItemAccionListado[] = acciones.puedeExportarPdf
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
      acciones={[
        {
          etiqueta: "Copiar cédula",
          onSelect: () => navigator.clipboard.writeText(pasivo.cedula),
        },
      ]}
      extras={extras}
      accionPrincipal={{
        etiqueta: "Ver detalle",
        onSelect: () => acciones.onVerDetalle(pasivo),
      }}
    />
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
      header: "Tipo de nómina",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <AccionesCell pasivo={row.original} acciones={acciones} />,
    },
  ];
}
