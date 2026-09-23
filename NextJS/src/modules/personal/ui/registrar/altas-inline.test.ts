import { describe, expect, it } from "vitest";

import type { RegistroPasosType } from "../schema/schema-registro-pasos";
import { recolectarAltasInline } from "./altas-inline";
import { registroPasosADTO } from "./registro-a-dto";

const base = {
  cedulaidentidad: "12345678",
  nombres: "Juan",
  apellidos: "Perez",
  file: null,
  fecha_nacimiento: new Date(1990, 0, 1),
  sexoid: 1,
  estadoCivil: 1,
  perfil_salud: {},
  perfil_fisico: { tallaCamisa: 1, tallaPantalon: 1, tallaZapatos: 1 },
  datos_vivienda: {
    direccion_exacta: "Calle 1, Casa 2, Centro",
    estado_id: 1,
    municipio_id: 1,
    parroquia: 1,
    condicion_vivienda_id: 1,
    codigo_postal_id: 1,
  },
} as unknown as RegistroPasosType;

describe("recolectarAltasInline", () => {
  it("no pide nada si no hay opciones \"Otra\"", () => {
    const valores = { ...base, formacion_academica: [{ nivel_Academico_id: 1, carrera_id: 5, institucion_id: 2 }] };
    expect(recolectarAltasInline(valores).solicitudes).toEqual([]);
  });

  it("pide carrera (con su nivel), mención (con su carrera), instituciones y capacitación", () => {
    const valores: RegistroPasosType = {
      ...base,
      formacion_academica: [
        { nivel_Academico_id: 3, carrera_id: -1, nueva_carrera_nombre: "Medicina", institucion_id: -1, nueva_institucion_nombre: "UNEXPO" },
        { nivel_Academico_id: 3, carrera_id: 7, mencion_id: -1, nueva_mencion_nombre: "Control", institucion_id: 2 },
      ],
      formacion_complementaria: [
        { capacitacion_id: -1, nueva_capacitacion_nombre: "Oratoria", institucion_id: 2, procedencia_id: 1 },
      ],
    };
    const { solicitudes } = recolectarAltasInline(valores);
    expect(solicitudes).toEqual([
      { tipo: "carreras", nombre: "Medicina", padreId: 3 },
      { tipo: "instituciones", nombre: "UNEXPO" },
      { tipo: "menciones", nombre: "Control", padreId: 7 },
      { tipo: "capacitaciones", nombre: "Oratoria" },
    ]);
  });

  it("aplica los ids resueltos sin mutar el original y el DTO los usa", () => {
    const valores: RegistroPasosType = {
      ...base,
      formacion_academica: [
        { nivel_Academico_id: 3, carrera_id: -1, nueva_carrera_nombre: "Medicina", institucion_id: -1, nueva_institucion_nombre: "UNEXPO" },
      ],
      formacion_complementaria: [{ capacitacion_id: -1, nueva_capacitacion_nombre: "Oratoria", institucion_id: 2, procedencia_id: 1 }],
    };
    const { aplicar } = recolectarAltasInline(valores);
    const resuelto = aplicar([100, 200, 300]);

    expect(valores.formacion_academica![0].carrera_id).toBe(-1);
    const dto = registroPasosADTO(resuelto);
    expect(dto.formacionAcademica).toEqual([{ nivelAcademicoId: 3, carreraId: 100, mencionId: null, institucionId: 200 }]);
    expect(dto.formacionComplementaria?.[0].capacitacionId).toBe(300);
  });
});
