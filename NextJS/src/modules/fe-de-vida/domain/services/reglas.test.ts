import { describe, expect, it } from "vitest";
import {
  checksVigentes,
  edadEn,
  esEditablePorPasivo,
  motivoDeEstado,
  describirDiaRecordatorio,
  normalizarDiasRecordatorio,
  oficinaDeAdscripcion,
  primerCheck,
  requiereFotoNueva,
  rolLegible,
  rolQueFalta,
} from "./reglas";
import { decisionFake, solicitudFake } from "./fixtures-fe-de-vida";

describe("checks, roles y edad", () => {
  it("un check retirado deja de ser vigente", () => {
    const s = solicitudFake({
      decisiones: [
        decisionFake({ actorCedula: "1" }),
        decisionFake({ tipo: "CHECK_RETIRADO", actorCedula: "1" }),
        decisionFake({ actorCedula: "2", rol: "ADMINISTRADORA" }),
      ],
    });
    expect(checksVigentes(s).map((c) => c.actorCedula)).toEqual(["2"]);
    expect(primerCheck(s)?.rol).toBe("ADMINISTRADORA");
  });
  it("rolLegible nunca devuelve el código en crudo y rolQueFalta es el otro rol", () => {
    expect(rolLegible("ADMINISTRADORA")).toBe("Administradora");
    expect(rolLegible("analista")).toBe("Analista");
    expect(rolQueFalta("ADMINISTRADORA")).toBe("Analista");
    expect(rolQueFalta("ANALISTA")).toBe("Administradora");
  });
  it("edadEn cuenta años cumplidos y rechaza fechas inválidas o futuras", () => {
    const hoy = new Date(2026, 9, 30);
    expect(edadEn("1950-10-30", hoy)).toBe(76);
    expect(edadEn("1950-10-31", hoy)).toBe(75);
    expect(edadEn("2030-01-01", hoy)).toBeNull();
    expect(edadEn("no-es-fecha", hoy)).toBeNull();
    expect(edadEn(null, hoy)).toBeNull();
  });
});

describe("estado y motivo", () => {
  it("devuelta muestra el motivo de la devolución; rechazada, el del rechazo", () => {
    const dev = solicitudFake({
      estado: "DEVUELTA",
      decisiones: [decisionFake({ tipo: "DEVOLUCION", motivo: "Foto borrosa" })],
    });
    expect(motivoDeEstado(dev)).toBe("Foto borrosa");
    const rech = solicitudFake({
      estado: "RECHAZADA",
      decisiones: [decisionFake({ tipo: "RECHAZO", motivo: "No coincide" })],
    });
    expect(motivoDeEstado(rech)).toBe("No coincide");
    expect(motivoDeEstado(solicitudFake())).toBe("");
  });
  it("solo borrador y devuelta son editables", () => {
    expect(esEditablePorPasivo({ estado: "BORRADOR" })).toBe(true);
    expect(esEditablePorPasivo({ estado: "DEVUELTA" })).toBe(true);
    expect(esEditablePorPasivo({ estado: "VALIDADA" })).toBe(false);
  });
  it("pide foto nueva si no hay o si la devolución lo exigió", () => {
    expect(requiereFotoNueva(solicitudFake({ tieneEvidencia: false }))).toBe(true);
    expect(requiereFotoNueva(solicitudFake({ estado: "DEVUELTA", requiereNuevaFoto: false }))).toBe(
      false,
    );
    expect(requiereFotoNueva(solicitudFake({ estado: "DEVUELTA", requiereNuevaFoto: true }))).toBe(
      true,
    );
  });
  it("primerCheck toma el del envío en curso", () => {
    const s = solicitudFake({
      envios: 2,
      decisiones: [
        decisionFake({ envio: 1, actorCedula: "1" }),
        decisionFake({ envio: 2, actorCedula: "2" }),
      ],
    });
    expect(primerCheck(s)?.actorCedula).toBe("2");
  });
});

describe("normalizarDiasRecordatorio", () => {
  it("ordena de mayor a menor y quita repetidos", () => {
    expect(normalizarDiasRecordatorio([1, 7, 3, 7])).toEqual([7, 3, 1]);
  });
  it("descarta valores fuera de 1..365 o no enteros", () => {
    expect(normalizarDiasRecordatorio([0, 366, 2.5, 5])).toEqual([5]);
    expect(normalizarDiasRecordatorio([])).toEqual([]);
  });
});

describe("describirDiaRecordatorio", () => {
  it("usa singular y plural", () => {
    expect(describirDiaRecordatorio(1)).toBe("1 día antes");
    expect(describirDiaRecordatorio(7)).toBe("7 días antes");
  });
});

describe("oficinaDeAdscripcion", () => {
  it("toma el nivel más específico disponible", () => {
    expect(
      oficinaDeAdscripcion({
        dependencia: "NIVEL DE APOYO",
        direccion_general: "OFICINA DE GESTIÓN HUMANA",
        direccion_linea: "N/A",
        coordinacion: "COORDINACIÓN DE BIENESTAR SOCIAL",
      }),
    ).toBe("COORDINACIÓN DE BIENESTAR SOCIAL");
  });
  it("salta los niveles vacíos o «N/A»", () => {
    expect(
      oficinaDeAdscripcion({
        dependencia: "NIVEL DE APOYO",
        direccion_general: "OFICINA X",
        coordinacion: "N/A",
      }),
    ).toBe("OFICINA X");
  });
  it("sin niveles devuelve null", () => {
    expect(oficinaDeAdscripcion(undefined)).toBeNull();
    expect(oficinaDeAdscripcion({ dependencia: "N/A" })).toBeNull();
  });
});
