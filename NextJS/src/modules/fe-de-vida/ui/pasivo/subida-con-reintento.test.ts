import { describe, expect, it, vi } from "vitest";
import { ejecutarConReintento } from "./subida-con-reintento";

describe("subida-con-reintento (backoff exponencial)", () => {
  it("retorna el resultado de inmediato si la primera ejecución es exitosa", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const res = await ejecutarConReintento(fn, (r) => !(r as { ok: boolean }).ok, {
      demoraBaseMs: 10,
    });

    expect(res).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta hasta tener éxito y reporta cada intento", async () => {
    let llamadas = 0;
    const fn = vi.fn().mockImplementation(async () => {
      llamadas++;
      if (llamadas < 3) {
        return { ok: false, error: "Conexión perdida" };
      }
      return { ok: true, data: "subido" };
    });

    const onIntento = vi.fn();
    const pausar = vi.fn().mockResolvedValue(undefined);

    const res = await ejecutarConReintento(
      fn,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (r) => !(r as { ok: boolean }).ok,
      {
        intentosMaximos: 3,
        demoraBaseMs: 100,
        factorBackoff: 2,
        onIntento,
        pausar,
      },
    );

    expect(res).toEqual({ ok: true, data: "subido" });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onIntento).toHaveBeenCalledTimes(2);
    expect(onIntento).toHaveBeenNthCalledWith(1, 2, 3, 100);
    expect(onIntento).toHaveBeenNthCalledWith(2, 3, 3, 200);
    expect(pausar).toHaveBeenNthCalledWith(1, 100);
    expect(pausar).toHaveBeenNthCalledWith(2, 200);
  });

  it("devuelve el último fallo si se agotan todos los intentos", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, error: "Servidor no responde" });
    const onIntento = vi.fn();
    const pausar = vi.fn().mockResolvedValue(undefined);

    const res = await ejecutarConReintento(
      fn,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (r) => !(r as { ok: boolean }).ok,
      {
        intentosMaximos: 3,
        demoraBaseMs: 50,
        onIntento,
        pausar,
      },
    );

    expect(res).toEqual({ ok: false, error: "Servidor no responde" });
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
