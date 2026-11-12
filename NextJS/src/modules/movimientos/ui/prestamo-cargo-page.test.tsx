import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/infrastructure/actions/employee-actions", () => ({
  getEmpleadoPorCedulaAction: vi.fn().mockResolvedValue({
    id: 1,
    cedula: "99000302",
    nombres: "JUAN",
    apellidos: "PEREZ",
    contratoActual: null,
  }),
}));

vi.mock("@/modules/cargos/infrastructure/actions/cargos-actions", () => ({
  getPrestamosAction: vi.fn().mockResolvedValue([]),
  registrarEncargaduriaAction: vi.fn(),
  finalizarPrestamoAction: vi.fn(),
  getCargosPaginadoAction: vi.fn().mockResolvedValue({ results: [], count: 0 }),
}));

vi.mock("@/shared/components/contrato-inline-form", () => ({
  ContratoInlineForm: () => <div data-testid="contrato-form">Registrar contrato</div>,
}));

vi.mock("@/modules/cargos/ui/components/motivo-select", () => ({
  MotivoSelect: () => <div />,
}));

import { PrestamoCargoPage } from "./prestamo-cargo-page";

describe("PrestamoCargoPage", () => {
  it("muestra el buscador de cargo deshabilitado cuando falta el contrato", async () => {
    render(<PrestamoCargoPage />);
    const input = document.getElementById("searchEmployeeForm") as HTMLInputElement;
    await userEvent.type(input, "99000302{enter}");

    expect(await screen.findByText("Registre primero el contrato")).toBeInTheDocument();
    await waitFor(() => {
      const trigger = document.getElementById("buscar-cargo");
      expect(trigger).not.toBeNull();
      expect(trigger).toBeDisabled();
    });
  });
});
