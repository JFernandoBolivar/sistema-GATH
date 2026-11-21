import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpcionesRadio } from "./opciones-radio";

const opciones = [["F", "Femenino"], ["M", "Masculino"]] as const;

describe("OpcionesRadio", () => {
  it("el radio y su etiqueta no están anidados", () => {
    render(<OpcionesRadio value="" onChange={() => {}} opciones={opciones} etiquetadoPor="x" />);
    const radio = screen.getByRole("radio", { name: "Femenino" });
    expect(radio.closest("label")).toBeNull();
  });

  it("tocar la opción (puntero táctil) cambia el valor", async () => {
    const onChange = vi.fn();
    render(<OpcionesRadio value="" onChange={onChange} opciones={opciones} etiquetadoPor="x" />);
    await userEvent.pointer([{ keys: "[TouchA>]", target: screen.getByText("Femenino") }, { keys: "[/TouchA]" }]);
    await userEvent.click(screen.getByText("Masculino"));
    expect(onChange).toHaveBeenCalledWith("M");
  });

  it("clic en el radio también cambia el valor", () => {
    const onChange = vi.fn();
    render(<OpcionesRadio value="" onChange={onChange} opciones={opciones} etiquetadoPor="x" />);
    fireEvent.click(screen.getByRole("radio", { name: "Femenino" }));
    expect(onChange).toHaveBeenCalledWith("F");
  });
});
