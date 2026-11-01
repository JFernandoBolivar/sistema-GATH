"use client";

/**
 * Columnas del listado de pasivos. Acciones: copiar cédula, ver detalle,
 * editar datos básicos (pasivos.editar), consultar/agregar familiares del
 * pasivo. El detalle sigue abriéndose en el Sheet del módulo.
 */
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ContactRound, Copy, Eye, MoreHorizontal, Pencil, UserRoundPlus } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";

export interface AccionesPasivo {
  onVerDetalle: (pasivo: PasivoDTO) => void;
  onEditar: (pasivo: PasivoDTO) => void;
  puedeEditar: boolean;
  puedeVerFamiliares: boolean;
  puedeAgregarFamiliar: boolean;
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
        {acciones.puedeEditar && (
          <DropdownMenuItem onClick={() => acciones.onEditar(pasivo)}>
            <Pencil className="size-4" aria-hidden="true" /> Editar datos
          </DropdownMenuItem>
        )}
        {(acciones.puedeVerFamiliares || acciones.puedeAgregarFamiliar) && (
          <>
            <DropdownMenuSeparator />
            {acciones.puedeVerFamiliares && (
              <DropdownMenuItem asChild>
                <Link href={`/familiares/consultar?cedula=${pasivo.cedula}`}>
                  <ContactRound className="size-4" aria-hidden="true" /> Ver familiares
                </Link>
              </DropdownMenuItem>
            )}
            {acciones.puedeAgregarFamiliar && (
              <DropdownMenuItem asChild>
                <Link href={`/familiares/registrar?cedula=${pasivo.cedula}`}>
                  <UserRoundPlus className="size-4" aria-hidden="true" /> Agregar familiar
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasPasivos(acciones: AccionesPasivo): ColumnDef<PasivoDTO>[] {
  return [
    {
      accessorKey: "resolucion",
      header: "Código",
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      id: "nombreCompleto",
      accessorFn: (row) => `${row.nombres} ${row.apellidos}`,
      header: "Nombre completo",
    },
    {
      accessorKey: "tipoPasivo",
      header: "Tipo de nómina",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      accessorKey: "fechaEgreso",
      header: "Fecha de egreso",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <AccionesCell pasivo={row.original} acciones={acciones} />,
    },
  ];
}
