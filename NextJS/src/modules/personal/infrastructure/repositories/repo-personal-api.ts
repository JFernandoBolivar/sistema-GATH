/**
 * Implementación del repositorio de Personal usando la API REST.
 *
 * Convierte el expediente anidado (camelCase, DTO/dominio) al contrato plano
 * de escritura del backend (`empleado_escritura_serializers.py`): los campos
 * FK se envían como ids con los nombres que espera cada Write serializer
 * (`estado`, `municipio`, `parroquia`, `tallaCamisa`, `grupo_sanguineo`, ...).
 */
import type { GuardarEmpleadoDatos, RepoPersonal } from "../../domain/ports/repo-personal";
import type {
  Antecedente,
  ContactoEmergencia,
  Contrato,
  DatosVivienda,
  FormacionAcademica,
  FormacionComplementaria,
  PerfilFisico,
  PerfilSalud,
} from "../../domain/entities/empleado";
import { personalApi } from "../http/personal-api";
import { empleadoApiAEntidad } from "../mappers/mapper-personal";
function viviendaAPI(v: DatosVivienda | null | undefined): Record<string, unknown> | null {
  if (!v) return null;
  const out: Record<string, unknown> = {};
  if (v.estadoId !== undefined) out.estado = v.estadoId;
  if (v.municipioId !== undefined) out.municipio = v.municipioId;
  if (v.parroquiaId !== undefined) out.parroquia = v.parroquiaId;
  if (v.direccionExacta !== undefined) out.direccion_exacta = v.direccionExacta;
  if (v.condicionViviendaId !== undefined) out.condicion_vivienda = v.condicionViviendaId;
  if (v.codigoPostalId !== undefined) out.codigo_postal = v.codigoPostalId;
  return Object.keys(out).length ? out : null;
}

function saludAPI(v: PerfilSalud | null | undefined): Record<string, unknown> | null {
  if (!v) return null;
  const out: Record<string, unknown> = {};
  if (v.grupoSanguineoId !== undefined) out.grupo_sanguineo = v.grupoSanguineoId;
  if (v.alergias !== undefined) out.alergias = v.alergias;
  if (v.patologiasCronicas !== undefined) out.patologiaCronica = v.patologiasCronicas;
  if (v.discapacidades !== undefined) out.discapacidad = v.discapacidades;
  return Object.keys(out).length ? out : null;
}

function fisicoAPI(v: PerfilFisico | null | undefined): Record<string, unknown> | null {
  if (!v) return null;
  const out: Record<string, unknown> = {};
  if (v.tallaCamisaId !== undefined) out.tallaCamisa = v.tallaCamisaId;
  if (v.tallaPantalonId !== undefined) out.tallaPantalon = v.tallaPantalonId;
  if (v.tallaZapatosId !== undefined) out.tallaZapatos = v.tallaZapatosId;
  if (v.tallaChaquetaId !== undefined) out.tallaChaqueta = v.tallaChaquetaId;
  return Object.keys(out).length ? out : null;
}

function academicoAPI(item: FormacionAcademica): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (item.nivelAcademicoId !== undefined) out.nivel_academico = item.nivelAcademicoId;
  if (item.carreraId !== undefined) out.carrera = item.carreraId;
  if (item.mencionId !== undefined) out.mencion = item.mencionId;
  if (item.institucionId !== undefined) out.institucion = item.institucionId;
  return out;
}

function academicoListAPI(list: FormacionAcademica[] | undefined): Record<string, unknown>[] | null {
  if (!list || list.length === 0) return null;
  return list.map(academicoAPI);
}

function complementariaAPI(item: FormacionComplementaria): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (item.capacitacionId !== undefined) out.capacitacion = item.capacitacionId;
  if (item.institucionId !== undefined) out.institucion = item.institucionId;
  if (item.fechaInicio !== undefined) out.fechaInicio = item.fechaInicio;
  if (item.fechaFin !== undefined) out.fechaFin = item.fechaFin;
  if (item.diasCompletados !== undefined) out.dias_completados = item.diasCompletados;
  if (item.horasCompletadas !== undefined) out.horas_completadas = item.horasCompletadas;
  if (item.procedenciaId !== undefined) out.procedencia = item.procedenciaId;
  if (item.grupoId !== undefined) out.grupo = item.grupoId;
  return out;
}

