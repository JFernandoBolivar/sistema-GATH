import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcesoPlantilla } from "../../domain/entities/plantilla";
import { CrearPlantillaDialog } from "./crear-plantilla-dialog";

const crearMock = vi.fn();
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../infrastructure/actions/documentos-actions", () => ({
  crearPlantillaAction: (...args: unknown[]) => crearMock(...args),
}));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

const procesos: ProcesoPlantilla[] = [
  {
    codigo: "bajo_demanda",
    etiqueta: "Bajo demanda",
    descripcion: "Documentos solicitados por usuarios autorizados.",
    grupo: "bajo_demanda",
    grupos_variables: ["Identificación"],
  },
  {
    codigo: "ingreso_ventana2",
    etiqueta: "Ingreso por Ventana 2",
    descripcion: "Documentos del ingreso de personal.",
    grupo: "ingreso",
    grupos_variables: ["Identificación"],
  },
];

beforeEach(() => crearMock.mockReset());

describe("CrearPlantillaDialog", () => {
  it("no preselecciona un proceso y envía el elegido explícitamente", async () => {
    const user = userEvent.setup();
    crearMock.mockResolvedValue({ success: true, data: { id: "p1" } });
    const onCreada = vi.fn();
    render(<CrearPlantillaDialog abierto procesos={procesos} onCerrar={vi.fn()} onCreada={onCreada} />);

    await user.type(screen.getByLabelText("Nombre"), "Constancia de trabajo");
    await user.clear(screen.getByLabelText("Código"));
    await user.type(screen.getByLabelText("Código"), "CONSTANCIA");
    const boton = screen.getByRole("button", { name: "Crear y diseñar" });
    expect(boton).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "¿En qué proceso se usa?" }));
    await user.click(await screen.findByRole("option", { name: /Bajo demanda.*Documentos solicitados/ }));
    expect(boton).toBeEnabled();
    await user.click(boton);

    await waitFor(() => expect(crearMock).toHaveBeenCalledTimes(1));
    expect(crearMock.mock.calls[0][0]).toMatchObject({
      codigo: "CONSTANCIA",
      nombre: "Constancia de trabajo",
      proceso: "bajo_demanda",
    });
    expect(onCreada).toHaveBeenCalledWith({ id: "p1" });
  });
});
