import { describe, expect, it } from "vitest";

import { pasivoApiAEntidad } from "./mapper-pasivos";
import type { PasivoApiItem } from "../http/pasivos-api";

function baseRaw(overrides: Partial<PasivoApiItem> = {}): PasivoApiItem {
  return {
    id: 1,
    cedula: "12345678",
    nombres: "Juan",
    apellidos: "Pérez",
    nombre_completo: "Juan Pérez",
    tipo_pasivo: "JUBILADO",
    fecha_egreso: "2020-01-15",
    resolucion: "RES-001",
    observaciones: null,
    datos_vivienda: null,
    perfil_salud: null,
    perfil_fisico: null,
    formacion_academica: [],
    contacto_emergencia: [],
    antecedentes: [],
    contrato_actual: null,
    cargos_historial: [],
    ...overrides,
  };
}

describe("pasivoApiAEntidad", () => {
  it("mapea el perfil físico (antes ausente en la entidad)", () => {
    const entidad = pasivoApiAEntidad(
      baseRaw({
        perfil_fisico: {
          talla_camisa_id: 1,
          talla_pantalon_id: 2,
          talla_zapatos_id: 3,
          talla_chaqueta_id: 4,
        },
      }),
    );

    expect(entidad.perfilFisico).toEqual({
      tallaCamisaId: 1,
      tallaPantalonId: 2,
      tallaZapatosId: 3,
      tallaChaquetaId: 4,
    });
  });

  it("mapea el historial de cargos con los nombres de catálogo ya resueltos por el backend", () => {
    const entidad = pasivoApiAEntidad(
      baseRaw({
        cargos_historial: [
          {
            codigo: "AN-001",
            denominacioncargo_id: 1,
            denominacioncargo_nombre: "Analista",
            denominacioncargoespecifico_id: 2,
            denominacioncargoespecifico_nombre: "Analista de Sistemas",
            grado_id: null,
            grado_nombre: null,
            tipo_nomina_id: 3,
            tipo_nomina_nombre: "Fija",
            tipo_personal_id: 4,
            tipo_personal_nombre: "PASIVO",
            dependencia_id: 5,
            dependencia_nombre: "Dirección de Tecnología",
            direccion_general_id: null,
            direccion_general_nombre: null,
            direccion_linea_id: null,
            direccion_linea_nombre: null,
            coordinacion_id: null,
            coordinacion_nombre: null,
            organismo_adscrito_id: 6,
            organismo_adscrito_nombre: "Ministerio de Ejemplo",
          },
        ],
      }),
    );

    expect(entidad.cargosHistorial).toEqual([
      {
        codigo: "AN-001",
        denominacionCargoId: 1,
        denominacionCargoNombre: "Analista",
        denominacionCargoEspecificoId: 2,
        denominacionCargoEspecificoNombre: "Analista de Sistemas",
        gradoId: null,
        gradoNombre: null,
        tipoNominaId: 3,
        tipoNominaNombre: "Fija",
        tipoPersonalId: 4,
        tipoPersonalNombre: "PASIVO",
        dependenciaId: 5,
        dependenciaNombre: "Dirección de Tecnología",
        direccionGeneralId: null,
        direccionGeneralNombre: null,
        direccionLineaId: null,
        direccionLineaNombre: null,
        coordinacionId: null,
        coordinacionNombre: null,
        organismoAdscritoId: 6,
        organismoAdscritoNombre: "Ministerio de Ejemplo",
      },
    ]);
  });

  it("devuelve perfilFisico null cuando el backend no lo envía", () => {
    const entidad = pasivoApiAEntidad(baseRaw());
    expect(entidad.perfilFisico).toBeNull();
  });
});
