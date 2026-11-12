import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { FamiliarDTO } from "../application/dtos/familiar-dto";
import { AccionesCell } from "./familiares-columns";

const familiarCompleto: FamiliarDTO = {
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
};

async function abrirMenu() {
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("button", { name: /abrir menú/i }));
  return usuario;
}

describe("AccionesCell de familiares", () => {
  it("usa el mismo menú que Personal: acciones, extras y Ver detalle como principal", async () => {
    render(
      <AccionesCell
        familiar={familiarCompleto}
        puedeEliminar={false}
        onVerDetalle={vi.fn()}
        onEliminar={vi.fn()}
      />,
    );

    await abrirMenu();

    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(screen.getByText("Copiar cédula")).toBeInTheDocument();
    expect(screen.getByText("Ver detalle")).toBeInTheDocument();
    expect(screen.queryByText("Eliminar")).not.toBeInTheDocument();
  });

  it("abre el detalle al pulsar la acción principal", async () => {
    const onVerDetalle = vi.fn();
    render(
      <AccionesCell
        familiar={familiarCompleto}
        puedeEliminar={false}
        onVerDetalle={onVerDetalle}
        onEliminar={vi.fn()}
      />,
    );

    const usuario = await abrirMenu();
    await usuario.click(screen.getByText("Ver detalle"));

    expect(onVerDetalle).toHaveBeenCalledWith(familiarCompleto);
  });

  it("ofrece eliminar en Extras solo con permiso", async () => {
    const onEliminar = vi.fn();
    render(
      <AccionesCell
        familiar={familiarCompleto}
        puedeEliminar
        onVerDetalle={vi.fn()}
        onEliminar={onEliminar}
      />,
    );

    const usuario = await abrirMenu();
    expect(screen.getByText("Extras")).toBeInTheDocument();
    await usuario.click(screen.getByText("Eliminar"));

    expect(onEliminar).toHaveBeenCalledWith(familiarCompleto);
  });
});
