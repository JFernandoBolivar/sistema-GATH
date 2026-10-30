import { describe, expect, it } from "vitest";
import type { MiExpedienteDTO } from "@/modules/autogestion/application/dtos/mi-expediente-dto";
import type { ItemBorrador } from "@/modules/autogestion/domain/entities/solicitud-actualizacion";
import { aEntrada, cambiosAItems, fusionarContacto, valoresIniciales } from "./borrador-items";

const ficha = {
  empleado: { telefono_movil: "0414-0000000", telefono_habitacion: null },
  datos_complementarios: { correo_alternativo: null, tiene_hijos: null },
} as unknown as MiExpedienteDTO;

const valores = {
  telefonoMovil: "0414-0000000",
  telefonoHabitacion: "0212-5555555",
  correoAlternativo: "ana@correo.com",
  tieneHijos: "si" as const,
};

describe("fusionarContacto", () => {
  it("propone solo lo que difiere de la ficha y declara los hijos", () => {
    const items = fusionarContacto([], valores, ficha);
    const campos = items.map((i) => i.campo).sort();
    expect(campos).toEqual(["correo_alternativo", "telefono_habitacion", "tiene_hijos"]);
    expect(items.find((i) => i.campo === "tiene_hijos")).toMatchObject({ seccion: "familiar", valor: true });
  });
  it("con «No tiene hijos» descarta los items de hijos pero conserva los demás pasos", () => {
    const previos: ItemBorrador[] = [
      { seccion: "familiar", entidad: "familiar", accion: "CREAR", campo: "*", valor: { primer_nombre: "Luis" } },
      { seccion: "vivienda", entidad: "datos_vivienda", accion: "MODIFICAR", campo: "direccion_exacta", valor: "Calle 1" },
    ];
    const items = fusionarContacto(previos, { ...valores, tieneHijos: "no" }, ficha);
    expect(items.some((i) => i.entidad === "familiar")).toBe(false);
    expect(items.some((i) => i.entidad === "datos_vivienda")).toBe(true);
  });
  it("reemplaza lo anterior del formulario sin duplicar", () => {
    const una = fusionarContacto([], valores, ficha);
    const dos = fusionarContacto(una, { ...valores, telefonoHabitacion: "0212-9999999" }, ficha);
    expect(dos.filter((i) => i.campo === "telefono_habitacion")).toHaveLength(1);
    expect(dos.find((i) => i.campo === "telefono_habitacion")?.valor).toBe("0212-9999999");
  });
  it("no propone campos vacíos", () => {
    const items = fusionarContacto([], { ...valores, telefonoHabitacion: "", correoAlternativo: "" }, ficha);
    expect(items.map((i) => i.campo)).toEqual(["tiene_hijos"]);
  });
});

describe("valoresIniciales / cambiosAItems / aEntrada", () => {
  it("toma lo propuesto y, si no, lo vigente", () => {
    const items = fusionarContacto([], valores, ficha);
    expect(valoresIniciales(ficha, items)).toMatchObject({ telefonoHabitacion: "0212-5555555", tieneHijos: "si" });
    expect(valoresIniciales(ficha, [])).toMatchObject({ telefonoMovil: "0414-0000000", tieneHijos: "" });
  });
  it("convierte cambios guardados en items y los devuelve como cuerpo del borrador", () => {
    const items = cambiosAItems([
      {
        id: "1",
        seccion: "contacto",
        accion: "MODIFICAR",
        entidad: "employee",
        entidadId: null,
        campo: "telefono_movil",
        valorAnterior: null,
        valorPropuesto: "0412-1",
        valorActual: null,
        conflicto: false,
      },
    ]);
    expect(aEntrada(items)).toEqual([
      { seccion: "contacto", entidad: "employee", accion: "MODIFICAR", campo: "telefono_movil", valor: "0412-1", entidadId: null },
    ]);
  });
});
