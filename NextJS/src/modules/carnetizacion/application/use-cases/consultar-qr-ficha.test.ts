import { describe, expect, it, vi } from "vitest";
import type { FichaQr, PreferenciasPrivacidadCarnet } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import {
  consultarFichaQrUC,
  consultarSaludEmergenciaUC,
  guardarPreferenciasPrivacidadUC,
  obtenerPreferenciasPrivacidadUC,
} from "./consultar-qr-ficha";

describe("Casos de uso Ficha QR y Privacidad (O44 - E9)", () => {
  const mockRepo = {
    consultarFichaQr: vi.fn(),
    consultarSaludEmergencia: vi.fn(),
    obtenerPreferenciasPrivacidad: vi.fn(),
    guardarPreferenciasPrivacidad: vi.fn(),
  } as unknown as RepoCarnetizacion;

  it("consultarFichaQrUC delega al repositorio", async () => {
    const mockFicha: FichaQr = {
      esValido: true,
      estado: "VIGENTE",
      mensaje: "Carnet vigente y verificado.",
      securityHash: "abc123hash",
      nivelAcceso: "PUBLICO",
      datos: {
        nombre: "Ana Pérez",
        cargo: "Analista",
        ubicacion: "Gestión Humana",
        contactos_emergencia: [],
      },
      saludDisponible: true,
      fechaEmision: "01/01/2026",
      fechaVencimiento: null,
    };
    vi.mocked(mockRepo.consultarFichaQr).mockResolvedValueOnce(mockFicha);

    const res = await consultarFichaQrUC(mockRepo, "abc123hash");
    expect(res.esValido).toBe(true);
    expect(res.datos?.nombre).toBe("Ana Pérez");
    expect(mockRepo.consultarFichaQr).toHaveBeenCalledWith("abc123hash");
  });

  it("consultarSaludEmergenciaUC delega al repositorio para apertura médica", async () => {
    const mockFichaConSalud: FichaQr = {
      esValido: true,
      estado: "VIGENTE",
      mensaje: "Información médica consultada.",
      securityHash: "hash999",
      nivelAcceso: "PUBLICO",
      datos: {
        nombre: "Ana Pérez",
        cargo: "Analista",
        ubicacion: "Gestión Humana",
        contactos_emergencia: [],
        salud: {
          alergias: ["penicilina"],
          patologias: ["hipertensión"],
          discapacidades: [],
        },
      },
      saludDisponible: true,
      fechaEmision: "01/01/2026",
      fechaVencimiento: null,
    };
    vi.mocked(mockRepo.consultarSaludEmergencia).mockResolvedValueOnce(mockFichaConSalud);

    const res = await consultarSaludEmergenciaUC(mockRepo, "hash999");
    expect(res.datos?.salud?.alergias).toContain("penicilina");
    expect(mockRepo.consultarSaludEmergencia).toHaveBeenCalledWith("hash999");
  });

  it("guardarPreferenciasPrivacidadUC rechaza invariante de vivienda pública", async () => {
    const invalidPrefs: PreferenciasPrivacidadCarnet = {
      direccion_vivienda: "PUBLICO",
    };
    await expect(
      guardarPreferenciasPrivacidadUC(mockRepo, invalidPrefs)
    ).rejects.toThrow("no puede ser pública");
  });

  it("guardarPreferenciasPrivacidadUC guarda preferencias válidas", async () => {
    const validPrefs: PreferenciasPrivacidadCarnet = {
      cedula: "CON_SESION",
      direccion_vivienda: "SOLO_PERSONAL",
    };
    vi.mocked(mockRepo.guardarPreferenciasPrivacidad).mockResolvedValueOnce(validPrefs);

    const res = await guardarPreferenciasPrivacidadUC(mockRepo, validPrefs);
    expect(res.cedula).toBe("CON_SESION");
    expect(res.direccion_vivienda).toBe("SOLO_PERSONAL");
    expect(mockRepo.guardarPreferenciasPrivacidad).toHaveBeenCalledWith(validPrefs);
  });
});
