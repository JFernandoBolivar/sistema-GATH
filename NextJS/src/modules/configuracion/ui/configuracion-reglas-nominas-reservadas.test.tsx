import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { ConfiguracionReglasCatalogosPage } from "./configuracion-reglas-catalogos-page";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["catalogos.ver", "catalogos.editar"] } } }),
}));
vi.mock("../infrastructure/actions/reglas-catalogos-actions", () => ({
  obtenerReglasCatalogosAction: vi.fn().mockResolvedValue({
    parentescos: [],
    categorias_motivo: [],
    motivos: [],
    nominas: [
      { id: 1, nomina: "EMPLEADOS FIJOS", requiere_codig: true, es_activo: true, es_reservada: false },
      { id: 2, nomina: "JUBILADO", requiere_codig: false, es_activo: false, es_reservada: true },
      { id: 3, nomina: "PENSIONADO", requiere_codig: false, es_activo: true, es_reservada: true },
    ],
  }),
}));

async function abrirNominas() {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ConfiguracionReglasCatalogosPage />
    </SWRConfig>,
  );
  await userEvent.click(await screen.findByRole("tab", { name: "Tipos de Nómina" }));
}

describe("Tipos de nómina reservadas (según el backend)", () => {
  it("deshabilita el switch «Nómina Activa» solo en las reservadas inactivas", async () => {
    await abrirNominas();
    const reservadaInactiva = within(await screen.findByRole("row", { name: /JUBILADO/ }));
    const reservadaActiva = within(await screen.findByRole("row", { name: /PENSIONADO/ }));
    const normal = within(screen.getByRole("row", { name: /EMPLEADOS FIJOS/ }));
    expect(reservadaInactiva.getAllByRole("switch")[0]).toBeDisabled();
    expect(reservadaActiva.getAllByRole("switch")[0]).toBeEnabled();
    expect(normal.getAllByRole("switch")[0]).toBeEnabled();
  });

  it("en el diálogo de edición bloquea nombre y estado activo de una reservada inactiva", async () => {
    await abrirNominas();
    await userEvent.click(await screen.findByRole("button", { name: "Editar JUBILADO" }));
    expect(await screen.findByLabelText("Nombre de la nómina")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Nómina activa" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Requiere código de cargo" })).toBeEnabled();
  });

  it("en una reservada ya activa el switch permite desactivarla", async () => {
    await abrirNominas();
    await userEvent.click(await screen.findByRole("button", { name: "Editar PENSIONADO" }));
    expect(await screen.findByLabelText("Nombre de la nómina")).toBeDisabled();
    const activa = screen.getByRole("switch", { name: "Nómina activa" });
    expect(activa).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Requiere código de cargo" })).toBeEnabled();
  });

  it("en una nómina normal el diálogo permite editar", async () => {
    await abrirNominas();
    await userEvent.click(await screen.findByRole("button", { name: "Editar EMPLEADOS FIJOS" }));
    expect(await screen.findByLabelText("Nombre de la nómina")).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Nómina activa" })).toBeEnabled();
  });
});
