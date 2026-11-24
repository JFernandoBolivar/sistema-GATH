import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { TipoEntrega } from "../../domain/entrega";
import { SelectorEntrega } from "./selector-entrega";

function Montado({ correo, inicial = "persona" as TipoEntrega, alCambiar = () => {} }: { correo?: string; inicial?: TipoEntrega; alCambiar?: (v: TipoEntrega) => void }) {
  const [valor, setValor] = React.useState<TipoEntrega>(inicial);
  return <SelectorEntrega valor={valor} onCambio={(v) => { setValor(v); alCambiar(v); }} correo={correo} />;
}

describe("<SelectorEntrega />", () => {
  it("ofrece las dos opciones como radios con su etiqueta enlazada (id/htmlFor)", () => {
    render(<Montado correo="ana@ejemplo.invalid" />);
    const persona = screen.getByRole("radio", { name: /entregar en persona/i });
    const correo = screen.getByRole("radio", { name: /enviar enlace por correo/i });
    expect(persona).toBeChecked();
    expect(correo).not.toBeChecked();
    expect(persona.id).not.toBe("");
    expect(screen.getByText(/entregar en persona/i).closest("label")).toHaveAttribute("for", persona.id);
    expect(correo.className).toMatch(/relative/);
    expect(correo.className).toMatch(/z-10/);
  });

  it("con correo muestra el destino y el recordatorio destacado, y permite elegirlo", async () => {
    const cambios: TipoEntrega[] = [];
    render(<Montado correo="ana@ejemplo.invalid" alCambiar={(v) => cambios.push(v)} />);
    expect(screen.getByTestId("entrega-correo-destino")).toHaveTextContent("ana@ejemplo.invalid");
    expect(screen.getByText(/confirma el correo con la persona antes de enviar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /enviar enlace por correo/i }));
    expect(cambios).toEqual(["correo"]);
    expect(screen.getByRole("radio", { name: /enviar enlace por correo/i })).toBeChecked();
    expect(screen.getByTestId("entrega-correo-destino")).toHaveAttribute("role", "note");
  });

  it("sin correo deshabilita el envío por correo y explica por qué", async () => {
    const cambios: TipoEntrega[] = [];
    render(<Montado correo="" alCambiar={(v) => cambios.push(v)} />);
    const correo = screen.getByRole("radio", { name: /enviar enlace por correo/i });
    expect(correo).toBeDisabled();
    expect(screen.getByTestId("entrega-sin-correo")).toHaveTextContent(/no tiene un correo registrado/i);
    expect(screen.queryByTestId("entrega-correo-destino")).not.toBeInTheDocument();
    await userEvent.click(correo);
    expect(cambios).toEqual([]);
  });

  it("un correo con forma inválida tampoco habilita el envío y, si estaba elegido, vuelve a «en persona»", () => {
    render(<Montado correo="ana@" inicial="correo" />);
    expect(screen.getByRole("radio", { name: /enviar enlace por correo/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /entregar en persona/i })).toBeChecked();
  });
});
