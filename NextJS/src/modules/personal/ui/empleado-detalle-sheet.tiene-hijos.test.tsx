import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/actions/personal-actions", () => ({
  actualizarEmpleadoAction: vi.fn(),
  actualizarTieneHijosAction: vi.fn(),
  subirFotoEmpleadoAction: vi.fn(),
}));
vi.mock("./dialogs/form-basic-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-academic-training-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-background-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-contrato-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-dwelling-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-emergency-contacts-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-health-profile-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-physical-profile-update-dialog", () => ({ default: () => null }));
vi.mock("./dialogs/form-supplementary-training-update-dialog", () => ({ default: () => null }));

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";
import EmpleadoDetalleSheet from "./empleado-detalle-sheet";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";


function pintar(tieneHijos: boolean | null | undefined, puedeEditar: boolean) {
  const empleado = {
    id: 1,
    cedula: "123",
    nombres: "ANA",
    apellidos: "PEREZ",
    nombreCompleto: "ANA PEREZ",
    tieneHijos,
  } as unknown as EmpleadoDTO;
  render(
    <EmpleadoDetalleSheet
      detalle={construirDetalleExpediente(empleado, null)}
      empleado={empleado}
      catalogos={null}
      open
      onOpenChange={vi.fn()}
      onExportarPdf={vi.fn()}
      onGuardado={vi.fn()}
      exportandoPdf={false}
      puedeExportarPdf={false}
      puedeEditar={puedeEditar}
    />,
  );
}

describe("EmpleadoDetalleSheet: ¿Tiene hijos?", () => {
  it.each([
    [true, "Sí"],
    [false, "No"],
    [null, "Sin dato"],
    [undefined, "Sin dato"],
  ])("con %s muestra %s", (valor, texto) => {
    pintar(valor, false);
    expect(screen.getByText("¿Tiene Hijos?:")).toBeInTheDocument();
    expect(screen.getByText(texto, { selector: "div" })).toBeInTheDocument();
  });

  it("el botón Actualizar de Grupo Familiar solo aparece con permiso", () => {
    pintar(true, false);
    expect(screen.queryByRole("button", { name: "Actualizar" })).toBeNull();
  });

  it("con permiso ofrece el botón Actualizar", () => {
    pintar(true, true);
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
  });
});
