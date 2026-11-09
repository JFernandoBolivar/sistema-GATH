import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/modules/catalogos/infrastructure/actions/catalogos-actions", () => ({
  crearParentescoAction: vi.fn(),
}));

vi.mock("../../infrastructure/actions/solicitudes-actions", () => ({
  listarCatalogoAction: vi.fn(),
}));

import { render, screen } from "@testing-library/react";
import { FormularioRegistro } from "./formulario-registro";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";
import { esquemaDeEntidad } from "../schema/schema-solicitud";

vi.mock("./opciones-catalogo", () => ({
  opcionesCatalogo: vi.fn().mockResolvedValue([
    { id: 1, nombre: "Madre" },
    { id: 2, nombre: "Padre" },
    { id: 3, nombre: "Hijo/a" },
  ]),
}));

const definicion = SECCIONES_DEF.familiar.entidades.find((e) => e.entidad === "familiar")!;
const esquema = esquemaDeEntidad("familiar", "familiar")!;

describe("FormularioRegistro - Campos obligatorios de familiar (TLF2-11)", () => {
  it("en modo CREAR muestra asterisco en todos los campos obligatorios", () => {
    render(
      <FormularioRegistro
        seccion="familiar"
        definicion={definicion}
        esquema={esquema}
        modo="CREAR"
        inicial={{}}
        textoGuardar="Agregar familiar"
        onGuardar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

    expect(screen.getByText(/Primer nombre/i)).toHaveTextContent("*");
    expect(screen.getByText(/Primer apellido/i)).toHaveTextContent("*");
    expect(screen.getByText(/Parentesco/i)).toHaveTextContent("*");
    expect(screen.getByText(/Fecha de nacimiento/i)).toHaveTextContent("*");
    expect(screen.getByText(/Sexo/i)).toHaveTextContent("*");
    expect(screen.getByText(/Cédula del familiar/i)).toHaveTextContent("*");

    expect(screen.getByText(/Segundo nombre/i)).not.toHaveTextContent("*");
    expect(screen.getByText(/Segundo apellido/i)).not.toHaveTextContent("*");
  });

  it("en modo MODIFICAR conserva asterisco en todos los campos obligatorios", () => {
    render(
      <FormularioRegistro
        seccion="familiar"
        definicion={definicion}
        esquema={esquema}
        modo="MODIFICAR"
        inicial={{
          primer_nombre: "María",
          primer_apellido: "González",
          parentesco_id: 1,
          fecha_nacimiento: "1980-05-10",
          sexo_id: 2,
          cedula_familiar: "V-12345678",
        }}
        textoGuardar="Guardar cambios"
        onGuardar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );

    expect(screen.getByText(/Primer nombre/i)).toHaveTextContent("*");
    expect(screen.getByText(/Primer apellido/i)).toHaveTextContent("*");
    expect(screen.getByText(/Parentesco/i)).toHaveTextContent("*");
    expect(screen.getByText(/Fecha de nacimiento/i)).toHaveTextContent("*");
    expect(screen.getByText(/Sexo/i)).toHaveTextContent("*");
    expect(screen.getByText(/Cédula del familiar/i)).toHaveTextContent("*");

    expect(screen.getByText(/Segundo nombre/i)).not.toHaveTextContent("*");
    expect(screen.getByText(/Segundo apellido/i)).not.toHaveTextContent("*");
  });
});
