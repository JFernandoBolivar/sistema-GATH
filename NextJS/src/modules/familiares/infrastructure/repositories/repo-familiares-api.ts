/**
 * Implementación del repositorio de Familiares usando la API REST.
 */
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import { familiaresApi } from "../http/familiares-api";
import { catalogoFamiliarApiAEntidad, documentoFamiliarApiAEntidad, familiarApiAEntidad } from "../mappers/mapper-familiares";

function formacionAcademicaAPayload(fa: NonNullable<Parameters<RepoFamiliares["crearFamiliar"]>[0]["formacionAcademica"]>) {
  return {
    nivel_academico_id: fa.nivelAcademicoId ?? null,
    carrera_id: fa.carreraId ?? null,
    mencion_id: fa.mencionId ?? null,
    institucion_id: fa.institucionId ?? null,
  };
}

function perfilSaludAPayload(ps: NonNullable<Parameters<RepoFamiliares["crearFamiliar"]>[0]["perfilSalud"]>) {
  return {
    grupo_sanguineo_id: ps.grupoSanguineoId ?? null,
    alergias: ps.alergias ?? [],
    patologias_cronicas: ps.patologiasCronicas ?? [],
    discapacidades: ps.discapacidades ?? [],
  };
}

function perfilFisicoAPayload(pf: NonNullable<Parameters<RepoFamiliares["crearFamiliar"]>[0]["perfilFisico"]>) {
  return {
    talla_camisa_id: pf.tallaCamisaId ?? null,
    talla_pantalon_id: pf.tallaPantalonId ?? null,
    talla_zapatos_id: pf.tallaZapatosId ?? null,
    talla_chaqueta_id: pf.tallaChaquetaId ?? null,
  };
}

export const repoFamiliaresApi: RepoFamiliares = {
  async listarPorEmpleado(cedula) {
    const raw = await familiaresApi.getPorEmpleado(cedula);
    return raw.map(familiarApiAEntidad);
  },

  async obtenerPorId(id) {
    const raw = await familiaresApi.getPorId(id);
    return familiarApiAEntidad(raw);
  },

  async crearFamiliar(data) {
    const raw = await familiaresApi.crear(data.empleadoCedula, {
      cedula_familiar: data.cedulaFamiliar,
      primer_nombre: data.primerNombre,
      segundo_nombre: data.segundoNombre,
      primer_apellido: data.primerApellido,
      segundo_apellido: data.segundoApellido,
      parentesco_id: data.parentescoId,
      fecha_nacimiento: data.fechaNacimiento,
      sexo_id: data.sexoId,
      mismo_ente: data.mismoEnte,
      heredero: data.heredero,
      observaciones: data.observaciones,
      // Contrato confirmado por el coordinador (commit backend f8cbb29):
      // formacion_academica/perfil_salud/perfil_fisico son objetos únicos
      // anidados, snake_case, con sufijo _id en cada catálogo.
      ...(data.formacionAcademica ? { formacion_academica: formacionAcademicaAPayload(data.formacionAcademica) } : {}),
      ...(data.perfilSalud ? { perfil_salud: perfilSaludAPayload(data.perfilSalud) } : {}),
      ...(data.perfilFisico ? { perfil_fisico: perfilFisicoAPayload(data.perfilFisico) } : {}),
    });
    return familiarApiAEntidad(raw);
  },

  async actualizarFamiliar(id, data) {
    const payload: Record<string, unknown> = {};
    if (data.primerNombre !== undefined) payload.primer_nombre = data.primerNombre;
    if (data.segundoNombre !== undefined) payload.segundo_nombre = data.segundoNombre;
    if (data.primerApellido !== undefined) payload.primer_apellido = data.primerApellido;
    if (data.segundoApellido !== undefined) payload.segundo_apellido = data.segundoApellido;
    if (data.cedulaFamiliar !== undefined) payload.cedula_familiar = data.cedulaFamiliar;
    if (data.parentescoId !== undefined) payload.parentesco_id = data.parentescoId;
    if (data.sexoId !== undefined) payload.sexo_id = data.sexoId;
    if (data.fechaNacimiento !== undefined) payload.fecha_nacimiento = data.fechaNacimiento;
    if (data.mismoEnte !== undefined) payload.mismo_ente = data.mismoEnte;
    if (data.heredero !== undefined) payload.heredero = data.heredero;
    if (data.observaciones !== undefined) payload.observaciones = data.observaciones;
    if (data.formacionAcademica !== undefined) {
      payload.formacion_academica = data.formacionAcademica ? formacionAcademicaAPayload(data.formacionAcademica) : null;
    }
    if (data.perfilSalud !== undefined) {
      payload.perfil_salud = data.perfilSalud ? perfilSaludAPayload(data.perfilSalud) : null;
    }
    if (data.perfilFisico !== undefined) {
      payload.perfil_fisico = data.perfilFisico ? perfilFisicoAPayload(data.perfilFisico) : null;
    }

    const raw = await familiaresApi.actualizar(id, payload);
    return familiarApiAEntidad(raw);
  },

  async eliminarFamiliar(id) {
    await familiaresApi.eliminar(id);
  },

  async listarDocumentos(familiarId) {
    const raw = await familiaresApi.getDocumentos(familiarId);
    return raw.map(documentoFamiliarApiAEntidad);
  },

  async listarCatalogos() {
    const [
      parentescos,
      sexos,
      nivelesAcademicos,
      carreras,
      menciones,
      instituciones,
      gruposSanguineos,
      alergias,
      patologias,
      discapacidades,
      tiposPrenda,
      tallas,
    ] = await Promise.all([
      familiaresApi.getParentescos(),
      familiaresApi.getSexos(),
      familiaresApi.getNivelesAcademicos(),
      familiaresApi.getCarreras(),
      familiaresApi.getMenciones(),
      familiaresApi.getInstituciones(),
      familiaresApi.getGruposSanguineos(),
      familiaresApi.getAlergias(),
      familiaresApi.getPatologias(),
      familiaresApi.getDiscapacidades(),
      familiaresApi.getTiposPrenda(),
      familiaresApi.getTallas(),
    ]);
    return {
      parentescos,
      sexos,
      nivelesAcademicos: nivelesAcademicos.map(catalogoFamiliarApiAEntidad),
      carreras: carreras.map(catalogoFamiliarApiAEntidad),
      menciones: menciones.map(catalogoFamiliarApiAEntidad),
      instituciones: instituciones.map(catalogoFamiliarApiAEntidad),
      gruposSanguineos: gruposSanguineos.map(catalogoFamiliarApiAEntidad),
      alergias: alergias.map(catalogoFamiliarApiAEntidad),
      patologias: patologias.map(catalogoFamiliarApiAEntidad),
      discapacidades: discapacidades.map(catalogoFamiliarApiAEntidad),
      tiposPrenda: tiposPrenda.map(catalogoFamiliarApiAEntidad),
      tallas: tallas.map(catalogoFamiliarApiAEntidad),
    };
  },
};
