import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";

vi.mock("./formulario-registro", () => ({ FormularioRegistro: () => null }));
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
