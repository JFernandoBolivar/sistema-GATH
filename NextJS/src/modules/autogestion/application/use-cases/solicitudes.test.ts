import { describe, expect, it, vi } from "vitest";
import type { RepoSolicitudes } from "../../domain/ports/repo-solicitudes";
import { cambioFake, detalleFake, solicitudFake } from "../../domain/services/fixtures-solicitud";
import {
  decidirCambios,
  habilitarVentana,
  listarBandeja,
  prorrogarVentana,
  rechazarSolicitud,
} from "./gestionar-solicitud-bienestar";
import {
  enviarSolicitud,
  solicitarActualizacion,
  subirSoporte,
} from "./gestionar-solicitud-trabajador";

function fakeRepo(sobre: Partial<RepoSolicitudes> = {}): RepoSolicitudes {
  return {
    listarMias: vi.fn(),
    obtenerMia: vi.fn(),
    solicitar: vi.fn().mockResolvedValue(solicitudFake()),
    guardarBorrador: vi.fn(),
    subirSoporte: vi.fn(),
    eliminarSoporte: vi.fn(),
    enviar: vi.fn().mockResolvedValue(solicitudFake({ estado: "ENVIADA" })),
    listarSecciones: vi.fn().mockResolvedValue([]),
    obtenerMisDatosComplementarios: vi.fn(),
    listarBandeja: vi.fn().mockResolvedValue({ count: 0, limit: 20, offset: 0, results: [] }),
    obtenerDetalle: vi.fn(),
    obtenerComparativo: vi.fn(),
    habilitar: vi.fn().mockResolvedValue(solicitudFake({ estado: "HABILITADA" })),
    prorrogar: vi.fn().mockResolvedValue(solicitudFake({ estado: "HABILITADA" })),
    decidir: vi.fn(),
    rechazar: vi.fn().mockResolvedValue(solicitudFake({ estado: "RECHAZADA" })),
    ...sobre,
  };
}

describe("solicitarActualizacion", () => {
  it("quita secciones repetidas y recorta el motivo", async () => {
    const repo = fakeRepo();
    await solicitarActualizacion(repo, {
      secciones: ["contacto", "contacto"],
      motivo: "  Cambio de número  ",
    });
    expect(repo.solicitar).toHaveBeenCalledWith(["contacto"], "Cambio de número");
  });
  it("rechaza sin secciones, con sección desconocida o sin motivo", async () => {
    const repo = fakeRepo();
    await expect(solicitarActualizacion(repo, { secciones: [], motivo: "x" })).rejects.toThrow(
      /al menos una sección/,
    );
    await expect(
      solicitarActualizacion(repo, { secciones: ["cargo"], motivo: "x" }),
    ).rejects.toThrow(/no es autogestionable/);
    await expect(
      solicitarActualizacion(repo, { secciones: ["foto"], motivo: " " }),
    ).rejects.toThrow(/motivo/);
    expect(repo.solicitar).not.toHaveBeenCalled();
  });
});

describe("subirSoporte", () => {
  it("valida tipo y tamaño antes de llamar al servidor", async () => {
    const repo = fakeRepo();
    const malo = new File(["x"], "virus.exe");
    await expect(
      subirSoporte(repo, "id", { seccion: "formacion", tipo: "TITULO", archivo: malo }),
    ).rejects.toThrow(/PDF, JPG o PNG/);
    expect(repo.subirSoporte).not.toHaveBeenCalled();
    const bueno = new File(["x"], "titulo.pdf");
    await subirSoporte(repo, "id", { seccion: "formacion", tipo: "TITULO", archivo: bueno });
    expect(repo.subirSoporte).toHaveBeenCalledTimes(1);
  });
  it("la foto exige JPG o PNG", async () => {
    const repo = fakeRepo();
    await expect(
      subirSoporte(repo, "id", {
        seccion: "foto",
        tipo: "FOTO",
        archivo: new File(["x"], "foto.pdf"),
      }),
    ).rejects.toThrow(/JPG o PNG/);
  });
});

describe("enviarSolicitud", () => {
  const catalogo = [
    { codigo: "formacion", nombre: "Formación académica", requiereSoporte: true, activa: true },
  ];
  it("bloquea el envío sin soporte obligatorio", async () => {
    const repo = fakeRepo({
      obtenerMia: vi
        .fn()
        .mockResolvedValue(
          detalleFake({
            estado: "HABILITADA",
            seccionesHabilitadas: ["formacion"],
            cambios: [cambioFake({ seccion: "formacion" })],
          }),
        ),
      listarSecciones: vi.fn().mockResolvedValue(catalogo),
    });
    await expect(enviarSolicitud(repo, "id")).rejects.toThrow(/exige adjuntar/);
    expect(repo.enviar).not.toHaveBeenCalled();
  });
  it("envía con la versión vista por el trabajador (bloqueo optimista)", async () => {
    const repo = fakeRepo({
      obtenerMia: vi
        .fn()
        .mockResolvedValue(
          detalleFake({ version: 4, seccionesHabilitadas: ["contacto"], cambios: [cambioFake()] }),
        ),
    });
    await enviarSolicitud(repo, "id");
    expect(repo.enviar).toHaveBeenCalledWith("id", 4);
  });
});

