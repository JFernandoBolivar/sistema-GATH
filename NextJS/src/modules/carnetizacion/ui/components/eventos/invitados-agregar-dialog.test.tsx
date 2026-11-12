import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acciones = vi.hoisted(() => ({
  agregarInvitadosEnBloqueAction: vi.fn(),
  getExternosInvitablesAction: vi.fn(),
  getIdsExternosInvitablesAction: vi.fn(),
  getIdsPersonalInvitableAction: vi.fn(),
  getPersonalInvitableAction: vi.fn(),
  getDependenciasAction: vi.fn(),
}));

vi.mock("@/modules/carnetizacion/infrastructure/actions/eventos-actions", () => acciones);
vi.mock("@/modules/organizacion/infrastructure/actions/organizacion-actions", () => ({
  getDependenciasAction: acciones.getDependenciasAction,
}));

import { InvitadosAgregarDialog } from "./invitados-agregar-dialog";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
}

const persona = (n: number, extra: Record<string, unknown> = {}) => ({
  tipo: "TRABAJADOR",
  clave: `V-${n}`,
  nombre: `Persona ${n}`,
  documento: `V-${n}`,
  cargo: "Analista",
  dependencia: "Oficina",
  condicion: "Activo",
  foto_url: "",
  ya_invitado: false,
  ...extra,
});

const pagina = (resultados: unknown[], total = resultados.length) => ({
  resultados,
  total,
  pagina: 1,
  tamano: 10,
  total_paginas: 1,
});

const categorias = [{ id: "c1", evento_id: "e", nombre: "General", color_primario: "#000", color_acento: "#111", orden: 1 }];
const zonas = [{ id: "z1", evento_id: "e", nombre: "Sala", codigo: "S", orden: 1 }];

function abrir(extra: Record<string, unknown> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    eventoId: "ev-1",
    categorias,
    zonas,
    onAgregados: vi.fn(),
    onGestionarZonasCategorias: vi.fn(),
    ...extra,
  };
  render(<InvitadosAgregarDialog {...props} />);
  return props;
}

describe("InvitadosAgregarDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acciones.getPersonalInvitableAction.mockResolvedValue(
      pagina([persona(1), persona(2), persona(3, { ya_invitado: true })], 3)
    );
    acciones.getExternosInvitablesAction.mockResolvedValue(
      pagina([persona(9, { tipo: "EXTERNO", clave: "ext-9", nombre: "Visitante Nueve" })])
    );
    acciones.getIdsPersonalInvitableAction.mockResolvedValue(["V-1", "V-2"]);
    acciones.getIdsExternosInvitablesAction.mockResolvedValue(["ext-9"]);
    acciones.getDependenciasAction.mockResolvedValue([{ id: 7, codigo: "D7", nombre: "Oficina de Prensa" }]);
    acciones.agregarInvitadosEnBloqueAction.mockResolvedValue({ agregados: 2, duplicados: 0, solicitados: 2 });
  });

  it("muestra las dos pestañas y los filtros de población", async () => {
    abrir();
    expect(screen.getByRole("tab", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Externos registrados" })).toBeInTheDocument();
    await screen.findByText("Persona 1");
    expect(acciones.getPersonalInvitableAction).toHaveBeenCalledWith(
      "ev-1",
      expect.objectContaining({ poblacion: "TODOS" })
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Población" }));
    for (const etiqueta of ["Todos los trabajadores", "Solo activos", "Solo pasivos", "Por dependencia u oficina"]) {
      expect(await screen.findByRole("option", { name: etiqueta })).toBeInTheDocument();
    }
  });

  it("filtra por solo pasivos en el servidor", async () => {
    abrir();
    await screen.findByText("Persona 1");
    fireEvent.click(screen.getByRole("combobox", { name: "Población" }));
    fireEvent.click(await screen.findByRole("option", { name: "Solo pasivos" }));
    await waitFor(() =>
      expect(acciones.getPersonalInvitableAction).toHaveBeenLastCalledWith(
        "ev-1",
        expect.objectContaining({ poblacion: "PASIVOS" })
      )
    );
  });

  it("deshabilita a quien ya está invitado y lo marca", async () => {
    abrir();
    await screen.findByText("Persona 3");
    expect(screen.getByText("Ya invitado")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar a Persona 3" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Seleccionar a Persona 1" })).not.toBeDisabled();
  });

  it("«Seleccionar todos» toma los ids del filtro y habilita Agregar", async () => {
    abrir();
    await screen.findByText("Persona 1");
    expect(screen.getByRole("button", { name: "Agregar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos los 3 del filtro" }));
    expect(await screen.findByText("Se agregarán 2 invitados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar" })).toBeEnabled();
  });

  it("envía cédulas, categoría y zona, y avisa del resultado", async () => {
    const props = abrir();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar a Persona 1" }));
    expect(await screen.findByText("Se agregarán 1 invitado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() =>
      expect(acciones.agregarInvitadosEnBloqueAction).toHaveBeenCalledWith("ev-1", {
        categoria_id: "c1",
        zona_id: "z1",
        cedulas: ["V-1"],
        externos_ids: [],
      })
    );
    await waitFor(() => expect(props.onAgregados).toHaveBeenCalledWith({ agregados: 2, duplicados: 0, solicitados: 2 }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("la pestaña de externos busca credenciales y las envía como externos_ids", async () => {
    abrir();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Externos registrados" }));
    fireEvent.click(screen.getByRole("tab", { name: "Externos registrados" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar a Visitante Nueve" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await waitFor(() =>
      expect(acciones.agregarInvitadosEnBloqueAction).toHaveBeenCalledWith(
        "ev-1",
        expect.objectContaining({ cedulas: [], externos_ids: ["ext-9"] })
      )
    );
  });

  it("no busca con un solo carácter y ofrece gestionar zonas y categorías", async () => {
    const props = abrir();
    await screen.findByText("Persona 1");
    acciones.getPersonalInvitableAction.mockClear();
    fireEvent.change(screen.getByLabelText("Buscar por nombre o cédula"), { target: { value: "a" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(acciones.getPersonalInvitableAction).not.toHaveBeenCalledWith(
      "ev-1",
      expect.objectContaining({ busqueda: "a" })
    );
    fireEvent.change(screen.getByLabelText("Buscar por nombre o cédula"), { target: { value: "ana" } });
    await waitFor(() =>
      expect(acciones.getPersonalInvitableAction).toHaveBeenCalledWith(
        "ev-1",
        expect.objectContaining({ busqueda: "ana" })
      )
    );
    fireEvent.click(screen.getByText("Gestionar zonas y categorías"));
    expect(props.onGestionarZonasCategorias).toHaveBeenCalled();
  });
});
