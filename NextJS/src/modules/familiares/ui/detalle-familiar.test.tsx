import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../infrastructure/actions/familiares-actions", () => ({
  getCatalogosFamiliarAction: vi.fn(async () => ({
    parentescos: [{ id: 6, nombre: "PADRE" }],
    sexos: [{ id: 1, nombre: "MASCULINO" }],
    nivelesAcademicos: [],
    carreras: [],
    menciones: [],
    instituciones: [],
    tiposPrenda: [],
    tallas: [],
    gruposSanguineos: [],
    alergias: [],
    patologias: [],
    discapacidades: [],
  })),
  getDocumentosFamiliarAction: vi.fn(async () => []),
  actualizarFamiliarAction: vi.fn(),
  subirDocumentoFamiliarAction: vi.fn(),
  reemplazarDocumentoFamiliarAction: vi.fn(),
}));

import type { FamiliarDTO } from "../application/dtos/familiar-dto";
import { DetalleFamiliar } from "./detalle-familiar";

const familiar: FamiliarDTO = {
  id: 7,
  empleadoCedula: "5132733",
  cedulaFamiliar: "99999999",
  ordenHijo: null,
  primerNombre: "LUIS",
  segundoNombre: null,
  primerApellido: "MORA",
  segundoApellido: null,
  parentescoId: 6,
  parentescoNombre: "PADRE",
  fechaNacimiento: "1950-01-01",
  sexoId: 1,
  sexoNombre: "MASCULINO",
  mismoEnte: false,
  heredero: false,
  observaciones: null,
  perfilSalud: null,
  perfilFisico: null,
  formacionAcademica: null,
};

describe("DetalleFamiliar (OC 2026-11-11, punto 8)", () => {
  it("no tiene un botón general de edición y sí un botón por bloque", async () => {
    render(
      <DetalleFamiliar
        familiar={familiar}
        open
        onOpenChange={vi.fn()}
        puedeEditar
        onGuardado={vi.fn()}
      />,
    );

    // El botón general de arriba ya no existe.
    expect(screen.queryByRole("button", { name: /^Editar$/i })).not.toBeInTheDocument();

    // Un «Actualizar» por bloque: básica, parentesco, formación, vestimenta,
    // salud y documentos.
    const actualizar = await screen.findAllByRole("button", { name: /^Actualizar$/i });
    expect(actualizar.length).toBeGreaterThanOrEqual(6);

    expect(screen.getByText("Información Basica")).toBeInTheDocument();
    expect(screen.getByText("Relacion/Parentesco")).toBeInTheDocument();
    expect(screen.getByText("Formaciones Academicas")).toBeInTheDocument();
    expect(screen.getByText("Información De Vestimenta")).toBeInTheDocument();
    expect(screen.getByText("Información De Salud")).toBeInTheDocument();
    expect(screen.getByText("Documentos Del Familiar")).toBeInTheDocument();
  });

  it("sin permiso de edición no muestra ningún «Actualizar»", () => {
    render(
      <DetalleFamiliar
        familiar={familiar}
        open
        onOpenChange={vi.fn()}
        puedeEditar={false}
        onGuardado={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Actualizar$/i })).not.toBeInTheDocument();
  });
});
