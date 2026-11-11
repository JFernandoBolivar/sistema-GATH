import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

const mockPaginado = vi.fn();
vi.mock("@/modules/cargos/infrastructure/actions/cargos-actions", () => ({
  getCargosPaginadoAction: (f: unknown) => mockPaginado(f),
}));

import { CargoBuscador } from "./cargo-buscador";
import type { CargoAsignacionDTO } from "@/modules/cargos/application/dtos/cargo-dto";

const cargo = {
  id: 7,
  codigo: "ZZ-007",
  denominacionNombre: "ANALISTA",
  especificaNombre: "ANALISTA I",
  empleadoNombre: "JUAN PEREZ",
  empleadoCedula: "123",
} as CargoAsignacionDTO;

function Formulario({ alElegir }: { alElegir: (id: number) => void }) {
  const [valor, setValor] = useState<CargoAsignacionDTO | null>(null);
  return (
    <CargoBuscador
      value={valor}
      onSelect={(c) => {
        setValor(c);
        if (c) alElegir(c.id);
      }}
    />
  );
}

async function escribir(texto: string) {
  fireEvent.change(screen.getByPlaceholderText(/Buscar código/), { target: { value: texto } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

describe("CargoBuscador", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPaginado.mockReset();
    mockPaginado.mockResolvedValue({ resultados: [cargo], total: 1, pagina: 1, tamano: 20, totalPaginas: 1 });
  });
  afterEach(() => vi.useRealTimers());

  it("no busca con 1 carácter", async () => {
    render(<Formulario alElegir={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await escribir("a");
    expect(mockPaginado).not.toHaveBeenCalled();
    expect(screen.getByText("Escriba al menos 2 caracteres")).toBeTruthy();
  });

  it("con 2 o más caracteres llama a la acción con busqueda, y al elegir completa el formulario", async () => {
    const alElegir = vi.fn();
    render(<Formulario alElegir={alElegir} />);
    fireEvent.click(screen.getByRole("combobox"));
    await escribir("zz");
    expect(mockPaginado).toHaveBeenCalledTimes(1);
    expect(mockPaginado).toHaveBeenCalledWith({ busqueda: "zz", pagina: 1, pageSize: 20 });

    fireEvent.click(screen.getByText(/ZZ-007 - ANALISTA/));
    expect(alElegir).toHaveBeenCalledWith(7);
    expect(screen.getByRole("combobox").textContent).toContain("ZZ-007 - ANALISTA (ANALISTA I) — Titular: JUAN PEREZ");
  });

  it("muestra Sin resultados", async () => {
    mockPaginado.mockResolvedValue({ resultados: [], total: 0, pagina: 1, tamano: 20, totalPaginas: 0 });
    render(<Formulario alElegir={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    await escribir("xx");
    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });
});
