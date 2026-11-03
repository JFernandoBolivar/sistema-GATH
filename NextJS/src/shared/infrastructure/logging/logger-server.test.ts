import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  stat: vi.fn(),
  appendFile: vi.fn(),
  rename: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("fs/promises", () => ({ ...fs, default: fs }));

async function cargarLogger() {
  return import("./logger-server");
}

describe("logger-server", () => {
  beforeEach(() => {
    vi.resetModules();
    fs.mkdir.mockReset().mockResolvedValue(undefined);
    fs.stat.mockReset().mockRejectedValue(new Error("sin archivo"));
    fs.appendFile.mockReset().mockResolvedValue(undefined);
    fs.rename.mockReset().mockResolvedValue(undefined);
    fs.unlink.mockReset().mockResolvedValue(undefined);
  });

  it("no espera al disco: resuelve aunque appendFile siga pendiente", async () => {
    fs.appendFile.mockReturnValue(new Promise(() => undefined));
    const { logAudit } = await cargarLogger();

    await expect(
      logAudit({
        traceId: "trace-1",
        action: "getEmpleadosAction",
        status: "SUCCESS",
        durationMs: 12,
      }),
    ).resolves.toBeUndefined();
  });

  it("conserva todos los campos del formato actual", async () => {
    const { logAudit } = await cargarLogger();

    await logAudit({
      traceId: "trace-2",
      sessionId: "ses-9",
      ip: "10.0.0.5",
      action: "getCatalogosExpedienteAction",
      status: "FAILED",
      durationMs: 34,
    });

    await vi.waitFor(() => expect(fs.appendFile).toHaveBeenCalledTimes(1));
    const linea = fs.appendFile.mock.calls[0][1] as string;
    expect(linea).toContain("[TRACE:trace-2]");
    expect(linea).toContain("[SESSION:ses-9]");
    expect(linea).toContain("[IP:10.0.0.5]");
    expect(linea).toContain("[ACTION:getCatalogosExpedienteAction]");
    expect(linea).toContain("[STATUS:FAILED]");
    expect(linea).toContain("[DURATION:34ms]");
  });

  it("hace mkdir una sola vez por proceso", async () => {
    const { logAudit } = await cargarLogger();

    await logAudit({ traceId: "t1", action: "a1", status: "SUCCESS" });
    await logAudit({ traceId: "t2", action: "a2", status: "SUCCESS" });

    await vi.waitFor(() => expect(fs.appendFile).toHaveBeenCalledTimes(2));
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
  });
});
