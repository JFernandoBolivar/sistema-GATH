import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SECCIONES_DEF } from "../../domain/value-objects/campos-seccion";
import { SelectorCamposSolicitud } from "./selector-campos-solicitud";

function montar(codigo: keyof typeof SECCIONES_DEF, valor: string[] = []) {
  const onCambio = vi.fn();
  render(
    <ul>
      <SelectorCamposSolicitud
        seccion={SECCIONES_DEF[codigo]}
        requiereSoporte={false}
        valor={valor}
        onCambio={onCambio}
      />
    </ul>,
  );
  return onCambio;
}

describe("SelectorCamposSolicitud (paso 1)", () => {
  it("en el grupo familiar ofrece Agregar, Corregir y Quitar, no campos sueltos", () => {
    montar("familiar");
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Agregar" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Corregir" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grupo familiar: Quitar" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Primer nombre/ })).toBeNull();
    // La casilla simple de la misma sección (¿Tiene hijos?) se conserva.
    expect(screen.getByRole("checkbox", { name: /Tiene hijos/ })).toBeInTheDocument();
  });

  it("marcar Agregar devuelve la clave de acción y respeta lo ya marcado", async () => {
    const onCambio = montar("familiar", ["employee.telefono_movil"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Grupo familiar: Agregar" }));
    expect(onCambio).toHaveBeenCalledWith(["employee.telefono_movil", "familiar.@CREAR"]);
  });

  it("desmarcar quita solo esa acción (se pueden marcar varias)", async () => {
    const onCambio = montar("familiar", ["familiar.@CREAR", "familiar.@ELIMINAR"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Grupo familiar: Quitar" }));
    expect(onCambio).toHaveBeenCalledWith(["familiar.@CREAR"]);
  });

  it("contacto mezcla campos simples (teléfonos) y acciones (contactos de emergencia)", () => {
    montar("contacto");
    expect(screen.getByRole("checkbox", { name: "Contacto: Teléfono móvil" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Contactos de emergencia: Agregar" }),
    ).toBeInTheDocument();
  });

  it("las secciones simples siguen mostrando sus campos", () => {
    montar("vivienda");
    expect(
      screen.getByRole("checkbox", { name: "Vivienda: Dirección exacta" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Agregar/ })).toBeNull();
  });
});
