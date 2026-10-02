"use client";

/**
 * Definición de columnas del listado de cargos para DataTable (tanstack).
 * Réplica de paridad estructural exacta con el legado
 * (`listado-codigo/tableCodeInfo/columns.tsx`):
 * código ordenable, denominación/específica/grado/nómina/organismo adscrito,
 * ubicación administrativa con HoverCard ("Mostrar"), badge de estatus con los
 * mismos colores del legado, y menú de acciones desplegable (copiar código, ver detalle).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { formatInTimeZone } from "date-fns-tz";
import { Airplay, ArrowUpDown, Copy, Eye, MoreHorizontal } from "lucide-react";

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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/shared/ui/components/hover-card";

import type { CargoAsignacionDTO } from "../application/dtos/cargo-dto";

function EstatusBadge({ estatusNombre, estaVacante }: { estatusNombre: string; estaVacante: boolean }) {
  if (estaVacante || estatusNombre === "VACANTE") {
    return <Badge className="bg-green-700 text-white hover:bg-green-700">VACANTE</Badge>;
  }
  if (estatusNombre === "ACTIVO") {
    return <Badge className="bg-[#ffc523] text-black hover:bg-[#ffc523]">ACTIVO</Badge>;
  }
  if (estatusNombre === "SUSPENDIDO") {
    return <Badge className="bg-gray-500 text-white hover:bg-gray-500">SUSPENDIDO</Badge>;
  }
  return <Badge variant="destructive">{estatusNombre}</Badge>;
}

function UbicacionHoverCard({ valor }: { valor?: string | null }) {
  if (!valor) {
    return (
      <Button variant="destructive" size="sm" className="w-full cursor-default pointer-events-none">
        N/A
      </Button>
    );
  }
  return (
    <HoverCard openDelay={10} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Button size="sm" className="w-full">Mostrar</Button>
      </HoverCardTrigger>
      <HoverCardContent className="flex w-64 flex-col gap-0.5 z-50">
        <div className="font-semibold text-sm">{valor}</div>
      </HoverCardContent>
    </HoverCard>
  );
}

function AccionesCell({
  cargo,
  puedeVerDetalle,
  onVerDetalle,
  onActualizar,
}: {
  cargo: CargoAsignacionDTO;
  puedeVerDetalle: boolean;
  onVerDetalle: (cargoId: number) => void;
  onActualizar?: (cargo: CargoAsignacionDTO) => void;
}) {
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(cargo.codigo)}>
          <Copy className="size-4 mr-2" aria-hidden="true" /> Copiar Código
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {onActualizar && (
          <DropdownMenuItem onClick={() => onActualizar(cargo)}>
            <Airplay className="size-4 mr-2" aria-hidden="true" /> Actualizar Código
          </DropdownMenuItem>
        )}
        {puedeVerDetalle && (
          <DropdownMenuItem onClick={() => onVerDetalle(cargo.id)}>
            <Eye className="size-4 mr-2" aria-hidden="true" /> Ver Detalle
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasCargos(
  puedeVerDetalle: boolean,
  onVerDetalle: (cargoId: number) => void,
  onActualizar?: (cargo: CargoAsignacionDTO) => void,
): ColumnDef<CargoAsignacionDTO>[] {
  return [
    {
      accessorKey: "codigo",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Código
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium px-2">{row.original.codigo}</span>,
    },
    {
      accessorKey: "denominacionNombre",
      header: "D. Cargo",
    },
    {
      accessorKey: "especificaNombre",
      header: "D. Cargo Específico",
    },
    {
      accessorKey: "gradoNombre",
      header: "Grado",
      cell: ({ getValue }) => {
        const grado = getValue();
        if (!grado) return "N/A";
        return String(grado);
      },
    },
    {
      accessorKey: "tipoNominaNombre",
      header: "Nomina",
    },
    {
      accessorKey: "organismoNombre",
      header: "Org. Adscrito",
      cell: ({ getValue }) => {
        const org = getValue();
        if (!org) return "N/A";
        return String(org);
      },
    },
    {
      accessorKey: "direccionGeneralNombre",
      id: "Dirección / Gerencia / Oficina",
      header: "D / G / O",
      cell: ({ getValue }) => <UbicacionHoverCard valor={getValue() as string | null} />,
    },
    {
      accessorKey: "direccionLineaNombre",
      id: "División / Coordinación",
      header: "División",
      cell: ({ getValue }) => <UbicacionHoverCard valor={getValue() as string | null} />,
    },
    {
      accessorKey: "coordinacionNombre",
      id: "Coordinación",
      header: "Coordinación",
      cell: ({ getValue }) => <UbicacionHoverCard valor={getValue() as string | null} />,
    },
    {
      accessorKey: "estatusNombre",
      header: "Estatus",
      cell: ({ row }) => (
        <EstatusBadge
          estatusNombre={row.original.estatusNombre}
          estaVacante={row.original.estaVacante}
        />
      ),
    },
    {
      accessorKey: "fechaActualizacion",
      header: "F. Actualización",
      cell: ({ getValue }) => {
        const dateVal = getValue() as string | null | undefined;
        if (!dateVal) return "N/A";
        try {
          const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
          return formatInTimeZone(date, "UTC", "dd/MM/yyyy");
        } catch {
          return "N/A";
        }
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          cargo={row.original}
          puedeVerDetalle={puedeVerDetalle}
          onVerDetalle={onVerDetalle}
          onActualizar={onActualizar}
        />
      ),
    },
  ];
}
