"use client";

import { Code } from "@/app/types/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import UpdateCode from "./detail-info";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
export const columnsCode: ColumnDef<Code>[] = [
  {
    accessorKey: "codigo",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Código
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "denominacioncargo.cargo",
    header: "D.  Cargo",
  },
  {
    accessorKey: "denominacioncargoespecifico.cargo",
    header: "D.  Cargo Específico",
  },
  {
    accessorKey: "grado.grado",
    header: "Grado",
    cell: ({ getValue }) => {
      const grado = getValue();
      if (!grado) return "N/A";
      return grado;
    },
  },
  {
    accessorKey: "tiponomina.nomina",
    header: "Nomina",
  },
  {
    accessorKey: "OrganismoAdscrito.Organismoadscrito",
    header: "Org. Adscrito",
    cell: ({ getValue }) => {
      const orgAds = getValue();
      if (!orgAds) return "N/A";
      return orgAds;
    },
  },

  {
    accessorKey: "DireccionGeneral.direccion_general",
    id: "Dirección / Gerencia / Oficina",
    header: "D / G / O ",
    cell: ({ getValue }) => {
      const directionGeneral = getValue() as string;
      if (!directionGeneral)
        return (
          <Button variant={"destructive"} className="w-full">
            N/A
          </Button>
        );
      return (
        <>
          <div>
            <HoverCard openDelay={10} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button className="w-full">Mostrar</Button>
              </HoverCardTrigger>
              <HoverCardContent className="flex w-64 flex-col gap-0.5">
                <div className="font-semibold">{directionGeneral}</div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </>
      );
    },
  },
  {
    accessorKey: "DireccionLinea.direccion_linea",
    header: "División ",
    id: "División / Coordinación",
    cell: ({ getValue }) => {
      const dirLine = getValue() as string;
      if (!dirLine)
        return (
          <Button variant={"destructive"} className="w-full">
            N/A
          </Button>
        );
      return (
        <>
          <div>
            <HoverCard openDelay={10} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button className="w-full">Mostrar</Button>
              </HoverCardTrigger>
              <HoverCardContent className="flex w-64 flex-col gap-0.5">
                <div className="font-semibold">{dirLine}</div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </>
      );
    },
  },
  {
    accessorKey: "Coordinacion.coordinacion",
    header: "Coordinación",
    cell: ({ getValue }) => {
      const coord = getValue() as string;
      if (!coord)
        return (
          <Button variant={"destructive"} className="w-full">
            N/A
          </Button>
        );
      return (
        <>
          <div>
            <HoverCard openDelay={10} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Button className="w-full">Mostrar</Button>
              </HoverCardTrigger>
              <HoverCardContent className="flex w-64 flex-col gap-0.5">
                <div className="font-semibold">{coord}</div>
              </HoverCardContent>
            </HoverCard>
          </div>
        </>
      );
    },
  },
  {
    accessorKey: "estatusid.estatus",
    header: "Estatus",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      if (status == "VACANTE")
        return (
          <Badge variant={"default"} className="bg-green-700">
            {status}
          </Badge>
        );
      return <Badge variant={"destructive"}>{status}</Badge>;
    },
  },
  {
    accessorKey: "fecha_actualizacion",
    header: "F. Actualización",
    cell: ({ getValue }) => {
      const date = getValue() as Date;
      if (!date) return "N/A";
      return formatInTimeZone(date, "UTC", "dd/MM/yyy");
    },
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const codigo = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir Menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(codigo.codigo)}
            >
              Copiar Código
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <UpdateCode code={codigo} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