function complementariaListAPI(list: FormacionComplementaria[] | undefined): Record<string, unknown>[] | null {
  if (!list || list.length === 0) return null;
  return list.map(complementariaAPI);
}

function contactoAPI(item: ContactoEmergencia): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (item.nombres !== undefined) out.nombres = item.nombres;
  if (item.apellidos !== undefined) out.apellidos = item.apellidos;
  if (item.telefono !== undefined) out.telefono = item.telefono;
  if (item.relacionId !== undefined) out.relacion = item.relacionId;
  return out;
}

function contactoListAPI(list: ContactoEmergencia[] | undefined): Record<string, unknown>[] | null {
  if (!list || list.length === 0) return null;
  return list.map(contactoAPI);
}

function antecedenteAPI(item: Antecedente): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (item.organismoId !== undefined) out.organismo = item.organismoId;
  if (item.fechaIngreso !== undefined) out.fecha_ingreso = item.fechaIngreso;
  if (item.fechaEgreso !== undefined) out.fecha_egreso = item.fechaEgreso;
  return out;
}

function antecedenteListAPI(list: Antecedente[] | undefined): Record<string, unknown>[] | null {
  if (!list || list.length === 0) return null;
  return list.map(antecedenteAPI);
}

function contratoAPI(item: Contrato): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (item.nContrato !== undefined) out.n_contrato = item.nContrato;
  if (item.fechaIngreso !== undefined) out.fecha_ingreso = item.fechaIngreso;
  if (item.fechaCulminacion !== undefined) out.fecha_culminacion = item.fechaCulminacion;
  if (item.politicaId !== undefined) out.politica_id = item.politicaId;
  return out;
}

function contratoListAPI(list: Contrato[] | undefined): Record<string, unknown>[] | null {
  if (!list || list.length === 0) return null;
  return list.map(contratoAPI);
}

function aplicarAnidados(payload: Record<string, unknown>, data: GuardarEmpleadoDatos): void {
  const vivienda = viviendaAPI(data.datosVivienda);
  if (vivienda) payload.datos_vivienda = vivienda;
  const salud = saludAPI(data.perfilSalud);
  if (salud) payload.perfil_salud = salud;
  const fisico = fisicoAPI(data.perfilFisico);
  if (fisico) payload.perfil_fisico = fisico;
  const academico = academicoListAPI(data.formacionAcademica);
  if (academico) payload.formacion_academica = academico;
  const complementaria = complementariaListAPI(data.formacionComplementaria);
  if (complementaria) payload.formacion_complementaria = complementaria;
  const contacto = contactoListAPI(data.contactoEmergencia);
  if (contacto) payload.contacto_emergencia = contacto;
  const antecedentes = antecedenteListAPI(data.antecedentes);
  if (antecedentes) payload.antecedentes = antecedentes;
  const contrato = contratoListAPI(data.contrato);
  if (contrato) payload.contrato = contrato;
}

