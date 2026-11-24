import { describe, expect, it } from "vitest";
import { FAMILIAR_VACIO, type ParentescoCatalogo } from "../../domain/ventana2";
import { crearEsquemaFamiliares, crearEsquemaSalud, crearEsquemaTallas, crearEsquemaVivienda, problemaDeFecha } from "./schema-ventana2";

const HIJO: ParentescoCatalogo = { id: 1, nombre: "Hijo(a)", esHijo: true, menorACargo: false, sinCedulaHastaEdad: 9, permiteOrdenHijo: true };
const MADRE: ParentescoCatalogo = { id: 2, nombre: "Madre", esHijo: false, menorACargo: false, sinCedulaHastaEdad: null, permiteOrdenHijo: false };
const HOY = new Date("2026-11-24T12:00:00Z");
const base = { ...FAMILIAR_VACIO, primerNombre: "Ana", primerApellido: "Pérez", sexoId: "1", dependeEconomicamente: "si" as const };

const mensajes = (r: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) =>
  r.success ? [] : (r.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) ?? []);

describe("esquema de familiares", () => {
  const estricto = crearEsquemaFamiliares([HIJO, MADRE], { estricto: true, hoy: HOY });
  const flexible = crearEsquemaFamiliares([HIJO, MADRE], { estricto: false, hoy: HOY });

  it("un hijo menor sin cédula exige el orden de nacimiento", () => {
    const sinOrden = estricto.safeParse({ sinFamiliares: false, familiares: [{ ...base, parentescoId: "1", fechaNacimiento: "2021-03-02" }] });
    expect(mensajes(sinOrden).join("|")).toMatch(/familiares\.0\.ordenHijo: Indica el orden/);
    const conOrden = estricto.safeParse({ sinFamiliares: false, familiares: [{ ...base, parentescoId: "1", fechaNacimiento: "2021-03-02", ordenHijo: "1" }] });
    expect(conOrden.success).toBe(true);
  });

  it("un hijo mayor sin cédula o cualquier otro parentesco sin cédula exigen la cédula", () => {
    const a = estricto.safeParse({ sinFamiliares: false, familiares: [{ ...base, parentescoId: "1", fechaNacimiento: "2005-03-02" }] });
    expect(mensajes(a).join("|")).toMatch(/familiares\.0\.cedula: .*menores de 9/);
    const b = estricto.safeParse({ sinFamiliares: false, familiares: [{ ...base, parentescoId: "2", fechaNacimiento: "1965-03-02" }] });
    expect(mensajes(b).join("|")).toMatch(/familiares\.0\.cedula: Escribe la cédula/);
  });

  it("valida fechas: futura, inexistente o de más de 120 años", () => {
    expect(problemaDeFecha("2030-01-01", HOY)).toMatch(/futura/);
    expect(problemaDeFecha("2026-02-31", HOY)).toMatch(/válida/);
    expect(problemaDeFecha("1850-01-01", HOY)).toMatch(/120/);
    expect(problemaDeFecha("2000-02-29", HOY)).toBeNull();
  });

  it("máximo de 20 familiares y sin duplicar cédulas", () => {
    const veintiuno = Array.from({ length: 21 }, (_, i) => ({ ...base, parentescoId: "2", fechaNacimiento: "1960-01-01", cedula: `V${i + 1}` }));
    expect(mensajes(flexible.safeParse({ sinFamiliares: false, familiares: veintiuno })).join("|")).toMatch(/máximo 20/);
    const dup = flexible.safeParse({ sinFamiliares: false, familiares: [{ ...base, cedula: "V1" }, { ...base, cedula: "v1" }] });
    expect(mensajes(dup).join("|")).toMatch(/familiares\.1\.cedula: Esta cédula ya está registrada/);
  });

  it("exige al menos un familiar o la declaración, y no ambas", () => {
    expect(mensajes(estricto.safeParse({ sinFamiliares: false, familiares: [] })).join("|")).toMatch(/familiares: Agrega al menos/);
    expect(estricto.safeParse({ sinFamiliares: true, familiares: [] }).success).toBe(true);
    expect(mensajes(flexible.safeParse({ sinFamiliares: true, familiares: [base] })).join("|")).toMatch(/sinFamiliares/);
  });

  it("al guardar avance (flexible) acepta una tarjeta a medias", () => {
    expect(flexible.safeParse({ sinFamiliares: false, familiares: [{ ...FAMILIAR_VACIO, primerNombre: "Ana" }] }).success).toBe(true);
  });

  it("los nombres solo admiten letras y tienen máximo", () => {
    expect(mensajes(flexible.safeParse({ sinFamiliares: false, familiares: [{ ...base, primerNombre: "Ana3" }] })).join("|")).toMatch(/solo letras/);
    expect(mensajes(flexible.safeParse({ sinFamiliares: false, familiares: [{ ...base, primerNombre: "a".repeat(151) }] })).join("|")).toMatch(/Máximo 150/);
  });
});

describe("esquemas de vivienda, salud y tallas", () => {
  it("la vivienda exige todo en modo estricto pero no al guardar avance", () => {
    const vacio = { condicionViviendaId: "", estadoId: "", municipioId: "", parroquiaId: "", direccionExacta: "", ciudadRegion: "" };
    expect(crearEsquemaVivienda({ estricto: false }).safeParse(vacio).success).toBe(true);
    expect(mensajes(crearEsquemaVivienda({ estricto: true }).safeParse(vacio))).toHaveLength(5);
  });
  it("la dirección tiene un máximo de 300 caracteres", () => {
    const v = { condicionViviendaId: "1", estadoId: "1", municipioId: "1", parroquiaId: "1", direccionExacta: "x".repeat(301), ciudadRegion: "" };
    expect(mensajes(crearEsquemaVivienda({ estricto: false }).safeParse(v)).join("|")).toMatch(/Máximo 300/);
  });
  it("salud exige el grupo sanguíneo y tallas las tres prendas obligatorias", () => {
    expect(crearEsquemaSalud({ estricto: true }).safeParse({ grupoSanguineoId: "", alergias: [], patologiasCronicas: [], discapacidades: [] }).success).toBe(false);
    expect(mensajes(crearEsquemaTallas({ estricto: true }).safeParse({ tallaCamisaId: "", tallaPantalonId: "", tallaZapatosId: "", tallaChaquetaId: "" }))).toHaveLength(3);
  });
});
