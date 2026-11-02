import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelectorDiasRecordatorio } from "./selector-dias-recordatorio";

// D11/B5: la llamada al servidor falla; el selector debe mostrar el respaldo del dominio.
vi.mock("@/modules/configuracion/infrastructure/actions/parametros-actions", () => ({
  getDiasRecordatorioSugeridosAction: vi.fn().mockRejectedValue(new Error("sin red")),
}));

describe("SelectorDiasRecordatorio", () => {
  it("muestra las opciones sugeridas y marca las elegidas", () => {
    render(<SelectorDiasRecordatorio valor={[7]} onCambiar={() => {}} />);
    expect(screen.getByRole("button", { name: "7 días antes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "1 día antes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "30 días antes" })).toBeInTheDocument();
  });

  it("muestra los 5 chips de respaldo aunque la llamada al servidor falle", async () => {
    render(<SelectorDiasRecordatorio valor={[]} onCambiar={() => {}} />);
    await waitFor(() => {
      for (const dia of [30, 15, 7, 3, 1]) {
        expect(
          screen.getByRole("button", { name: `${dia} ${dia === 1 ? "día" : "días"} antes` }),
        ).toBeInTheDocument();
      }
    });
  });

  it("marcar y desmarcar cambia la lista", () => {
    const onCambiar = vi.fn();
    render(<SelectorDiasRecordatorio valor={[7]} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByRole("button", { name: "3 días antes" }));
    expect(onCambiar).toHaveBeenLastCalledWith([7, 3]);
    fireEvent.click(screen.getByRole("button", { name: "7 días antes" }));
    expect(onCambiar).toHaveBeenLastCalledWith([]);
  });

  it("agrega un día personalizado y lo muestra como opción", () => {
    const onCambiar = vi.fn();
    const { rerender } = render(<SelectorDiasRecordatorio valor={[]} onCambiar={onCambiar} />);
    fireEvent.change(screen.getByLabelText("Agregar otro día"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(onCambiar).toHaveBeenLastCalledWith([10]);
    rerender(<SelectorDiasRecordatorio valor={[10]} onCambiar={onCambiar} />);
    expect(screen.getByRole("button", { name: "10 días antes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("rechaza un día fuera de rango sin cambiar la lista", () => {
    const onCambiar = vi.fn();
    render(<SelectorDiasRecordatorio valor={[]} onCambiar={onCambiar} />);
    fireEvent.change(screen.getByLabelText("Agregar otro día"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(onCambiar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 y 365");
  });
});