export const repoPersonalApi: RepoPersonal = {
  async listarEmpleados(filtros) {
    const term = filtros?.busqueda || filtros?.cedulaidentidad;
    const raw = await personalApi.getEmpleados({
      q: term,
      busqueda: term,
      codigo: filtros?.codigo,
      tipo_nomina: filtros?.tipo_nomina,
    });
    return raw.map(empleadoApiAEntidad);
  },

  async obtenerPorCedula(cedula) {
    const raw = await personalApi.getPorCedula(cedula);
    return empleadoApiAEntidad(raw);
  },

  async crearEmpleado(data) {
    const payload: Record<string, unknown> = {
      cedula: data.cedula,
      nombres: data.nombres,
      apellidos: data.apellidos,
      sexo_id: data.sexoId,
      fecha_nacimiento: data.fechaNacimiento,
      correo: data.correo ?? null,
      telefono_movil: data.telefonoMovil ?? null,
      telefono_habitacion: data.telefonoHabitacion ?? null,
      estado_civil_id: data.estadoCivilId ?? null,
      carnet_patria: data.carnetPatria ?? null,
    };
    aplicarAnidados(payload, data);
    const raw = await personalApi.crear(payload);
    return empleadoApiAEntidad(raw);
  },

  async actualizarEmpleado(cedula, data) {
    const payload: Record<string, unknown> = {};
    if (data.nombres !== undefined) payload.nombres = data.nombres;
    if (data.apellidos !== undefined) payload.apellidos = data.apellidos;
    if (data.sexoId !== undefined) payload.sexo_id = data.sexoId;
    if (data.fechaNacimiento !== undefined) payload.fecha_nacimiento = data.fechaNacimiento;
    if (data.correo !== undefined) payload.correo = data.correo;
    if (data.telefonoMovil !== undefined) payload.telefono_movil = data.telefonoMovil;
    if (data.telefonoHabitacion !== undefined) payload.telefono_habitacion = data.telefonoHabitacion;
    if (data.estadoCivilId !== undefined) payload.estado_civil_id = data.estadoCivilId;
    if (data.carnetPatria !== undefined) payload.carnet_patria = data.carnetPatria;
    aplicarAnidados(payload, data as GuardarEmpleadoDatos);

    const raw = await personalApi.actualizar(cedula, payload);
    return empleadoApiAEntidad(raw);
  },

  async listarCatalogosExpediente() {
    const [
      estados,
      municipios,
      parroquias,
      condicionesVivienda,
      codigosPostales,
      gruposSanguineos,
      nivelesAcademicos,
      carreras,
      menciones,
      instituciones,
      capacitaciones,
      gruposCapacitacion,
      tiposProcedencia,
      tiposPrenda,
      tallas,
      politicas,
      alergias,
      patologias,
      discapacidades,
    ] = await Promise.all([
      personalApi.getEstados(),
      personalApi.getMunicipios(),
      personalApi.getParroquias(),
      personalApi.getCondicionesVivienda(),
      personalApi.getCodigosPostales(),
      personalApi.getGruposSanguineos(),
      personalApi.getNivelesAcademicos(),
      personalApi.getCarreras(),
      personalApi.getMenciones(),
      personalApi.getInstituciones(),
      personalApi.getCapacitaciones(),
      personalApi.getGruposCapacitacion(),
      personalApi.getTiposProcedencia(),
      personalApi.getTiposPrenda(),
      personalApi.getTallas(),
      personalApi.getPoliticas(),
      personalApi.getAlergias(),
      personalApi.getPatologias(),
      personalApi.getDiscapacidades(),
    ]);
    const aCat = (raw: { id: number; nombre: string }[]) => raw.map((x) => ({ id: x.id, nombre: x.nombre }));
    return {
      estados: aCat(estados),
      municipios: aCat(municipios),
      parroquias: aCat(parroquias),
      condicionesVivienda: aCat(condicionesVivienda),
      codigosPostales: aCat(codigosPostales),
      gruposSanguineos: aCat(gruposSanguineos),
      nivelesAcademicos: aCat(nivelesAcademicos),
      carreras: aCat(carreras),
      menciones: aCat(menciones),
      instituciones: aCat(instituciones),
      capacitaciones: aCat(capacitaciones),
      gruposCapacitacion: aCat(gruposCapacitacion),
      tiposProcedencia: aCat(tiposProcedencia),
      tiposPrenda: aCat(tiposPrenda),
      tallas: aCat(tallas),
      politicas: aCat(politicas),
      alergias: aCat(alergias),
      patologias: aCat(patologias),
      discapacidades: aCat(discapacidades),
    };
  },
};
