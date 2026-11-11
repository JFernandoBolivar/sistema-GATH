import { render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";

type Fila = { id: number };
const columnas: ColumnDef<Fila>[] = [{ accessorKey: "id", header: "ID" }];
const filas = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

describe("DataTable", () => {
  it("con hidePagination muestra todas las filas recibidas (paginación en el servidor)", () => {
    render(<DataTable columns={columnas} data={filas} hidePagination />);
    expect(screen.getAllByRole("row")).toHaveLength(51);
  });

  it("sin hidePagination sigue paginando en el cliente", () => {
    render(<DataTable columns={columnas} data={filas} />);
    expect(screen.getAllByRole("row").length).toBeLessThan(51);
  });
});
