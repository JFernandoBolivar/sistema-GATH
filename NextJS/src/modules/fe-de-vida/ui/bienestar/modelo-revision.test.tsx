import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { CambioEntity, FichaPasivoEntity } from "../../domain/entities/fe-de-vida";
import { FichaRevision } from "./ficha-revision";
import { construirSecciones, type DatoRevision, type Formateador } from "./modelo-revision";

const FICHA: FichaPasivoEntity = {
  cedula: "5111111",
  nombres: "MARIA",
  apellidos: "PEREZ",
  sexo: "FEMENINO",
  fechaNacimiento: "1950-10-30",
  correo: "maria@correo.test",
  correoAlternativo: "alterno@correo.test",
  telefonoMovil: "04140000000",
  telefonoHabitacion: null,
  asignacion: {
    tipoNomina: "JUBILADO",
    cargo: "ANALISTA I",
    dependencia: "CONATEL",
    direccionGeneral: "N/A",
    direccionLinea: "DIRECCION DE RRHH",
    coordinacion: "N/A",
  },
  fechaIngreso: "1990-01-15",
  fechaEgreso: "2015-06-30",
  vivienda: {
    estadoId: 16,
    municipioId: 188,
    estado: "MIRANDA",
    municipio: "LANDER",
    parroquia: "LA DEMOCRACIA",
    codigoPostal: "1201",
    direccion: "Calle 5 casa 3",
    condicion: "ALQUILADA",
  },
  contactosEmergencia: [{ id: "7", nombres: "LUIS", apellidos: "PEREZ", parentesco: "HERMANO", telefono: "04141112222" }],
  familiares: [
    { id: "1", nombre: "ANA PEREZ", parentesco: "HIJO (A)", cedula: "30111222", fechaNacimiento: "1980-02-03" },
  ],
  tieneHijos: true,
};

const NOMBRES: Record<string, string> = { "5": "BARINAS", "9": "HIJO (A)" };
const formatear: Formateador = (v, campo) =>
  typeof v === "boolean" ? (v ? "Sí" : "No") : campo.endsWith("_id") ? (NOMBRES[String(v)] ?? `Código ${v}`) : String(v);
const HOY = new Date(2026, 9, 30);

function cambio(p: Partial<CambioEntity>): CambioEntity {
  return {
    id: "c1", seccion: "contacto", accion: "MODIFICAR", entidad: "employee", entidadId: null, campo: "telefono_movil",
    valorAnterior: null, valorPropuesto: "04149999999", valorActual: "04140000000", conflicto: false, ...p,
  };
}
const datos = (secs: ReturnType<typeof construirSecciones>, id: string) => secs.find((s) => s.id === id)!.datos;
const dato = (ds: DatoRevision[], clave: string) => ds.find((d) => d.clave === clave)!;

