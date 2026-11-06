import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";

const getEmpleadoPorCedulaAction = vi.fn();
const capturado: { onVerDetalle: ((cedula: string) => void) | null } = { onVerDetalle: null };

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["*"] } } }),
}));
vi.mock("../infrastructure/actions/personal-actions", () => ({
  getEmpleadoPorCedulaAction: (cedula: string) => getEmpleadoPorCedulaAction(cedula),
  getInicioPersonalAction: () =>
    Promise.resolve({ empleados: { items: [], total: 0, page: 1 }, nominas: [] }),
  getEmpleadosAction: () => Promise.resolve({ items: [], total: 0, page: 1 }),
  descargarEmpleadoPdfAction: vi.fn(),
  subirFotoEmpleadoAction: vi.fn(),
}));
vi.mock("../infrastructure/cache/catalogos-expediente-cache", () => ({
  obtenerCatalogosExpediente: () => Promise.resolve(null),
}));
vi.mock("./expediente-detalle-view-model", () => ({
  construirDetalleExpediente: () => ({}),
}));
vi.mock("./personal-columns", () => ({
  construirColumnasPersonal: (
    _ver: boolean,
    _editar: boolean,
    onVerDetalle: (cedula: string) => void,
  ) => {
    capturado.onVerDetalle = onVerDetalle;
    return [];
  },
}));
vi.mock("@/shared/ui/components/data-table", () => ({ DataTable: () => null }));
vi.mock("@/components/layout/page-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./empleado-detalle-sheet", () => ({
  default: ({ empleado, open }: { empleado: EmpleadoDTO | null; open: boolean }) => (
    <div data-testid="ficha">{open ? (empleado ? `ficha-${empleado.cedula}` : "cargando") : "cerrada"}</div>
  ),
}));

import PersonalPage from "./personal-page";

function empleado(cedula: string): EmpleadoDTO {
  return { cedula, nombres: "N", apellidos: "A" } as unknown as EmpleadoDTO;
}

function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promesa, resolver };
}

describe("PersonalPage: Ver detalle", () => {
  beforeEach(() => {
    getEmpleadoPorCedulaAction.mockReset();
    capturado.onVerDetalle = null;
  });

  it("abrir A, abrir B, llega B y luego A: queda la ficha de B", async () => {
    const a = diferida<EmpleadoDTO>();
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) => (c === "111" ? a.promesa : b.promesa));

    render(<PersonalPage />);
    await waitFor(() => expect(capturado.onVerDetalle).not.toBeNull());

    act(() => capturado.onVerDetalle?.("111"));
    act(() => capturado.onVerDetalle?.("222"));
    expect(screen.getByTestId("ficha").textContent).toBe("cargando");

    await act(async () => b.resolver(empleado("222")));
    await waitFor(() => expect(screen.getByTestId("ficha").textContent).toBe("ficha-222"));

    await act(async () => a.resolver(empleado("111")));
    expect(screen.getByTestId("ficha").textContent).toBe("ficha-222");
  });

  it("al abrir otra persona con una ya cargada muestra carga, no la ficha anterior", async () => {
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) =>
      c === "111" ? Promise.resolve(empleado("111")) : b.promesa,
    );
    render(<PersonalPage />);
    await waitFor(() => expect(capturado.onVerDetalle).not.toBeNull());

    act(() => capturado.onVerDetalle?.("111"));
    await waitFor(() => expect(screen.getByTestId("ficha").textContent).toBe("ficha-111"));

    act(() => capturado.onVerDetalle?.("222"));
    expect(screen.getByTestId("ficha").textContent).toBe("cargando");
  });
});
