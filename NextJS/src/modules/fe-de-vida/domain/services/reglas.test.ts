import { describe, expect, it } from "vitest";
import {
  accionesDisponibles,
  esEditablePorPasivo,
  motivoDeEstado,
  describirDiaRecordatorio,
  normalizarDiasRecordatorio,
  oficinaDeAdscripcion,
  primerCheck,
  requiereFotoNueva,
} from "./reglas";
import { decisionFake, solicitudFake } from "./fixtures-fe-de-vida";

describe("accionesDisponibles", () => {
  it("el analista puede dar check, devolver y rechazar, pero no aprobar directo", () => {
    const a = accionesDisponibles(solicitudFake(), [
      "fe_de_vida.revisar",
      "fe_de_vida.check_analista",
    ]);
    expect(a).toEqual({ check: true, aprobarDirecto: false, devolver: true, rechazar: true });
  });
  it("la administradora ve aprobación directa", () => {
    const a = accionesDisponibles(solicitudFake(), [
      "fe_de_vida.revisar",
      "fe_de_vida.check_administradora",
      "fe_de_vida.aprobar_directo",
    ]);
    expect(a.aprobarDirecto).toBe(true);
    expect(a.check).toBe(true);
  });
  it("sin permisos no hay ninguna acción", () => {
    expect(accionesDisponibles(solicitudFake(), [])).toEqual({
      check: false,
      aprobarDirecto: false,
      devolver: false,
      rechazar: false,
    });
  });
  it("fuera de revisión no hay acciones aunque haya permisos", () => {
    const a = accionesDisponibles(solicitudFake({ estado: "VALIDADA" }), [
      "fe_de_vida.revisar",
      "fe_de_vida.check_analista",
    ]);
    expect(a.check || a.devolver || a.rechazar).toBe(false);
  });
  it("el segundo check lo da el otro rol y otra persona", () => {
    const s = solicitudFake({ estado: "PENDIENTE_SEGUNDO_CHECK", decisiones: [decisionFake()] });
    expect(accionesDisponibles(s, ["fe_de_vida.check_analista"]).check).toBe(false);
    expect(accionesDisponibles(s, ["fe_de_vida.check_administradora"], "999").check).toBe(true);
    expect(accionesDisponibles(s, ["fe_de_vida.check_administradora"], "111").check).toBe(false);
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
