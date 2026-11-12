"use client";

/**
 * Definición de columnas del listado de cargas familiares para `DataTable`
 * (tanstack). El menú de acciones usa el componente compartido
 * `AccionesListadoMenu` — la misma estructura, orden y estilo que Personal
 * activo y pasivo: sección «Acciones» (copiar cédula), sección «Extras»
 * (eliminar, si el usuario tiene el permiso) y el botón principal «Ver
 * detalle». La tabla conserva las mismas columnas del legado.
 */
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/shared/ui/components/badge";
import {
  AccionesListadoMenu,
  type ItemAccionListado,
} from "@/shared/ui/components/acciones-listado-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import type { FamiliarDTO } from "../application/dtos/familiar-dto";

export function AccionesCell({ familiar, puedeEliminar, onVerDetalle, onEliminar }: {
  familiar: FamiliarDTO;
  puedeEliminar: boolean;
  onVerDetalle: (familiar: FamiliarDTO) => void;
  onEliminar: (familiar: FamiliarDTO) => void;
}) {
  const extras: ItemAccionListado[] = puedeEliminar
    ? [{ etiqueta: "Eliminar", onSelect: () => onEliminar(familiar) }]
    : [];

  return (
    <AccionesListadoMenu
      acciones={[
        {
          etiqueta: "Copiar cédula",
          onSelect: () => navigator.clipboard.writeText(familiar.cedulaFamiliar ?? ""),
          deshabilitado: !familiar.cedulaFamiliar,
        },
      ]}
      extras={extras}
      accionPrincipal={{
        etiqueta: "Ver detalle",
        onSelect: () => onVerDetalle(familiar),
      }}
    />
  );
}

export function construirColumnasFamiliares(
  puedeEliminar: boolean,
  onVerDetalle: (familiar: FamiliarDTO) => void,
  onEliminar: (familiar: FamiliarDTO) => void,
): ColumnDef<FamiliarDTO>[] {
  return [
    {
      accessorKey: "cedulaFamiliar",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as string | null) ?? "—"}</span>,
    },
    { accessorKey: "primerNombre", header: "Primer nombre" },
    { accessorKey: "primerApellido", header: "Primer apellido" },
    {
      accessorKey: "parentescoNombre",
      header: "Parentesco",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      accessorKey: "fechaNacimiento",
      header: "F. Nacimiento",
      cell: ({ getValue }) => <span>{formatearFecha(getValue() as string)}</span>,
    },
    {
      accessorKey: "heredero",
      header: "Heredero",
      cell: ({ getValue }) => (
        <Badge variant={(getValue() as boolean) ? "default" : "destructive"}>
          {(getValue() as boolean) ? "Heredero" : "No heredero"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          familiar={row.original}
          puedeEliminar={puedeEliminar}
          onVerDetalle={onVerDetalle}
          onEliminar={onEliminar}
        />
      ),
    },
  ];
}
