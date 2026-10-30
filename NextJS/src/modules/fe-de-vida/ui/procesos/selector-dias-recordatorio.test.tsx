import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelectorDiasRecordatorio } from "./selector-dias-recordatorio";

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