describe("Bienestar", () => {
  it("limita la paginación de la bandeja y descarta filtros vacíos", async () => {
    const repo = fakeRepo();
    await listarBandeja(repo, { estado: "", cedula: "  ", limit: 500, offset: -3 });
    expect(repo.listarBandeja).toHaveBeenCalledWith({
      estado: undefined,
      cedula: undefined,
      limit: 100,
      offset: 0,
    });
  });
  it("el plazo de la ventana va de 1 a 90 días", async () => {
    const repo = fakeRepo();
    await expect(habilitarVentana(repo, "id", { plazoDias: 0 })).rejects.toThrow(/1 a 90/);
    await expect(habilitarVentana(repo, "id", { plazoDias: 91 })).rejects.toThrow(/1 a 90/);
    await habilitarVentana(repo, "id", { plazoDias: 30, secciones: ["contacto"] });
    expect(repo.habilitar).toHaveBeenCalledWith("id", 30, ["contacto"]);
  });
  it("la prórroga exige fecha válida y motivo", async () => {
    const repo = fakeRepo();
    await expect(prorrogarVentana(repo, "id", { nuevaFechaFin: "x", motivo: "m" })).rejects.toThrow(
      /fecha/,
    );
    await expect(
      prorrogarVentana(repo, "id", { nuevaFechaFin: "2026-12-01T00:00:00Z", motivo: " " }),
    ).rejects.toThrow(/motivo/);
    await prorrogarVentana(repo, "id", { nuevaFechaFin: "2026-12-01T00:00:00Z", motivo: "Reposo" });
    expect(repo.prorrogar).toHaveBeenCalledTimes(1);
  });
  it("rechazar exige motivo", async () => {
    const repo = fakeRepo();
    await expect(rechazarSolicitud(repo, "id", " ")).rejects.toThrow(/motivo/);
    await rechazarSolicitud(repo, "id", "Sin soporte");
    expect(repo.rechazar).toHaveBeenCalledWith("id", "Sin soporte");
  });

  describe("decidirCambios (una sola persona decide)", () => {
    const detalle = detalleFake({
      estado: "ENVIADA",
      version: 7,
      cambios: [cambioFake({ id: "a" }), cambioFake({ id: "b", campo: "telefono_habitacion" })],
    });
    it("envía las decisiones con la versión vista en la revisión", async () => {
      const repo = fakeRepo({
        obtenerComparativo: vi.fn().mockResolvedValue(detalle),
        decidir: vi.fn().mockResolvedValue(detalle),
      });
      await decidirCambios(repo, "id", {
        decisiones: [
          { cambioId: "a", aprobado: true, motivo: "" },
          { cambioId: "b", aprobado: false, motivo: "No coincide con el soporte" },
        ],
      });
      expect(repo.decidir).toHaveBeenCalledWith("id", {
        version: 7,
        decisiones: [
          { cambioId: "a", aprobado: true, motivo: "" },
          { cambioId: "b", aprobado: false, motivo: "No coincide con el soporte" },
        ],
        motivoGeneral: undefined,
      });
    });
    it("no llama al servidor si falta cubrir campos o un rechazo sin motivo", async () => {
      const repo = fakeRepo({ obtenerComparativo: vi.fn().mockResolvedValue(detalle) });
      await expect(
        decidirCambios(repo, "id", { decisiones: [{ cambioId: "a", aprobado: true, motivo: "" }] }),
      ).rejects.toThrow(/Falta decidir/);
      await expect(
        decidirCambios(repo, "id", {
          decisiones: [
            { cambioId: "a", aprobado: true, motivo: "" },
            { cambioId: "b", aprobado: false, motivo: "" },
          ],
        }),
      ).rejects.toThrow(/motivo del rechazo/);
      expect(repo.decidir).not.toHaveBeenCalled();
    });
    it("propaga el 409 del servidor (p. ej. decide su propia solicitud)", async () => {
      const repo = fakeRepo({
        obtenerComparativo: vi.fn().mockResolvedValue(detalle),
        decidir: vi.fn().mockRejectedValue(new Error("No puede decidir su propia solicitud.")),
      });
      await expect(
        decidirCambios(repo, "id", {
          decisiones: [
            { cambioId: "a", aprobado: true, motivo: "" },
            { cambioId: "b", aprobado: true, motivo: "" },
          ],
        }),
      ).rejects.toThrow("No puede decidir su propia solicitud.");
    });
  });
});
