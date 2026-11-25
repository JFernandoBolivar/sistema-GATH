import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/seccion-documentos-trabajador", () => ({ SeccionDocumentosTrabajador: () => null }));
vi.mock("../infrastructure/actions/personal-actions", () => ({
  actualizarEmpleadoAction: vi.fn(),
  actualizarTieneHijosAction: vi.fn(),
  actualizarRifAction: vi.fn(),
  actualizarIdiomasAction: vi.fn(),
  listarIdiomasCatalogoAction: vi.fn(),
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

const IDIOMAS = [
  { id: 1, idiomaId: 7, otroIdioma: "", nombre: "Inglés", nivel: "BIEN" },
  { id: 2, idiomaId: null, otroIdioma: "Guaraní", nombre: "Guaraní", nivel: "POCO" },
];

function pintar(
  parcial: Partial<EmpleadoDTO>,
  permisos: { puedeEditar?: boolean; puedeEditarEducacion?: boolean; puedeEditarRif?: boolean; esPasivo?: boolean } = {},
) {
  const empleado = {
    id: 1,
    cedula: "123",
    nombres: "ANA",
    apellidos: "PEREZ",
    nombreCompleto: "ANA PEREZ",
    ...parcial,
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
      puedeEditar={permisos.puedeEditar ?? false}
      puedeEditarEducacion={permisos.puedeEditarEducacion}
      puedeEditarRif={permisos.puedeEditarRif}
      esPasivo={permisos.esPasivo}
    />,
  );
}

describe("EmpleadoDetalleSheet: RIF", () => {
  it("muestra el RIF en datos personales", () => {
    pintar({ rif: "V-12345678-9" });
    expect(screen.getByTestId("rif-trabajador")).toHaveTextContent("V-12345678-9");
  });

  it("sin RIF dice «No registrado»", () => {
    pintar({ rif: null });
    expect(screen.getByTestId("rif-trabajador")).toHaveTextContent("No registrado");
  });

  it("el botón del RIF solo aparece con el permiso de datos personales", () => {
    pintar({ rif: null }, { puedeEditar: false });
    expect(screen.queryByRole("button", { name: /RIF/ })).toBeNull();
  });

  it("con permiso ofrece «Agregar RIF» o «Actualizar RIF» según haya dato", () => {
    pintar({ rif: null }, { puedeEditar: true });
    expect(screen.getByRole("button", { name: "Agregar RIF" })).toBeInTheDocument();
  });

  it("con RIF y permiso ofrece «Actualizar RIF»", () => {
    pintar({ rif: "V-12345678-9" }, { puedeEditar: true });
    expect(screen.getByRole("button", { name: "Actualizar RIF" })).toBeInTheDocument();
  });

  it("la ficha de un pasivo no muestra el RIF (su detalle aún no lo trae)", () => {
    pintar({ rif: "V-12345678-9" }, { puedeEditar: true, esPasivo: true });
    expect(screen.queryByTestId("rif-trabajador")).toBeNull();
  });
});

describe("EmpleadoDetalleSheet: Idiomas", () => {
  it("lista los idiomas con su nivel", () => {
    pintar({ idiomas: IDIOMAS });
    const tabla = screen.getByRole("table", { name: "" });
    expect(within(tabla).getByText("Inglés")).toBeInTheDocument();
    expect(within(tabla).getByText("Bien")).toBeInTheDocument();
    expect(within(tabla).getByText("Guaraní")).toBeInTheDocument();
    expect(within(tabla).getByText("Poco")).toBeInTheDocument();
  });

  it("sin idiomas lo dice", () => {
    pintar({ idiomas: [] });
    expect(screen.getByText("Sin idiomas registrados.")).toBeInTheDocument();
  });

  it("el botón de idiomas depende del permiso de educación, no del de datos personales", () => {
    pintar({ idiomas: IDIOMAS }, { puedeEditar: true, puedeEditarEducacion: false });
    const sin = screen.getAllByRole("button", { name: "Actualizar" }).length;
    cleanup();
    pintar({ idiomas: IDIOMAS }, { puedeEditar: true, puedeEditarEducacion: true });
    expect(screen.getAllByRole("button", { name: "Actualizar" }).length).toBe(sin + 1);
  });

  it("con permiso de educación ofrece Actualizar (o Agregar si no hay idiomas)", () => {
    pintar({ idiomas: IDIOMAS }, { puedeEditarEducacion: true });
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
  });

  it("sin idiomas y con permiso ofrece Agregar", () => {
    pintar({ idiomas: [] }, { puedeEditarEducacion: true });
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
  });
});
