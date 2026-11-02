import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CircleCheck } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { LineaTiempo } from "./linea-tiempo";
import { FieldCompare } from "./field-compare";
import { PageHeader } from "./page-header";
import { VistaCargando, VistaError, VistaVacia } from "./vista-estados";

describe("StatusBadge", () => {
  it("comunica el estado con texto, no solo con color", () => {
    render(<StatusBadge texto="Aprobada" tono="success" icono={CircleCheck} />);
    const insignia = screen.getByText("Aprobada");
    expect(insignia).toHaveAttribute("data-tono", "success");
    expect(insignia.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LineaTiempo", () => {
  it("es una lista ordenada y marca el paso actual con aria-current", () => {
    render(
      <LineaTiempo
        etiqueta="Avance"
        hitos={[
          { id: "1", titulo: "Solicitada", estado: "hecho", fecha: "01/10/2026" },
          { id: "2", titulo: "Habilitada", estado: "actual" },
          { id: "3", titulo: "Resolución", estado: "pendiente" },
        ]}
      />,
    );
    const lista = screen.getByRole("list", { name: "Avance" });
    expect(lista.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(screen.getByText(/Paso actual/)).toBeInTheDocument();
  });
});

describe("FieldCompare", () => {
  it("muestra valor actual y propuesto con el tipo de diferencia en texto", () => {
    render(
      <FieldCompare
        etiqueta="Teléfono móvil"
        actual="0412-1"
        propuesto="0414-2"
        diferencia="difiere"
      />,
    );
    expect(screen.getByRole("heading", { name: "Teléfono móvil" })).toBeInTheDocument();
    expect(screen.getByText("0412-1")).toBeInTheDocument();
    expect(screen.getByText("0414-2")).toBeInTheDocument();
    expect(screen.getByText("Difiere de lo registrado")).toBeInTheDocument();
  });
  it("avisa del conflicto y muestra los controles de decisión", () => {
    render(
      <FieldCompare
        etiqueta="Dirección"
        actual="A"
        propuesto="B"
        diferencia="difiere"
        conflicto
        decision={<button>Rechazar</button>}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(/solo puede rechazarse/);
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });
  it("marca el registro nuevo", () => {
    render(
      <FieldCompare etiqueta="Familiar" actual="No existe" propuesto="Ana" diferencia="nuevo" />,
    );
    expect(screen.getByText("Registro nuevo")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renderiza un único h1 con descripción y acción", () => {
    render(
      <PageHeader
        titulo="Mis solicitudes"
        descripcion="Vea su avance"
        accion={<button>Nueva</button>}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Vea su avance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva" })).toBeInTheDocument();
  });
});

describe("estados de vista", () => {
  it("cargando se anuncia con role=status", () => {
    render(<VistaCargando mensaje="Cargando solicitudes…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando solicitudes…");
  });
  it("el error ofrece Reintentar", async () => {
    const reintentar = vi.fn();
    render(<VistaError mensaje="No se pudo cargar." onReintentar={reintentar} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reintentar).toHaveBeenCalledTimes(1);
  });
  it("el estado vacío explica qué ocurre", () => {
    render(<VistaVacia titulo="No hay solicitudes" descripcion="Pruebe otro filtro." />);
    expect(screen.getByText("No hay solicitudes")).toBeInTheDocument();
    expect(screen.getByText("Pruebe otro filtro.")).toBeInTheDocument();
  });
});
