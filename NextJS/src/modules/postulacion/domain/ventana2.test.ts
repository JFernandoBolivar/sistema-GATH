import { describe, expect, it } from "vitest";
import {
  calcularAvance,
  campoDeRutaApi,
  cuerpoFamiliares,
  edadEnAnios,
  FAMILIAR_VACIO,
  mensajeDeCodigoVentana2,
  reglaCedulaFamiliar,
  seccionDeFaltante,
  validarDimensionesFoto,
  validarTipoYTamanoFoto,
  type ParentescoCatalogo,
} from "./ventana2";

const HIJO: ParentescoCatalogo = { id: 1, nombre: "Hijo(a)", esHijo: true, menorACargo: false, sinCedulaHastaEdad: 9, permiteOrdenHijo: true };
const HOY = new Date("2026-11-24T12:00:00Z");

describe("avance y faltantes de la Ventana 2", () => {
  it("sin faltantes todo está completo", () => {
    const a = calcularAvance([]);
    expect(a).toMatchObject({ completas: 5, total: 5, porcentaje: 100, todoCompleto: true });
  });

  it("marca incompletas las secciones con faltantes y calcula el porcentaje", () => {
    const a = calcularAvance([
      { seccion: "vivienda", campo: "vivienda.estado_id", mensaje: "Falta el estado." },
      { seccion: "foto", campo: "foto", mensaje: "Falta la foto de carnet." },
    ]);
    expect(a.completas).toBe(3);
    expect(a.porcentaje).toBe(60);
    expect(a.secciones.find((s) => s.id === "vivienda")?.completa).toBe(false);
    expect(a.secciones.find((s) => s.id === "foto")?.faltantes).toHaveLength(1);
    expect(a.todoCompleto).toBe(false);
  });

  it("lleva cada faltante a su sección", () => {
    expect(seccionDeFaltante({ seccion: "familiares", campo: "sin_familiares", mensaje: "" })).toBe("familiares");
    expect(seccionDeFaltante({ seccion: "tallas", campo: "tallas.talla_camisa_id", mensaje: "" })).toBe("tallas");
  });
});

describe("regla de la cédula del familiar", () => {
  it("un hijo menor de 9 años puede no tener cédula y necesita orden", () => {
    expect(reglaCedulaFamiliar(HIJO, "2020-05-01", HOY)).toMatchObject({ puedeSinCedula: true, requiereOrden: true });
  });
  it("un hijo mayor de 9 años necesita cédula", () => {
    expect(reglaCedulaFamiliar(HIJO, "2010-05-01", HOY)).toMatchObject({ puedeSinCedula: false, requiereOrden: false });
  });
  it("calcula la edad respetando el cumpleaños", () => {
    expect(edadEnAnios("2017-11-25", HOY)).toBe(8);
    expect(edadEnAnios("2017-11-24", HOY)).toBe(9);
    expect(edadEnAnios("no-es-fecha", HOY)).toBeNull();
  });
});

describe("cuerpo del PUT de familiares", () => {
  it("con «No tengo carga familiar» envía la lista vacía", () => {
    expect(cuerpoFamiliares({ sinFamiliares: true, familiares: [] })).toEqual({ sin_familiares: true, familiares: [] });
  });
  it("omite el orden si hay cédula y convierte ids y booleano", () => {
    const c = cuerpoFamiliares({
      sinFamiliares: false,
      familiares: [{ ...FAMILIAR_VACIO, primerNombre: " Ana ", primerApellido: "Pérez", cedula: "v123", ordenHijo: "2", parentescoId: "3", sexoId: "1", fechaNacimiento: "2015-01-01", dependeEconomicamente: "no" }],
    });
    expect(c).toEqual({
      sin_familiares: false,
      familiares: [{ primer_nombre: "Ana", primer_apellido: "Pérez", cedula: "V123", parentesco_id: 3, sexo_id: 1, fecha_nacimiento: "2015-01-01", depende_economicamente: false }],
    });
  });
});

describe("errores del servidor", () => {
  it("mapea los códigos conocidos y deja pasar los desconocidos", () => {
    expect(mensajeDeCodigoVentana2("VENTANA_INCORRECTA")).toMatch(/ya no está disponible/);
    expect(mensajeDeCodigoVentana2("VENTANA2_INCOMPLETA")).toMatch(/faltan/i);
    expect(mensajeDeCodigoVentana2("OTRO")).toBeNull();
  });
  it("traduce las rutas del backend al campo del formulario", () => {
    expect(campoDeRutaApi("familiares.1.fecha_nacimiento")).toEqual({ seccion: "familiares", campo: "familiares.1.fechaNacimiento" });
    expect(campoDeRutaApi("datos_ventana2.vivienda.estado_id")).toEqual({ seccion: "vivienda", campo: "estadoId" });
    expect(campoDeRutaApi("tallas.talla_camisa_id")).toEqual({ seccion: "tallas", campo: "tallaCamisaId" });
  });
});

describe("validación de la foto en el cliente", () => {
  it("acepta JPEG y PNG dentro del tamaño", () => {
    expect(validarTipoYTamanoFoto({ type: "image/png", size: 1000 })).toBeNull();
    expect(validarTipoYTamanoFoto({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
  });
  it("rechaza otros tipos, vacíos y archivos de más de 5 MB", () => {
    expect(validarTipoYTamanoFoto({ type: "image/gif", size: 1000 })).toMatch(/JPEG o PNG/);
    expect(validarTipoYTamanoFoto({ type: "image/png", size: 0 })).toMatch(/vacío/);
    expect(validarTipoYTamanoFoto({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
  it("exige 300x300 como mínimo", () => {
    expect(validarDimensionesFoto(300, 300)).toBeNull();
    expect(validarDimensionesFoto(299, 800)).toMatch(/300x300/);
  });
});
