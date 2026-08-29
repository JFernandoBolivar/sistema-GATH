"use client";
import { EmployeeData } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { ColumnDef, Row } from "@tanstack/react-table";
import { useMemo } from "react";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "./data-table-column-header";

import ExportButton from "@/components/ui/ExportButtonPDF";
import { useSearchStore } from "@/hooks/use-search-params";
import { formatInTimeZone } from "date-fns-tz";
import { puede } from "@/shared/lib/evaluador-iam";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { imageProfileFn } from "../../../api/getInfoRac";
import { ReportPDFEmployee } from "../../../reportes/empleados/pdf/reportEmployeePDF";
import DetailInfoEmployee from "./detail-info";

function EmployeeActionsCell({ row }: { row: Row<EmployeeData> }) {
  const searchParams = useSearchStore((state) => state.searchParams);
  const employee = row.original;
  const { data: profileBlob } = useSWR(["profile", searchParams], () =>
    imageProfileFn(employee.cedulaidentidad),
  );
  const imageURL = useMemo(
    () => profileBlob
      ? URL.createObjectURL(profileBlob)
      : "/bg.png",
    [profileBlob],
  );
  const session = useSession();
  // PBAC: soloLectura si no tiene permiso de edición o creación de reportes
  const soloLectura =
    !puede(session?.data?.user?.permisos, "personal.editar") ||
    session?.data?.user?.role?.nombre_rol === "RECEPCIONISTA";


  const pdfDocument = useMemo(
    () => (
      <ReportPDFEmployee
        employeeData={[employee]}
        photoUrl={imageURL}
        id="Sistema"
        session={session}
      />
    ),
    [employee, imageURL],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir Menu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            navigator.clipboard.writeText(employee.cedulaidentidad)
          }
        >
          Copiar Cédula De Identidad
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Extras</DropdownMenuLabel>
        {!soloLectura && (
        <DropdownMenuItem>
          <ExportButton
            className="w-full"
            fileName={`${employee.nombres}-${employee.apellidos}-expediente.pdf`}
            document={pdfDocument}
          />
        </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <DetailInfoEmployee employee={employee} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<EmployeeData>[] = [
  {
    accessorKey: "cedulaidentidad",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cédula" />
    ),
  },
  {
    accessorKey: "nombres",
    header: "Nombres",
  },
  {
    accessorKey: "apellidos",
    header: "Apellidos",
  },
  {
    accessorKey: "sexo.sexo",
    header: "Sexo",
    cell: ({ getValue }) => {
      const sex = getValue() as string;
      return <span>{sex[0]}</span>;
    },
  },
  {
    accessorKey: "fecha_nacimiento",
    header: "F. Nacimiento",
    cell: ({ getValue }) => {
      const fecha = getValue() as string;
      return (
        <span>
          {" "}
          {fecha ? formatInTimeZone(fecha, "UTC", "dd/MM/yyy") : "N/A"}
        </span>
      );
    },
  },
  {
    id: "estatus_contrato",
    accessorKey: "contrato",
    header: "Estatus Contrato",
    cell: ({ getValue }) => {
      const contratos = getValue() as { estatus?: { estatus: string } }[] | null;
      const activo = contratos?.find(c => c.estatus?.estatus === 'ACTIVO' || c.estatus?.estatus === 'POR VENCER');
      if (!activo?.estatus) return <span>N/A</span>;
      const estatus = activo.estatus.estatus;
      const color = estatus === 'ACTIVO' ? 'bg-green-600' : estatus === 'POR VENCER' ? 'bg-yellow-500' : 'bg-red-600';
      return <Badge className={`${color} text-white`}>{estatus}</Badge>;
    },
  },
  {
    accessorKey: "contrato",
    header: "F. Ingreso Organismo",
    id: "fecha_ingreso_org",
    cell: ({ getValue }) => {
      const contratos = getValue() as { fecha_ingreso?: string; estatus?: { estatus: string } }[] | null;
      const sorted = contratos
        ?.filter(c => c.fecha_ingreso)
        .sort((a, b) => new Date(a.fecha_ingreso!).getTime() - new Date(b.fecha_ingreso!).getTime());
      const fecha = sorted?.[0]?.fecha_ingreso;
      return (
        <span>
          {fecha ? formatInTimeZone(fecha, "UTC", "dd/MM/yyy") : "N/A"}
        </span>
      );
    },
  },

  {
    accessorKey: "actions",
    header: "Acciones",
    cell: ({ row }) => <EmployeeActionsCell row={row} />,
  },
];
