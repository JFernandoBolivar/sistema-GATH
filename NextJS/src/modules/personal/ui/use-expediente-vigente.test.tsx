import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";

const getEmpleadoPorCedulaAction = vi.fn();
vi.mock("../infrastructure/actions/personal-actions", () => ({
  getEmpleadoPorCedulaAction: (cedula: string) => getEmpleadoPorCedulaAction(cedula),
}));

import { useExpedienteVigente } from "./use-expediente-vigente";

function empleado(cedula: string): EmpleadoDTO {
  return { cedula, nombres: `Nombre ${cedula}`, apellidos: "X" } as unknown as EmpleadoDTO;
}

/** Promesa que se resuelve a mano para simular respuestas fuera de orden. */
function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promesa, resolver };
}

describe("useExpedienteVigente", () => {
  beforeEach(() => {
    getEmpleadoPorCedulaAction.mockReset();
  });

  it("abrir A, abrir B, llega B y luego A: queda B", async () => {
    const a = diferida<EmpleadoDTO>();
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) => (c === "111" ? a.promesa : b.promesa));

    const { result, rerender } = renderHook(
      ({ cedula }) => useExpedienteVigente({ cedula, activo: true }),
      { initialProps: { cedula: "111" } },
    );
    rerender({ cedula: "222" });

    await act(async () => b.resolver(empleado("222")));
    await waitFor(() => expect(result.current.empleado?.cedula).toBe("222"));

    await act(async () => a.resolver(empleado("111")));
    expect(result.current.empleado?.cedula).toBe("222");
    expect(result.current.cargando).toBe(false);
  });

  it("al cambiar de persona vacía de inmediato y muestra carga, nunca la ficha anterior", async () => {
    const b = diferida<EmpleadoDTO>();
    getEmpleadoPorCedulaAction.mockImplementation((c: string) =>
      c === "111" ? Promise.resolve(empleado("111")) : b.promesa,
    );
    const { result, rerender } = renderHook(
      ({ cedula }) => useExpedienteVigente({ cedula, activo: true }),
      { initialProps: { cedula: "111" } },
    );
    await waitFor(() => expect(result.current.empleado?.cedula).toBe("111"));

    rerender({ cedula: "222" });
    expect(result.current.empleado).toBeNull();
    expect(result.current.cargando).toBe(true);

    await act(async () => b.resolver(empleado("222")));
    await waitFor(() => expect(result.current.empleado?.cedula).toBe("222"));
  });

  it("descarta una respuesta cuya cédula no es la pedida", async () => {
    const onError = vi.fn();
    getEmpleadoPorCedulaAction.mockResolvedValue(empleado("999"));
    const { result } = renderHook(() => useExpedienteVigente({ cedula: "111", activo: true, onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(result.current.empleado).toBeNull();
    expect(result.current.cargando).toBe(false);
  });

  it("ignora la respuesta tardía de una hoja ya cerrada", async () => {
    const a = diferida<EmpleadoDTO>();
    const onError = vi.fn();
    getEmpleadoPorCedulaAction.mockReturnValue(a.promesa);
    const { result, rerender } = renderHook(
      ({ activo }) => useExpedienteVigente({ cedula: "111", activo, onError }),
      { initialProps: { activo: true } },
    );
    rerender({ activo: false });
    await act(async () => a.resolver(empleado("111")));
    expect(result.current.empleado).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("recargar conserva a la misma persona y entrega datos nuevos con otra revisión", async () => {
    getEmpleadoPorCedulaAction
      .mockResolvedValueOnce(empleado("111"))
      .mockResolvedValueOnce({ ...empleado("111"), nombres: "Actualizado" });
    const { result } = renderHook(() => useExpedienteVigente({ cedula: "111", activo: true }));
    await waitFor(() => expect(result.current.empleado?.nombres).toBe("Nombre 111"));
    const revisionAntes = result.current.revision;

    act(() => result.current.recargar());
    await waitFor(() => expect(result.current.empleado?.nombres).toBe("Actualizado"));
    expect(result.current.revision).toBeGreaterThan(revisionAntes);
  });

  it("un error del backend se informa y no deja datos", async () => {
    const onError = vi.fn();
    getEmpleadoPorCedulaAction.mockResolvedValue({ error: "No existe" });
    const { result } = renderHook(() => useExpedienteVigente({ cedula: "111", activo: true, onError }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("No existe"));
    expect(result.current.empleado).toBeNull();
  });
});
