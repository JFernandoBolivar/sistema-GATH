import { describe, expect, it, vi } from "vitest";
import type { NotificacionEntity } from "../../domain/entities/notificacion";
import { enlaceInterno } from "../../domain/entities/notificacion";
import type { RepoNotificaciones } from "../../domain/ports/repo-notificaciones";
import {
  contarNoLeidas,
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from "./gestionar-notificaciones";

const UUID = "11111111-1111-4111-8111-111111111111";

const notif = (sobre: Partial<NotificacionEntity> = {}): NotificacionEntity => ({
  id: UUID,
  tipo: "x.y",
  titulo: "Titulo",
  mensaje: "Mensaje",
  enlace: "/autogestion",
  refTipo: "",
  refId: "",
  leida: false,
  fechaLectura: null,
  creadaEn: "2026-10-29T15:00:00Z",
  ...sobre,
});

function repoFalso(sobre: Partial<RepoNotificaciones> = {}): RepoNotificaciones {
  return {
    listar: vi
      .fn()
      .mockResolvedValue({ total: 1, limite: 20, desplazamiento: 0, resultados: [notif()] }),
    contarNoLeidas: vi.fn().mockResolvedValue(3),
    marcarLeida: vi.fn().mockResolvedValue(undefined),
    marcarTodasLeidas: vi.fn().mockResolvedValue(3),
    ...sobre,
  };
}

describe("enlaceInterno", () => {
  it("acepta rutas internas y rechaza URLs externas o peligrosas", () => {
    expect(enlaceInterno("/autogestion/solicitudes")).toBe("/autogestion/solicitudes");
    expect(enlaceInterno("")).toBeNull();
    expect(enlaceInterno("https://malo.com")).toBeNull();
    expect(enlaceInterno("//malo.com")).toBeNull();
    expect(enlaceInterno("javascript:alert(1)")).toBeNull();
    expect(enlaceInterno("/\\malo.com")).toBeNull();
  });
});

describe("listarNotificaciones", () => {
  it("acota el límite y el desplazamiento antes de llamar al repositorio", async () => {
    const repo = repoFalso();
    await listarNotificaciones(repo, { modulo: "personal", limite: 5000, desplazamiento: -4 });
    expect(repo.listar).toHaveBeenCalledWith({ modulo: "personal", limite: 50, desplazamiento: 0 });
  });
  it("pide 10 por página por defecto y respeta los filtros recibidos", async () => {
    const repo = repoFalso();
    await listarNotificaciones(repo, { modulo: "autogestion", q: "x", leida: false });
    expect(repo.listar).toHaveBeenCalledWith({
      modulo: "autogestion",
      q: "x",
      leida: false,
      limite: 10,
      desplazamiento: 0,
    });
  });
  it("neutraliza enlaces no internos en el DTO", async () => {
    const repo = repoFalso({
      listar: vi.fn().mockResolvedValue({
        total: 2,
        limite: 20,
        desplazamiento: 0,
        resultados: [notif({ enlace: "https://externo.com" }), notif({ id: "b" })],
      }),
    });
    const pagina = await listarNotificaciones(repo, { modulo: "autogestion" });
    expect(pagina.resultados[0].enlace).toBeNull();
    expect(pagina.resultados[1].enlace).toBe("/autogestion");
  });
});

describe("contarNoLeidas", () => {
  it("devuelve el conteo y nunca un valor negativo", async () => {
    const repo = repoFalso();
    expect(await contarNoLeidas(repo, "personal")).toBe(3);
    expect(repo.contarNoLeidas).toHaveBeenCalledWith("personal");
    expect(
      await contarNoLeidas(
        repoFalso({ contarNoLeidas: vi.fn().mockResolvedValue(-2) }),
        "personal",
      ),
    ).toBe(0);
  });
});

describe("marcarNotificacionLeida", () => {
  it("rechaza identificadores que no son UUID sin llamar al repositorio", async () => {
    const repo = repoFalso();
    await expect(marcarNotificacionLeida(repo, "../1")).rejects.toThrow(/no es válido/);
    expect(repo.marcarLeida).not.toHaveBeenCalled();
  });
  it("marca una notificación válida", async () => {
    const repo = repoFalso();
    await marcarNotificacionLeida(repo, UUID);
    expect(repo.marcarLeida).toHaveBeenCalledWith(UUID);
  });
});

describe("marcarTodasLeidas", () => {
  it("devuelve cuántas se marcaron", async () => {
    const repo = repoFalso();
    expect(await marcarTodasLeidas(repo, "personal")).toBe(3);
    expect(repo.marcarTodasLeidas).toHaveBeenCalledWith("personal");
  });
});
