import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acciones = vi.hoisted(() => ({
  actualizarCategoriaEventoAction: vi.fn(),
  actualizarZonaEventoAction: vi.fn(),
  crearCategoriaEventoAction: vi.fn(),
  crearZonaEventoAction: vi.fn(),
  eliminarCategoriaEventoAction: vi.fn(),
  eliminarZonaEventoAction: vi.fn(),
}));

vi.mock("@/modules/carnetizacion/infrastructure/actions/eventos-actions", () => acciones);

import { ZonasCategoriasPanel } from "./zonas-categorias-panel";

const categorias = [{ id: "c1", evento_id: "e", nombre: "Prensa", color_primario: "#112233", color_acento: "#111", orden: 1 }];
const zonas = [{ id: "z1", evento_id: "e", nombre: "Auditorio", codigo: "AUD", orden: 1 }];

describe("ZonasCategoriasPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea una zona", async () => {
    const onCambio = vi.fn();
    acciones.crearZonaEventoAction.mockResolvedValue({});
    render(<ZonasCategoriasPanel eventoId="e" categorias={categorias} zonas={zonas} onCambio={onCambio} />);
    fireEvent.change(screen.getByPlaceholderText(/Nombre de zona/), { target: { value: "Puerta 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar zona" }));
    await waitFor(() => expect(acciones.crearZonaEventoAction).toHaveBeenCalledWith("e", { nombre: "Puerta 2", codigo: undefined }));
    expect(onCambio).toHaveBeenCalledWith("Zona agregada.");
  });

  it("renombra una categoría", async () => {
    acciones.actualizarCategoriaEventoAction.mockResolvedValue({});
    render(<ZonasCategoriasPanel eventoId="e" categorias={categorias} zonas={zonas} onCambio={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Renombrar Prensa" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Prensa VIP" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(acciones.actualizarCategoriaEventoAction).toHaveBeenCalledWith("c1", {
        nombre: "Prensa VIP",
        color_primario: "#112233",
      })
    );
  });

  it("muestra el mensaje del servidor cuando la zona tiene invitados", async () => {
    acciones.eliminarZonaEventoAction.mockRejectedValue(
      new Error("No se puede eliminar la zona: tiene 3 invitados asignados.")
    );
    render(<ZonasCategoriasPanel eventoId="e" categorias={categorias} zonas={zonas} onCambio={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Auditorio" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("tiene 3 invitados asignados");
  });

  it("elimina una categoría tras confirmar", async () => {
    const onCambio = vi.fn();
    acciones.eliminarCategoriaEventoAction.mockResolvedValue(undefined);
    render(<ZonasCategoriasPanel eventoId="e" categorias={categorias} zonas={zonas} onCambio={onCambio} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Prensa" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(acciones.eliminarCategoriaEventoAction).toHaveBeenCalledWith("c1"));
    expect(onCambio).toHaveBeenCalledWith("Categoría eliminada.");
  });
});
