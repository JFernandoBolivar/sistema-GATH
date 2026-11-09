import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfiguracionVisualPage from "./configuracion-visual-page";
import type { ConfiguracionVisualDTO } from "../application/dtos/configuracion-visual-dto";

const mockGetConfig = vi.fn();
const mockActualizarConfig = vi.fn();

vi.mock("../infrastructure/actions/configuracion-actions", () => ({
  getConfiguracionVisualAction: () => mockGetConfig(),
  actualizarConfiguracionVisualAction: (datos: unknown) => mockActualizarConfig(datos),
  subirLogoConfiguracionAction: vi.fn(),
  listarVersionesImagenAction: vi.fn().mockResolvedValue([]),
  restaurarVersionImagenAction: vi.fn(),
}));

describe("ConfiguracionVisualPage (O33)", () => {
  const configMock: ConfiguracionVisualDTO = {
    id: 1,
    tipoCintillo: "FIJO",
    nombreEmpresa: "Comisión Nacional de Telecomunicaciones",
    logoPrincipalClave: "logos/logo1.png",
    logoPrincipalUrl: "/api/logos/logo1.png",
    logoSecundarioClave: "logos/logo2.png",
    logoSecundarioUrl: "/api/logos/logo2.png",
    cintilloPieClave: "cintillos/pie.png",
    cintilloPieUrl: "/api/cintillos/pie.png",
    colorFondo: "#1E3A8A",
    actualizadoPorId: 1,
    actualizadoEn: "2026-11-05T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(configMock);
    mockActualizarConfig.mockResolvedValue(configMock);
  });

  it("renderiza la pantalla de identidad visual y cintillos", async () => {
    render(<ConfiguracionVisualPage />);

    expect(await screen.findByText("Identidad Visual y Cintillos")).toBeInTheDocument();
    expect(screen.getByText("Modo Institucional Activo")).toBeInTheDocument();
    expect(screen.getByText("Institucional (Fijo)")).toBeInTheDocument();
    expect(screen.getByText("Genérico (Neutral)")).toBeInTheDocument();
  });

  it("NO contiene el campo «Nombre de la empresa» (O33)", async () => {
    render(<ConfiguracionVisualPage />);

    expect(await screen.findByText("Identidad Visual y Cintillos")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nombre de la empresa/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nombre de la empresa/i)).not.toBeInTheDocument();
  });

  it("muestra la previsualización del encabezado y pie de página", async () => {
    render(<ConfiguracionVisualPage />);

    expect(await screen.findByText("Vista previa del encabezado y pie de página")).toBeInTheDocument();
    expect(screen.getByText("Comisión Nacional de Telecomunicaciones")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
  });

  it("muestra las 3 zonas de componentes visuales con sus etiquetas", async () => {
    render(<ConfiguracionVisualPage />);

    expect(await screen.findByText("Componentes visuales del cintillo")).toBeInTheDocument();
    expect(screen.getByText("Logo principal (izquierdo)")).toBeInTheDocument();
    expect(screen.getByText("Logo secundario (derecho)")).toBeInTheDocument();
    expect(screen.getByText("Cintillo de pie de página")).toBeInTheDocument();
  });

  it("permite cambiar la modalidad a Genérico y guardar", async () => {
    const user = userEvent.setup();
    render(<ConfiguracionVisualPage />);

    expect(await screen.findByText("Identidad Visual y Cintillos")).toBeInTheDocument();

    const opcionGenerico = screen.getByText("Genérico (Neutral)");
    await user.click(opcionGenerico);

    const btnGuardar = screen.getByRole("button", { name: /Guardar modalidad/i });
    expect(btnGuardar).toBeEnabled();

    await user.click(btnGuardar);

    await waitFor(() => {
      expect(mockActualizarConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoCintillo: "GENERICO",
        })
      );
    });
  });
});
