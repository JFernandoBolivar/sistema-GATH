import { describe, expect, it } from "vitest";
import type { RepoAutogestion } from "../../domain/ports/repo-autogestion";
import type {
  ItemRespuestaCenso,
  PreguntaCenso,
  ReporteDependenciaCenso,
  RespuestaCenso,
} from "../../domain/entities/censo";
import {
  listarPreguntasCenso,
  obtenerCensoDeEmpleado,
  obtenerReporteDependenciasCenso,
  registrarRespuestasCenso,
} from "./gestionar-censo";

class RepoAutogestionMemoria implements RepoAutogestion {
  preguntas: PreguntaCenso[] = [
    {
      id: 1,
      enunciado: "¿Posee vivienda propia?",
      tipo: "seleccion_unica",
      orden: 1,
      activo: true,
      validacion: null,
      opciones: [
        { id: 10, texto: "Sí", orden: 1 },
        { id: 11, texto: "No", orden: 2 },
      ],
    },
  ];
  respuestas: RespuestaCenso[] = [
    {
      id: 1,
      preguntaId: 1,
      preguntaEnunciado: "¿Posee vivienda propia?",
      empleadoCedula: "12345678",
      opcionId: 10,
      opcionTexto: "Sí",
      respuestaTexto: "Sí",
    },
  ];

  async listarPreguntas() {
    return this.preguntas;
  }
  async obtenerCensoDeEmpleado(cedula: string) {
    return this.respuestas.filter((r) => r.empleadoCedula === cedula);
  }
  async registrarRespuestasCenso(cedula: string, respuestas: ItemRespuestaCenso[]) {
    this.respuestas = this.respuestas.filter((r) => r.empleadoCedula !== cedula);
    for (const r of respuestas) {
      this.respuestas.push({
        id: this.respuestas.length + 1,
        preguntaId: r.preguntaId,
        preguntaEnunciado: "¿Posee vivienda propia?",
        empleadoCedula: cedula,
        opcionId: r.opcionId ?? null,
        opcionTexto: r.opcionId === 10 ? "Sí" : "No",
        respuestaTexto: r.respuesta ?? "",
      });
    }
    return this.obtenerCensoDeEmpleado(cedula);
  }
  async obtenerReporteDependencias(): Promise<ReporteDependenciaCenso[]> {
    return [{ dependenciaId: 1, dependencia: "Tecnología", totalEmpleados: 10, empleadosCensados: 8 }];
  }
}

describe("Casos de uso de Autogestión", () => {
  it("listarPreguntasCenso y obtenerCensoDeEmpleado retornan DTOs", async () => {
    const repo = new RepoAutogestionMemoria();
    const preguntas = await listarPreguntasCenso(repo);
    expect(preguntas.length).toBe(1);
    expect(preguntas[0].opciones.length).toBe(2);

    const censo = await obtenerCensoDeEmpleado(repo, "12345678");
    expect(censo[0].opcionTexto).toBe("Sí");
  });

  it("registrarRespuestasCenso reemplaza las respuestas del empleado", async () => {
    const repo = new RepoAutogestionMemoria();
    const actualizado = await registrarRespuestasCenso(repo, "12345678", [{ preguntaId: 1, opcionId: 11 }]);
    expect(actualizado.length).toBe(1);
    expect(actualizado[0].opcionTexto).toBe("No");
  });

  it("obtenerReporteDependenciasCenso retorna el consolidado por dependencia", async () => {
    const repo = new RepoAutogestionMemoria();
    const reporte = await obtenerReporteDependenciasCenso(repo);
    expect(reporte[0].dependencia).toBe("Tecnología");
    expect(reporte[0].totalEmpleados).toBe(10);
  });
});
