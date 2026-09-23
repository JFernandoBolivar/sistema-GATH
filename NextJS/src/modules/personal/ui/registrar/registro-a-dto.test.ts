import { describe, expect, it } from "vitest";

import { empleadoSchema } from "../schema/schema-empleado";
import {
  antecedentePasoItemSchema,
  formacionAcademicaPasoItemSchema,
  pasoBasicInfoSchema,
  pasoDwellingSchema,
  pasoPhysicalProfileSchema,
  type RegistroPasosType,
} from "../schema/schema-registro-pasos";
import { registroPasosADTO } from "./registro-a-dto";

const basico = {
  cedulaidentidad: "12345678",
  nombres: "Juan Bernardo",
  apellidos: "Perez Gutierrez",
  file: null,
  fecha_nacimiento: new Date(1990, 4, 17),
  sexoid: 1,
  estadoCivil: 2,
  correo: "",
  telefono_movil: "",
  telefono_habitacion: "",
  carnet_patria: "",
};

const completo: RegistroPasosType = {
  ...basico,
  formacion_academica: [{ nivel_Academico_id: 3, carrera_id: 7, mencion_id: undefined, institucion_id: 9 }],
  formacion_complementaria: [],
  antecedentes: [{ organismo_id: undefined, fecha_ingreso: undefined, fecha_egreso: undefined }],
  perfil_salud: { grupoSanguineo: 0, discapacidad: [], patologiaCronica: [4], alergias: [] },
  perfil_fisico: { tallaCamisa: 1, tallaPantalon: 2, tallaZapatos: 3, tallaChaqueta: 0 },
  datos_vivienda: {
    direccion_exacta: "Calle 1, Casa 2, Sector Centro",
    estado_id: 1,
    municipio_id: 2,
    parroquia: 3,
    condicion_vivienda_id: 1,
    codigo_postal_id: 5,
  },
};

describe("schemas por paso del wizard de registro", () => {
  it("paso 1 acepta opcionales vacíos y exige sexo/estado civil", () => {
    expect(pasoBasicInfoSchema.safeParse(basico).success).toBe(true);
    const sinSexo = pasoBasicInfoSchema.safeParse({ ...basico, sexoid: 0 });
    expect(sinSexo.success).toBe(false);
  });

  it("paso 1 rechaza menores de 16 años", () => {
    const r = pasoBasicInfoSchema.safeParse({ ...basico, fecha_nacimiento: new Date() });
    expect(r.success).toBe(false);
  });

  it("formación académica exige institución cuando hay carrera", () => {
    expect(formacionAcademicaPasoItemSchema.safeParse({ nivel_Academico_id: 1, carrera_id: 2 }).success).toBe(false);
    expect(formacionAcademicaPasoItemSchema.safeParse({ nivel_Academico_id: 1 }).success).toBe(true);
  });

  it("antecedente exige ambas fechas y organismo", () => {
    expect(antecedentePasoItemSchema.safeParse({}).success).toBe(true);
    expect(antecedentePasoItemSchema.safeParse({ fecha_ingreso: new Date(2010, 0, 1) }).success).toBe(false);
  });

  it("vestimenta exige camisa, pantalón y zapatos", () => {
    const r = pasoPhysicalProfileSchema.safeParse({ perfil_fisico: { tallaCamisa: 0, tallaPantalon: 1, tallaZapatos: 1 } });
    expect(r.success).toBe(false);
  });

  it("vivienda exige dirección de al menos 10 caracteres", () => {
    const r = pasoDwellingSchema.safeParse({ datos_vivienda: { ...completo.datos_vivienda, direccion_exacta: "corta" } });
    expect(r.success).toBe(false);
  });
});

describe("registroPasosADTO", () => {
  it("produce un DTO que pasa el empleadoSchema de la Server Action", () => {
    const dto = registroPasosADTO(completo);
    expect(empleadoSchema.safeParse(dto).success).toBe(true);
    expect(dto).toMatchObject({
      cedula: "12345678",
      sexoId: 1,
      fechaNacimiento: "1990-05-17",
      correo: null,
      telefonoMovil: null,
      estadoCivilId: 2,
      formacionAcademica: [{ nivelAcademicoId: 3, carreraId: 7, mencionId: null, institucionId: 9 }],
      antecedentes: [],
      perfilSalud: { grupoSanguineoId: null, patologiasCronicas: [4] },
      perfilFisico: { tallaCamisaId: 1, tallaChaquetaId: null },
      datosVivienda: { parroquiaId: 3, codigoPostalId: 5 },
    });
  });

  it("convierte fechas de formación complementaria a ISO", () => {
    const dto = registroPasosADTO({
      ...completo,
      formacion_complementaria: [
        {
          capacitacion_id: 1,
          institucion_id: 2,
          procedencia_id: 3,
          grupo_id: 0,
          horas_completadas: "40",
          fecha_inicio: new Date(2020, 0, 10),
          fecha_fin: new Date(2020, 1, 10),
        },
      ],
    });
    expect(dto.formacionComplementaria).toEqual([
      {
        capacitacionId: 1,
        institucionId: 2,
        procedenciaId: 3,
        grupoId: null,
        horasCompletadas: "40",
        fechaInicio: "2020-01-10",
        fechaFin: "2020-02-10",
      },
    ]);
    expect(empleadoSchema.safeParse(dto).success).toBe(true);
  });
});
