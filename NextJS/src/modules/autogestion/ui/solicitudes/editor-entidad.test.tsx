import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";
import type { ItemBorrador } from "../../domain/entities/solicitud-actualizacion";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";

vi.mock("./formulario-registro", () => ({
  FormularioRegistro: ({ inicial }: { inicial?: Record<string, unknown> }) => (
    <div data-testid="formulario-registro">{JSON.stringify(inicial ?? {})}</div>
  ),
}));
vi.mock("./soportes-seccion", () => ({ SoporteRegistro: () => null }));

import { EditorEntidad } from "./editor-entidad";

const ficha = {
  empleado: {},
  familiares: [
    {
      id: 7,
      empleado_cedula: "1",
      primer_nombre: "ANA",
      primer_apellido: "PEREZ",
      parentesco_id: 3,
      parentesco_nombre: "Hija",
      fecha_nacimiento: "2015-01-01",
      sexo_id: 2,
      sexo_nombre: "F",
      mismo_ente: false,
      heredero: false,
    },
  ],
} as unknown as MiExpedienteDTO;

const definicion = SECCIONES_DEF.familiar.entidades.find((e) => e.entidad === "familiar");

function montar(camposHabilitados: string[]) {
  if (!definicion) throw new Error("Falta la definición de familiar");
  render(
    <EditorEntidad
      seccion="familiar"
      definicion={definicion}
      ficha={ficha}
      items={[]}
      nombres={{}}
      camposHabilitados={camposHabilitados}
      onItems={vi.fn()}
    />,
  );
}

function montarConItems(
  seccion: "familiar" | "contacto",
  entidad: "familiar" | "contacto_emergencia",
  items: ItemBorrador[],
) {
  const def = SECCIONES_DEF[seccion].entidades.find((e) => e.entidad === entidad);
  if (!def) throw new Error(`Falta la definición de ${entidad}`);
  render(
    <EditorEntidad
      seccion={seccion}
      definicion={def}
      ficha={ficha}
      items={items}
      nombres={{}}
      camposHabilitados={[`${entidad}.@CREAR`]}
      onItems={vi.fn()}
    />,
  );
}

describe("EditorEntidad (borrador) según las acciones solicitadas", () => {
  it("si solo pidió Agregar no aparecen Modificar ni Quitar", () => {
    montar(["familiar.@CREAR"]);
    expect(screen.getByRole("button", { name: /Agregar/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modificar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
  });

  it("si solo pidió Quitar no aparecen Agregar ni Modificar", () => {
    montar(["familiar.@ELIMINAR"]);
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Modificar" })).toBeNull();
  });

  it("con Corregir solo aparece Modificar", () => {
    montar(["familiar.@MODIFICAR"]);
    expect(screen.getByRole("button", { name: "Modificar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Agregar/ })).toBeNull();
  });

  it("una solicitud vieja con campos sueltos conserva todas las acciones", () => {
    montar(["familiar.primer_nombre", "familiar.primer_apellido"]);
    expect(screen.getByRole("button", { name: "Modificar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeInTheDocument();
  });
});

describe("FIX-AG1: registros nuevos editables", () => {
  it("permite editar un familiar nuevo reutilizando el formulario", async () => {
    montarConItems("familiar", "familiar", [
      {
        seccion: "familiar",
        entidad: "familiar",
        accion: "CREAR",
        campo: "*",
        valor: { primer_nombre: "ANA" },
        referencia: "ref-familiar",
      },
    ]);

    expect(screen.getByText(/Registro nuevo/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Editar/i }));

    const formulario = screen.getByTestId("formulario-registro");
    expect(formulario).toHaveTextContent("ANA");
  });

  it("permite editar un contacto de emergencia nuevo", async () => {
    montarConItems("contacto", "contacto_emergencia", [
      {
        seccion: "contacto",
        entidad: "contacto_emergencia",
        accion: "CREAR",
        campo: "*",
        valor: { nombres: "LUIS" },
        referencia: "ref-contacto",
      },
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Editar/i }));

    expect(screen.getByTestId("formulario-registro")).toHaveTextContent("LUIS");
  });
});
