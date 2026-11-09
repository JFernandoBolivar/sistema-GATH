import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock MotivoSelect to inspect the `operacion` prop passed to it
const { motivoSelectMock } = vi.hoisted(() => ({
  motivoSelectMock: vi.fn(),
}));

vi.mock("@/modules/cargos/ui/components/motivo-select", () => ({
  MotivoSelect: (props: { operacion: string; value: number; onChange: (v: number) => void }) => {
    motivoSelectMock(props);
    return (
      <div data-testid="motivo-select" data-operacion={props.operacion}>
        <span>Operación: {props.operacion}</span>
      </div>
    );
  },
}));

vi.mock("@/shared/infrastructure/actions/employee-actions", () => ({
  getEmpleadoPorCedulaAction: vi.fn().mockResolvedValue({
    cedula: "12345678",
    nombres: "JUAN",
    apellidos: "PEREZ",
  }),
}));

vi.mock("@/modules/cargos/infrastructure/actions/cargos-actions", () => ({
  getEstatusAction: vi.fn().mockResolvedValue([
    { id: 1, nombre: "EGRESADO" },
    { id: 2, nombre: "PASIVO" },
  ]),
  getNominaPasivoAction: vi.fn().mockResolvedValue([
    { id: 10, nombre: "NOMINA JUBILADOS" },
  ]),
}));

vi.mock("@/modules/pasivos/infrastructure/actions/pasivos-actions", () => ({
  procesarEgresoAction: vi.fn().mockResolvedValue({ status: "success" }),
}));

import CambiarPasivoPage from "./cambiar-pasivo-page";

describe("O29: CambiarPasivoPage - Operación correcta en MotivoSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utiliza operacion=egreso_activo cuando el estatus es EGRESADO y pase_a_pasivo cuando es PASIVO", async () => {
    const user = userEvent.setup();
    render(<CambiarPasivoPage />);

    // Buscar trabajador
    const inputCedula = screen.getByLabelText(/buscar trabajador/i);
    await user.type(inputCedula, "12345678");
    const buscarBtn = screen.getByRole("button");
    await user.click(buscarBtn);

    // Esperar a que cargue la información del trabajador y el formulario
    await waitFor(() => {
      expect(screen.getByText(/egresado\/pasivo/i)).toBeInTheDocument();
    });

    // Por defecto antes de elegir estatus, no es PASIVO -> operacion="egreso_activo"
    const motivoSelect = screen.getByTestId("motivo-select");
    expect(motivoSelect).toHaveAttribute("data-operacion", "egreso_activo");
  });
});
