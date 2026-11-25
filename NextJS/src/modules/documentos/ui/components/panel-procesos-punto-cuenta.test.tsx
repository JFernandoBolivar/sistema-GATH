import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcesoPlantilla } from "../../domain/entities/plantilla";
import { CATALOGO } from "../../domain/lib/fixtures";
import { PanelProcesosPuntoCuenta } from "./panel-procesos-punto-cuenta";

const useConfiguracionMock = vi.fn();
const guardarMock = vi.fn();
const actualizarCacheMock = vi.fn();

vi.mock("../hooks/use-configuracion-punto-cuenta", () => ({
  useConfiguracionPuntoCuenta: (...args: unknown[]) => useConfiguracionMock(...args),
}));
vi.mock("../hooks/use-ruta-documentos", () => ({ useRutaDocumentos: () => "/documentos/plantillas" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const INGRESO: ProcesoPlantilla = {
  codigo: "punto_cuenta:ingreso_postulacion",
  etiqueta: "Punto de Cuenta: ingreso por postulación",
  descripcion: "Punto de Cuenta para el ingreso de un postulante.",
  grupo: "punto_cuenta",
  grupos_variables: [],
};
const PROCESOS = [...CATALOGO.procesos, INGRESO];
const CONFIG = {
  id: "c1",
  generar: true,
  procesos_habilitados: { cambio_oficina: true, cambio_nivel: false, ingreso_postulacion: true },
  version: 3,
  actualizado_por_id: 7,
  updated_at: null,
};

beforeEach(() => {
  useConfiguracionMock.mockReset();
  guardarMock.mockReset();
  actualizarCacheMock.mockReset();
  useConfiguracionMock.mockReturnValue({
    config: CONFIG,
    faltantes: new Set(["punto_cuenta:cambio_nivel"]),
    cargando: false,
    error: null,
    guardar: guardarMock,
    recargar: vi.fn(),
    actualizarCache: actualizarCacheMock,
  });
});

describe("<PanelProcesosPuntoCuenta />", () => {
  it("muestra un interruptor por proceso, su descripción y el aviso de plantilla faltante", () => {
    render(<PanelProcesosPuntoCuenta procesos={PROCESOS} />);

    expect(screen.getByRole("heading", { name: "Procesos del Punto de Cuenta" })).toBeInTheDocument();
    expect(screen.getByText("cambio de oficina")).toBeInTheDocument();
    expect(screen.getByText("Punto de cuenta que se emite al cambiar de nivel.")).toBeInTheDocument();
    expect(screen.getByText(/Falta la plantilla publicada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Diseñar plantilla" })).toHaveAttribute(
      "href",
      "/documentos/plantillas?crear=1&proceso=punto_cuenta%3Acambio_nivel&grupo=punto_cuenta",
    );

    const ingreso = screen.getByRole("switch", { name: /ingreso por postulación/i });
    expect(ingreso).toBeChecked();
    expect(ingreso).toBeDisabled();
  });

  it("guarda con confirmación solo los procesos cambiados", async () => {
    guardarMock.mockResolvedValue({
      success: true,
      data: { ...CONFIG, version: 4, procesos_habilitados: { ...CONFIG.procesos_habilitados, cambio_nivel: true } },
    });
    render(<PanelProcesosPuntoCuenta procesos={PROCESOS} />);

    const guardar = screen.getByRole("button", { name: "Guardar procesos" });
    expect(guardar).toBeDisabled();

    fireEvent.click(screen.getByRole("switch", { name: /activar cambio de nivel/i }));
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(guardarMock).toHaveBeenCalledTimes(1));
    expect(guardarMock).toHaveBeenCalledWith({ ...CONFIG.procesos_habilitados, cambio_nivel: true });
    await waitFor(() => expect(actualizarCacheMock).toHaveBeenCalledWith(expect.objectContaining({ version: 4 })));
  });

  it("no muestra el panel si no hay procesos del Punto de Cuenta", () => {
    render(<PanelProcesosPuntoCuenta procesos={[]} />);
    expect(screen.queryByRole("heading", { name: "Procesos del Punto de Cuenta" })).not.toBeInTheDocument();
  });
});