describe("construirSecciones", () => {
  it("sigue el orden de la planilla y no concatena valores", () => {
    const secs = construirSecciones({ ficha: FICHA, cambios: [], formatear, hoy: HOY });
    expect(secs.map((s) => s.titulo)).toEqual([
      "Datos personales",
      "Datos de la pensión",
      "Contacto",
      "Vivienda",
      "Grupo familiar e hijos",
    ]);
    const viv = datos(secs, "vivienda");
    expect(viv.map((d) => [d.etiqueta, d.valor])).toEqual([
      ["Estado", "MIRANDA"],
      ["Municipio", "LANDER"],
      ["Parroquia", "LA DEMOCRACIA"],
      ["Código postal", "1201"],
      ["Dirección", "Calle 5 casa 3"],
      ["Condición de la vivienda", "ALQUILADA"],
    ]);
    expect(JSON.stringify(secs)).not.toContain("·");
  });

  it("calcula edad, oficina de adscripción (nivel más específico) y fechas civiles sin correr el día", () => {
    const secs = construirSecciones({ ficha: FICHA, cambios: [], formatear, hoy: HOY });
    expect(dato(datos(secs, "personales"), "employee.fecha_nacimiento").valor).toBe("30/10/1950 (76 años)");
    const pension = datos(secs, "pension");
    expect(dato(pension, "oficina").valor).toBe("DIRECCION DE RRHH");
    expect(dato(pension, "tipo").valor).toBe("JUBILADO");
    expect(dato(pension, "ingreso").valor).toBe("15/01/1990");
  });

  it("muestra el valor DECLARADO con la marca «modificado» y el valor anterior", () => {
    const secs = construirSecciones({ ficha: FICHA, cambios: [cambio({})], formatear, hoy: HOY });
    const movil = dato(datos(secs, "contacto"), "employee.telefono_movil");
    expect(movil.valor).toBe("04149999999");
    expect(movil.marca).toEqual({ tipo: "modificado", anterior: "04140000000" });
  });

  it("si antes no había dato, solo marca «nuevo» (sin «Sin dato»)", () => {
    const secs = construirSecciones({
      ficha: FICHA,
      cambios: [cambio({ campo: "telefono_habitacion", valorPropuesto: "02121234567", valorActual: null })],
      formatear,
      hoy: HOY,
    });
    const hab = dato(datos(secs, "contacto"), "employee.telefono_habitacion");
    expect(hab.valor).toBe("02121234567");
    expect(hab.marca).toEqual({ tipo: "nuevo" });
  });

  it("si lo declarado coincide con lo actual, no hay marca; los catálogos usan nombres", () => {
    const secs = construirSecciones({
      ficha: FICHA,
      cambios: [
        cambio({ campo: "telefono_movil", valorPropuesto: "04140000000" }),
        cambio({ id: "c2", seccion: "vivienda", entidad: "datos_vivienda", campo: "estado_id", valorPropuesto: 5, valorActual: 3 }),
      ],
      formatear,
      hoy: HOY,
    });
    expect(dato(datos(secs, "contacto"), "employee.telefono_movil").marca).toBeUndefined();
    const estado = dato(datos(secs, "vivienda"), "datos_vivienda.estado_id");
    expect(estado.valor).toBe("BARINAS");
    expect(estado.marca).toEqual({ tipo: "modificado", anterior: "MIRANDA" });
  });

  it("familiares: nuevos y corregidos se marcan en la tabla, cada dato en su columna", () => {
    const nuevo = cambio({
      id: "c3", seccion: "familiar", accion: "CREAR", entidad: "familiar", campo: "*",
      valorPropuesto: { primer_nombre: "PEDRO", primer_apellido: "GOMEZ", parentesco_id: 9, cedula_familiar: "31222333", fecha_nacimiento: "2010-05-06" },
      valorActual: null,
    });
    const corregido = cambio({
      id: "c4", seccion: "familiar", entidad: "familiar", entidadId: "1", campo: "cedula_familiar",
      valorPropuesto: "30111999", valorActual: "30111222",
    });
    const secs = construirSecciones({ ficha: FICHA, cambios: [nuevo, corregido], formatear, hoy: HOY });
    const tabla = secs.find((s) => s.id === "familia")!.tablas[0];
    expect(tabla.columnas).toEqual(["Nombre", "Parentesco", "Cédula", "Fecha de nacimiento"]);
    expect(tabla.filas).toHaveLength(2);
    expect(tabla.filas[0].marca).toBe("modificado");
    expect(tabla.filas[0].detalles[0]).toContain("30111999");
    expect(tabla.filas[0].detalles[0]).toContain("antes: 30111222");
    expect(tabla.filas[1]).toMatchObject({ marca: "nuevo", celdas: ["PEDRO GOMEZ", "HIJO (A)", "31222333", "06/05/2010"] });
  });

  it("lo que no cabe en la planilla va a «Otros datos propuestos», campo por campo", () => {
    const otro = cambio({
      id: "c5", seccion: "formacion", accion: "CREAR", entidad: "formacion_academica", campo: "*",
      valorPropuesto: { nivel_academico_id: 5, carrera_id: 9 }, valorActual: null,
    });
    const secs = construirSecciones({ ficha: FICHA, cambios: [otro], formatear, hoy: HOY });
    const otros = secs.find((s) => s.id === "otros")!;
    expect(otros.datos).toHaveLength(2);
    expect(otros.datos.every((d) => d.marca?.tipo === "nuevo")).toBe(true);
  });

  it("una vivienda que no existía llega como registro nuevo: cada campo va a su lugar, no a «Otros»", () => {
    const nueva = cambio({
      id: "c6", seccion: "vivienda", accion: "CREAR", entidad: "datos_vivienda", campo: "*",
      valorPropuesto: { estado_id: 5, direccion_exacta: "Calle 1", condicion_vivienda_id: 9 }, valorActual: null,
    });
    const secs = construirSecciones({ ficha: { ...FICHA, vivienda: null }, cambios: [nueva], formatear, hoy: HOY });
    const viv = datos(secs, "vivienda");
    expect(dato(viv, "datos_vivienda.estado_id")).toMatchObject({ valor: "BARINAS", marca: { tipo: "nuevo" } });
    expect(dato(viv, "datos_vivienda.direccion_exacta")).toMatchObject({ valor: "Calle 1", marca: { tipo: "nuevo" } });
    expect(secs.some((x) => x.id === "otros")).toBe(false);
  });

  it("sin ficha (sin permiso) igual muestra lo que propone el pasivo", () => {
    const secs = construirSecciones({ ficha: null, cambios: [cambio({})], formatear, hoy: HOY });
    expect(dato(datos(secs, "contacto"), "employee.telefono_movil")).toMatchObject({ valor: "04149999999", marca: { tipo: "nuevo" } });
  });
});

describe("FichaRevision", () => {
  it("pinta secciones con dl/dt/dd, insignias con texto y «Antes:» discreto", () => {
    const secs = construirSecciones({ ficha: FICHA, cambios: [cambio({})], formatear, hoy: HOY });
    render(<FichaRevision secciones={secs} />);
    expect(screen.getByRole("heading", { name: "Vivienda" })).toBeInTheDocument();
    const contacto = screen.getByRole("region", { name: "Contacto" });
    expect(within(contacto).getByText("Teléfono móvil").tagName).toBe("DT");
    expect(within(contacto).getByText("04149999999")).toBeInTheDocument();
    expect(within(contacto).getByText("Modificado")).toBeInTheDocument();
    expect(within(contacto).getByText("Antes: 04140000000")).toBeInTheDocument();
    expect(within(contacto).queryByText("Valor actual en la ficha")).toBeNull();
    expect(within(contacto).getByRole("table", { name: "Contacto de emergencia" })).toBeInTheDocument();
  });

  it("un dato sin valor muestra «Sin dato» y nunca «Nuevo/Modificado»", () => {
    const secs = construirSecciones({ ficha: FICHA, cambios: [], formatear, hoy: HOY });
    render(<FichaRevision secciones={secs} />);
    const contacto = screen.getByRole("region", { name: "Contacto" });
    expect(within(contacto).getByText("Sin dato")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).toBeNull();
    expect(screen.queryByText("Modificado")).toBeNull();
  });
});
