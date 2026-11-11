import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  unstable_rethrow: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["cargos.ver"] } } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const mockPaginado = vi.fn();
const mockVacantes = vi.fn();

vi.mock("../infrastructure/actions/cargos-actions", () => ({
  asignarCargoAction: vi.fn(),
  cambiarCargoAction: vi.fn(),
  desasignarCargoAction: vi.fn(),
  gestionarEstatusAction: vi.fn(),
  getCargosPaginadoAction: (f: unknown) => mockPaginado(f),
  getCargosVacantesAction: () => mockVacantes(),
  getCoordinacionesAction: vi.fn().mockResolvedValue([]),
  getDependenciasAction: vi.fn().mockResolvedValue([]),
  getDireccionesGeneralesAction: vi.fn().mockResolvedValue([]),
  getDireccionesLineaAction: vi.fn().mockResolvedValue([]),
  getEstatusAction: vi.fn().mockResolvedValue([]),
  getTiposNominaAction: vi.fn().mockResolvedValue([]),
}));

import CargosPage from "./cargos-page";

function pagina(numero: number, total = 25) {
  return { resultados: [], total, pagina: numero, tamano: 10, totalPaginas: 3 };
}

describe("CargosPage (paginación en el servidor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVacantes.mockResolvedValue([]);
    mockPaginado.mockImplementation(async (f: { pagina: number }) => pagina(f.pagina));
  });

  it("pide la página 1 de 10 filas y muestra el total", async () => {
    render(<CargosPage />);
    expect(await screen.findByText(/25 registro\(s\); página 1 de 3\./)).toBeInTheDocument();
    expect(mockPaginado).toHaveBeenCalledWith({ pagina: 1, pageSize: 10 });
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  });

  it("Siguiente pide la página 2 al servidor", async () => {
    render(<CargosPage />);
    await screen.findByText(/25 registro\(s\)/);
    const siguiente = screen.getByRole("button", { name: "Siguiente" });
    await waitFor(() => expect(siguiente).toBeEnabled());
    await userEvent.click(siguiente);
    await waitFor(() => expect(mockPaginado).toHaveBeenLastCalledWith({ pagina: 2, pageSize: 10 }));
    expect(await screen.findByText(/página 2 de 3\./)).toBeInTheDocument();
  });
});
