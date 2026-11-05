import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  guardarFotoLocal,
  recuperarFotoLocal,
  eliminarFotoLocal,
} from "./foto-local-storage";

describe("foto-local-storage (IndexedDB)", () => {
  const solicitudId = "sol-test-123";
  const fakeFile = new File(["contenido-imagen-prueba"], "selfie-cedula.jpg", {
    type: "image/jpeg",
  });

  // Mock en memoria de IndexedDB para el entorno de test
  const datosMemoria = new Map<string, unknown>();

  beforeEach(() => {
    datosMemoria.clear();

    const mockStore = {
      put: vi.fn((registro: { solicitudId: string }) => {
        datosMemoria.set(registro.solicitudId, registro);
        const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      get: vi.fn((key: string) => {
        const result = datosMemoria.get(key);
        const req = {
          result,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      delete: vi.fn((key: string) => {
        datosMemoria.delete(key);
        const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    const mockDb = {
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      createObjectStore: vi.fn(() => mockStore),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => mockStore),
      })),
    };

    const mockIndexedDB = {
      open: vi.fn(() => {
        const req = {
          result: mockDb,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
          error: null,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    vi.stubGlobal("indexedDB", mockIndexedDB as unknown as IDBFactory);
  });

  it("guarda y recupera una foto correctamente", async () => {
    const ok = await guardarFotoLocal(solicitudId, fakeFile, "CAMARA");
    expect(ok).toBe(true);

    const recuperado = await recuperarFotoLocal(solicitudId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.origen).toBe("CAMARA");
    expect(recuperado?.archivo.name).toBe("selfie-cedula.jpg");
    expect(recuperado?.archivo.type).toBe("image/jpeg");

    const texto = await recuperado?.archivo.text();
    expect(texto).toBe("contenido-imagen-prueba");
  });

  it("devuelve null si no existe foto para la solicitud", async () => {
    const noExiste = await recuperarFotoLocal("solicitud-inexistente");
    expect(noExiste).toBeNull();
  });

  it("elimina una foto correctamente tras subirse", async () => {
    await guardarFotoLocal(solicitudId, fakeFile, "ARCHIVO");
    let recuperado = await recuperarFotoLocal(solicitudId);
    expect(recuperado).not.toBeNull();

    const okEliminar = await eliminarFotoLocal(solicitudId);
    expect(okEliminar).toBe(true);

    recuperado = await recuperarFotoLocal(solicitudId);
    expect(recuperado).toBeNull();
  });
});
