import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmpleadoDTO } from "@/modules/personal/application/dtos/empleado-dto";

const getEmpleadoPorCedulaAction = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { permisos: ["*"] } } }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/personal/infrastructure/actions/personal-actions", () => ({
  getEmpleadoPorCedulaAction: (cedula: string) => getEmpleadoPorCedulaAction(cedula),
}));
vi.mock("@/modules/personal/infrastructure/cache/catalogos-expediente-cache", () => ({
  obtenerCatalogosExpediente: () => Promise.resolve(null),
}));
vi.mock("@/modules/personal/ui/expediente-detalle-view-model", () => ({
  construirDetalleExpediente: () => ({}),
}));
vi.mock("../infrastructure/actions/pasivos-actions", () => ({
  descargarPasivoPdfAction: vi.fn(),
  getPasivoPorCedulaAction: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/modules/personal/ui/empleado-detalle-sheet", () => ({
  default: ({ empleado }: { empleado: EmpleadoDTO | null }) => (
    <div data-testid="ficha">{empleado ? `ficha-${empleado.cedula}` : "cargando"}</div>
  ),
}));

import { DetallePasivo } from "./detalle-pasivo";

function empleado(cedula: string): EmpleadoDTO {
  return { cedula } as unknown as EmpleadoDTO;
}

function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promesa, resolver };
}

const sinCambios = () => undefined;

describe("DetallePasivo", () => {
  beforeEach(() => {
    getEmpleadoPorCedulaAction.mockReset();
  });

  it("abrir A, abrir B, llega B y luego A: queda la ficha de B", async () => {
    const a = diferida<EmpleadoDTO>();
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) => (c === "111" ? a.promesa : b.promesa));

    const { rerender } = render(<DetallePasivo cedula="111" open onOpenChange={sinCambios} />);
    rerender(<DetallePasivo cedula="222" open onOpenChange={sinCambios} />);
    expect(screen.getByTestId("ficha").textContent).toBe("cargando");

    await act(async () => b.resolver(empleado("222")));
    await waitFor(() => expect(screen.getByTestId("ficha").textContent).toBe("ficha-222"));

    await act(async () => a.resolver(empleado("111")));
    expect(screen.getByTestId("ficha").textContent).toBe("ficha-222");
  });

  it("al pasar de A (ya cargado) a B muestra carga y no la ficha de A", async () => {
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) =>
      c === "111" ? Promise.resolve(empleado("111")) : b.promesa,
    );
    const { rerender } = render(<DetallePasivo cedula="111" open onOpenChange={sinCambios} />);
    await waitFor(() => expect(screen.getByTestId("ficha").textContent).toBe("ficha-111"));

    rerender(<DetallePasivo cedula="222" open onOpenChange={sinCambios} />);
    expect(screen.getByTestId("ficha").textContent).toBe("cargando");
  });
});
