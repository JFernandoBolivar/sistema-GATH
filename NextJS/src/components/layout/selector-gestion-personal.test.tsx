import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sesion = vi.hoisted(() => ({ permisos: ["personal.ver", "pasivos.ver"] }));
const ruta = vi.hoisted(() => ({ actual: "/personal/consultar" }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: sesion.permisos } } }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => ruta.actual,
}));

import { SelectorGestionPersonal } from "./selector-gestion-personal";

describe("SelectorGestionPersonal", () => {
  it("muestra el módulo activo y permite cambiar al pasivo", async () => {
    ruta.actual = "/personal/consultar";
    const usuario = userEvent.setup();
    render(<SelectorGestionPersonal tono="claro" />);

    const boton = screen.getByRole("button", { name: /gestion personal activo/i });
    await usuario.click(boton);
    expect(screen.getByRole("menuitem", { name: /personal pasivo/i })).toHaveAttribute(
      "href",
      "/pasivos",
    );
  });

  it("en una ruta de pasivos muestra «Gestion Personal Pasivo»", () => {
    ruta.actual = "/pasivos/consultar";
    render(<SelectorGestionPersonal />);
    expect(
      screen.getByRole("button", { name: /gestion personal pasivo/i }),
    ).toBeInTheDocument();
  });

  it("no aparece si falta alguno de los dos permisos", () => {
    ruta.actual = "/personal/consultar";
    sesion.permisos = ["personal.ver"];
    const { container } = render(<SelectorGestionPersonal />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no aparece fuera de las rutas de gestión de personal", () => {
    ruta.actual = "/dashboard";
    sesion.permisos = ["personal.ver", "pasivos.ver"];
    const { container } = render(<SelectorGestionPersonal />);
    expect(container).toBeEmptyDOMElement();
  });
});
