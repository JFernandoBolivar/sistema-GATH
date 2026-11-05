import { describe, expect, it } from "vitest";
import {
  datosBarrasEstados,
  datosBarrasTipos,
  datosDonutCobertura,
  filasMatriz,
  tituloCasilla,
} from "./datos-graficos";
import type { FilaTipoEstadistica } from "../../domain/entities/estadisticas";

const tipos: FilaTipoEstadistica[] = [
  { tipoNominaId: 1, tipoNomina: "JUBILADO", total: 5, respondieron: 3, faltan: 2, validadas: 2 },
  { tipoNominaId: 2, tipoNomina: "PENSIONADO", total: 2, respondieron: 0, faltan: 2, validadas: 0 },
];

describe("datos de los gráficos de estadísticas", () => {
  it("arma las barras por tipo con respondieron y faltan", () => {
    expect(datosBarrasTipos(tipos)).toEqual([
      { name: "JUBILADO", respondieron: 3, faltan: 2 },
      { name: "PENSIONADO", respondieron: 0, faltan: 2 },
    ]);
  });

  it("arma la dona de cobertura sin valores negativos", () => {
    expect(datosDonutCobertura(3, -1)).toEqual([
      { name: "Respondieron", value: 3 },
      { name: "Faltan por responder", value: 0 },
    ]);
  });

  it("etiqueta los estados con el texto de la fe de vida", () => {
    expect(datosBarrasEstados([
      { estado: "PENDIENTE_SEGUNDO_CHECK", total: 2 },
      { estado: "EXPIRADA", total: 1 },
    ])).toEqual([
      { name: "En segunda revisión", total: 2 },
      { name: "Vencida", total: 1 },
    ]);
  });

  it("completa la matriz con ceros en las casillas sin solicitudes", () => {
    const filas = filasMatriz(tipos, [
      { tipoNominaId: 1, tipoNomina: "JUBILADO", estado: "VALIDADA", total: 2 },
      { tipoNominaId: 1, tipoNomina: "JUBILADO", estado: "DEVUELTA", total: 1 },
    ]);
    expect(filas[0].celdas.VALIDADA).toBe(2);
    expect(filas[0].celdas.DEVUELTA).toBe(1);
    expect(filas[0].celdas.RECHAZADA).toBe(0);
    expect(filas[0].total).toBe(3);
    expect(filas[1].total).toBe(0);
  });

  it("titula la casilla con estado y tipo", () => {
    expect(tituloCasilla("VALIDADA", "JUBILADO")).toBe("Validada · JUBILADO");
    expect(tituloCasilla("EXPIRADA", null)).toBe("Vencida");
  });
});
