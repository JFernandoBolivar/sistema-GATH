"use client";

/**
 * Tabla genérica reutilizable sobre `@tanstack/react-table`. Réplica del
 * patrón del legado (`dashboard/gestion-trabajadores/components/employees/tableEmployees/data-table.tsx`),
 * movida a `shared/ui/components/` (a pedido del coordinador) para que los
 * 12 módulos de `modules/*` la reutilicen en vez de reinventarla cada uno.
 * Mismo comportamiento: menú "Columnas" para mostrar/ocultar, orden y
 * visibilidad de columnas vía tanstack. Se agrega un mensaje de "sin
 * resultados" configurable y un slot de toolbar opcional (búsqueda, botón
 * "Nuevo", etc.) para que cada módulo inserte sus propios controles sin
 * tocar este componente.
 */
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Controles a la izquierda de la barra superior (búsqueda, "Nuevo", etc.). */
  toolbar?: ReactNode;
  emptyMessage?: string;
  /** Oculta el menú "Columnas" cuando la tabla es demasiado angosta para tener sentido. */
  hideColumnsMenu?: boolean;
  hidePagination?: boolean;
  /**
   * Paginación en servidor: `data` es solo la página actual y los botones
   * Anterior/Siguiente piden otra página al consumidor.
   */
  pagination?: {
    pageIndex: number;
    pageSize: number;
    total: number;
    onPageChange: (pageIndex: number) => void;
  };
}

export function DataTable<TData, TValue>({
  columns,
  data,
  toolbar,
  emptyMessage = "Sin resultados.",
  hideColumnsMenu = false,
  hidePagination = false,
  pagination,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const manual = pagination !== undefined;
  // Con `hidePagination` quien pagina es la página (en el servidor): la tabla muestra
  // todas las filas que recibe. Antes seguía cortando en 10 filas aunque llegaran 50.
  const paginaEnCliente = !manual && !hidePagination;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(paginaEnCliente ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: manual,
    ...(manual
      ? {
          pageCount: Math.max(1, Math.ceil(pagination.total / pagination.pageSize)),
          onPaginationChange: (updater) => {
            const actual = {
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
            };
            const siguiente =
              typeof updater === "function" ? updater(actual) : updater;
            if (siguiente.pageIndex !== actual.pageIndex) {
              pagination.onPageChange(siguiente.pageIndex);
            }
          },
        }
      : {}),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(manual
        ? {
            pagination: {
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
            },
          }
        : {}),
    },
  });

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 py-4">
        <div className="flex flex-1 items-center gap-2">{toolbar}</div>
        {!hideColumnsMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!hidePagination && (
      <div className="flex items-center justify-end gap-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ArrowLeft className="mr-1 size-4" />
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>
      )}
    </div>
  );
}
