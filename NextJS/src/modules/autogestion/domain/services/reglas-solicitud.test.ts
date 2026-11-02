import { describe, expect, it } from "vitest";
import {
  puedeDecidir,
  puedeEditarBorrador,
  puedeHabilitar,
  campoHabilitado,
  puedeDevolver,
  puedeProrrogar,
  puedeRechazarTotal,
  seccionesSinSoporte,
  textoTiempoRestante,
  tiempoRestante,
  validarEnvio,
} from "./reglas-solicitud";
import { cambioFake, detalleFake, solicitudFake } from "./fixtures-solicitud";

const AHORA = new Date("2026-10-10T12:00:00Z");
const CATALOGO = [
  { codigo: "formacion", nombre: "Formación académica", requiereSoporte: true, activa: true },
  { codigo: "contacto", nombre: "Contacto", requiereSoporte: false, activa: true },
];

describe("tiempoRestante", () => {
  it("descompone días, horas y minutos", () => {
    const t = tiempoRestante("2026-10-13T16:30:00Z", AHORA);
    expect(t).toMatchObject({ vencida: false, dias: 3, horas: 4, minutos: 30 });
    expect(textoTiempoRestante(t)).toBe("3 días y 4 h");
  });
  it("trata fecha pasada, nula o inválida como vencida", () => {
    expect(tiempoRestante("2026-10-01T00:00:00Z", AHORA).vencida).toBe(true);
    expect(tiempoRestante(null, AHORA).vencida).toBe(true);
    expect(tiempoRestante("no-es-fecha", AHORA).vencida).toBe(true);
    expect(textoTiempoRestante(tiempoRestante(null, AHORA))).toBe("Plazo vencido");
  });
  it("usa horas y minutos con menos de un día", () => {
    expect(textoTiempoRestante(tiempoRestante("2026-10-10T17:20:00Z", AHORA))).toBe("5 h 20 min");
    expect(textoTiempoRestante(tiempoRestante("2026-10-10T12:00:20Z", AHORA))).toBe("1 min");
  });
});

describe("transiciones permitidas", () => {
  it("solo se edita con ventana HABILITADA y vigente", () => {
    const hab = solicitudFake({ estado: "HABILITADA", ventanaFin: "2026-10-20T00:00:00Z" });
    expect(puedeEditarBorrador(hab, AHORA)).toBe(true);
    expect(puedeEditarBorrador({ ...hab, ventanaFin: "2026-10-01T00:00:00Z" }, AHORA)).toBe(false);
    expect(
      puedeEditarBorrador(
        solicitudFake({ estado: "ENVIADA", ventanaFin: "2026-10-20T00:00:00Z" }),
        AHORA,
      ),
    ).toBe(false);
  });
  it("también se edita una solicitud DEVUELTA dentro del plazo y solo los campos habilitados", () => {
    const dev = solicitudFake({
      estado: "DEVUELTA",
      ventanaFin: "2026-10-20T00:00:00Z",
      camposHabilitados: ["employee.telefono_movil"],
    });
    expect(puedeEditarBorrador(dev, AHORA)).toBe(true);
    expect(puedeEditarBorrador({ ...dev, ventanaFin: "2026-10-01T00:00:00Z" }, AHORA)).toBe(false);
    expect(campoHabilitado(dev, "employee.telefono_movil")).toBe(true);
    expect(campoHabilitado(dev, "employee.telefono_habitacion")).toBe(false);
  });
  it("Bienestar devuelve solo una ENVIADA y prorroga también una DEVUELTA", () => {
    expect(puedeDevolver(solicitudFake({ estado: "ENVIADA" }))).toBe(true);
    expect(puedeDevolver(solicitudFake({ estado: "DEVUELTA" }))).toBe(false);
    expect(puedeProrrogar(solicitudFake({ estado: "DEVUELTA" }))).toBe(true);
  });
  it("Bienestar habilita SOLICITADA, prorroga HABILITADA y decide ENVIADA", () => {
    expect(puedeHabilitar(solicitudFake({ estado: "SOLICITADA" }))).toBe(true);
    expect(puedeHabilitar(solicitudFake({ estado: "HABILITADA" }))).toBe(false);
    expect(puedeProrrogar(solicitudFake({ estado: "HABILITADA" }))).toBe(true);
    expect(puedeProrrogar(solicitudFake({ estado: "EXPIRADA" }))).toBe(false);
    expect(puedeDecidir(solicitudFake({ estado: "ENVIADA" }))).toBe(true);
    expect(puedeDecidir(solicitudFake({ estado: "APROBADA" }))).toBe(false);
    expect(puedeRechazarTotal(solicitudFake({ estado: "HABILITADA" }))).toBe(false);
    expect(puedeRechazarTotal(solicitudFake({ estado: "ENVIADA" }))).toBe(true);
  });
});

describe("soportes obligatorios", () => {
  it("detecta secciones con soporte obligatorio sin archivos", () => {
    const d = detalleFake({ seccionesHabilitadas: ["formacion", "contacto"] });
    expect(seccionesSinSoporte(d, CATALOGO)).toEqual(["formacion"]);
    const con = detalleFake({
      seccionesHabilitadas: ["formacion"],
      soportes: [
        {
          id: "s",
          seccion: "formacion",
          tipo: "TITULO",
          mimeReal: "application/pdf",
          tamanoBytes: 1,
          nombreOriginal: "t.pdf",
          fecha: null,
          urlArchivo: "/x",
        },
      ],
    });
    expect(seccionesSinSoporte(con, CATALOGO)).toEqual([]);
  });
  it("validarEnvio exige cambios guardados y soportes", () => {
    const d = detalleFake({ seccionesHabilitadas: ["formacion"] });
    const errores = validarEnvio(d, CATALOGO);
    expect(errores).toHaveLength(2);
    expect(errores[1]).toContain("Formación académica");
    expect(
      validarEnvio({ ...d, seccionesHabilitadas: ["contacto"], cambios: [cambioFake()] }, CATALOGO),
    ).toEqual([]);
  });
});
