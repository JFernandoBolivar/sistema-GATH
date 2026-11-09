import { describe, expect, it } from "vitest";

import type { ParametroDTO } from "../../application/dtos/parametro-dto";
import {
  etiquetaValorParametro,
  normalizarValorParametro,
  validarValorParametro,
} from "./schema-parametros";

function parametro(overrides: Partial<ParametroDTO>): ParametroDTO {
  return {
    clave: "plazos.password_inicial_dias",
    etiqueta: "Vigencia",
    descripcion: "",
    grupo: "plazos",
    tipo: "entero",
    valor: "7",
    defecto: "7",
    minimo: 1,
    maximo: 365,
    actualizadoPorId: null,
    actualizadoEn: null,
    opciones: [],
    ...overrides,
  };
}

const OPCIONES_RETENCION = [
  { valor: "30", etiqueta: "1 mes" },
  { valor: "365", etiqueta: "1 año" },
  { valor: "0", etiqueta: "Nunca" },
];

describe("parámetros con opciones (retención)", () => {
  const p = parametro({ valor: "365", opciones: OPCIONES_RETENCION, minimo: null, maximo: null });

  it("acepta solo las opciones, salvo el valor ya guardado", () => {
    expect(validarValorParametro(p, "0")).toBeNull();
    expect(validarValorParametro(p, "30")).toBeNull();
    expect(validarValorParametro(p, "45")).not.toBeNull();
    expect(validarValorParametro(parametro({ ...p, valor: "45" }), "45")).toBeNull();
  });

  it("muestra la etiqueta y marca los valores personalizados", () => {
    expect(etiquetaValorParametro(p, "0")).toBe("Nunca");
    expect(etiquetaValorParametro(p, "365")).toBe("1 año");
    expect(etiquetaValorParametro(p, "45")).toBe("45 días (personalizado)");
    expect(etiquetaValorParametro(parametro({}), "7")).toBe("7");
  });
});

describe("validarValorParametro", () => {
  it("acepta un entero dentro del rango y rechaza fuera o no numérico", () => {
    const p = parametro({});
    expect(validarValorParametro(p, "7")).toBeNull();
    expect(validarValorParametro(p, "0")).toContain("mínimo");
    expect(validarValorParametro(p, "366")).toContain("máximo");
    expect(validarValorParametro(p, "siete")).toContain("entero");
  });

  it("acepta solo true/false en un booleano", () => {
    const p = parametro({ tipo: "booleano", minimo: null, maximo: null });
    expect(validarValorParametro(p, "true")).toBeNull();
    expect(validarValorParametro(p, "sí")).not.toBeNull();
  });

  it("valida la lista de días de recordatorio y la normaliza", () => {
    const p = parametro({
      clave: "fe_de_vida.dias_recordatorio",
      tipo: "texto",
      minimo: null,
      maximo: null,
    });
    expect(validarValorParametro(p, "30,15,7,3,1")).toBeNull();
    expect(validarValorParametro(p, "0,abc")).not.toBeNull();
    expect(validarValorParametro(p, "1,2,3,4,5,6,7,8,9,10,11")).toContain("10");
    expect(normalizarValorParametro(p, "7, 30, 7, 1")).toBe("30,7,1");
  });

  it("rechaza un texto vacío", () => {
    expect(validarValorParametro(parametro({ tipo: "texto" }), "   ")).not.toBeNull();
  });

  it("valida y acepta lista de cédulas para mi_carnet_usuarios", () => {
    const p = parametro({
      clave: "carnetizacion.mi_carnet_usuarios",
      tipo: "texto",
      minimo: null,
      maximo: null,
    });
    expect(validarValorParametro(p, "")).toBeNull();
    expect(validarValorParametro(p, "12345678, 87654321")).toBeNull();
    expect(validarValorParametro(p, "12345678, abc")).toContain("no es una cédula válida");
  });
});
