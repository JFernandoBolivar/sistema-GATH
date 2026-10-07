/**
 * Mapea la salida combinada del wizard de registro (nombres de campo del
 * legado) al contrato `GuardarEmpleadoInputDTO` que consume
 * `registrarEmpleadoAction` (Regla R5). Función pura: la foto (`file`) se
 * sube aparte tras el alta, por eso no forma parte del DTO.
 */
import { format } from "date-fns";

import type { GuardarEmpleadoInputDTO } from "../../application/dtos/empleado-dto";
import { contactosFormADto } from "../schema/schema-contacto-emergencia";
import type { RegistroPasosType } from "../schema/schema-registro-pasos";

const fecha = (d?: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);
const id = (v?: number | null) => (typeof v === "number" && v > 0 ? v : null);
const texto = (v?: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

export function registroPasosADTO(data: RegistroPasosType): GuardarEmpleadoInputDTO {
  return {
    cedula: data.cedulaidentidad.trim(),
    nombres: data.nombres.trim(),
    apellidos: data.apellidos.trim(),
    sexoId: Number(data.sexoid),
    fechaNacimiento: format(data.fecha_nacimiento, "yyyy-MM-dd"),
    correo: texto(data.correo),
    telefonoMovil: texto(data.telefono_movil),
    telefonoHabitacion: texto(data.telefono_habitacion),
    estadoCivilId: id(data.estadoCivil),
    nacionalidadId: id(data.nacionalidad_id),
    carnetPatria: texto(data.carnet_patria),
    contactoEmergencia: contactosFormADto(data.contacto_emergencia),
    formacionAcademica: (data.formacion_academica ?? [])
      .filter((f) => id(f.nivel_Academico_id))
      .map((f) => ({
        nivelAcademicoId: f.nivel_Academico_id,
        carreraId: id(f.carrera_id),
        mencionId: id(f.mencion_id),
        institucionId: id(f.institucion_id),
      })),
    formacionComplementaria: (data.formacion_complementaria ?? []).map((f) => ({
      capacitacionId: id(f.capacitacion_id),
      institucionId: id(f.institucion_id),
      procedenciaId: id(f.procedencia_id),
      grupoId: id(f.grupo_id),
      horasCompletadas: texto(f.horas_completadas),
      fechaInicio: fecha(f.fecha_inicio),
      fechaFin: fecha(f.fecha_fin),
    })),
    antecedentes: (data.antecedentes ?? [])
      .filter((a) => id(a.organismo_id) || a.fecha_ingreso || a.fecha_egreso)
      .map((a) => ({
        organismoId: id(a.organismo_id),
        fechaIngreso: fecha(a.fecha_ingreso),
        fechaEgreso: fecha(a.fecha_egreso),
      })),
    perfilSalud: {
      grupoSanguineoId: id(data.perfil_salud.grupoSanguineo),
      patologiasCronicas: data.perfil_salud.patologiaCronica ?? [],
      alergias: data.perfil_salud.alergias ?? [],
      discapacidades: data.perfil_salud.discapacidad ?? [],
    },
    perfilFisico: {
      tallaCamisaId: id(data.perfil_fisico.tallaCamisa),
      tallaPantalonId: id(data.perfil_fisico.tallaPantalon),
      tallaZapatosId: id(data.perfil_fisico.tallaZapatos),
      tallaChaquetaId: id(data.perfil_fisico.tallaChaqueta),
    },
    datosVivienda: {
      estadoId: id(data.datos_vivienda.estado_id),
      municipioId: id(data.datos_vivienda.municipio_id),
      parroquiaId: id(data.datos_vivienda.parroquia),
      direccionExacta: data.datos_vivienda.direccion_exacta.trim(),
      condicionViviendaId: id(data.datos_vivienda.condicion_vivienda_id),
      codigoPostalId: id(data.datos_vivienda.codigo_postal_id),
    },
  };
}
