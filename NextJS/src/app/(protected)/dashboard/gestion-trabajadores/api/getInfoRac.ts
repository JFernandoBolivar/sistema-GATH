"use server";
import {
  AcademyLevel,
  allergies,
  ApiResponse,
  BloodGroupType,
  Cargo,
  Carrera,
  Category,
  Code,
  ConditionDwelling,
  Coordination,
  Dependency,
  DirectionGeneral,
  DirectionLine,
  DisabilitysType,
  EmployeeCargoHistory,
  EmployeeData,
  EmployeeInfo,
  ErrorFetch,
  Family,
  Grado,
  MaritalStatusType,
  Mencion,
  Motion,
  Municipality,
  Nomina,
  NominaGeneral,
  OrganismosAds,
  PantsSize,
  ParentType,
  Parish,
  PatologysType,
  Politica,
  Region,
  ReportConfig,
  ReportStatus,
  ReportTypeNomina,
  ReportTypePerson,
  Sex,
  ShirtSize,
  ShoesSize,
  States,
  Status,
  TallaItem,
  TipoPrenda,
  RegionTalla,
  TipoProcedencia,
  PrestamoCargoData,
  MotivoEncargaduria,
} from "@/app/types/types";
import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { apiFetchGet } from "@/lib/utils";

export const getAcademyLevel = async (): Promise<
  ApiResponse<AcademyLevel[]>
> => {
  return await apiFetchGet<AcademyLevel[]>(`listar-nivel-academico`);
};
export const getStatus = async (): Promise<ApiResponse<Status[]>> => {
  return await apiFetchGet<Status[]>(`listar-estatus/`);
};
export const imageProfileFn = async (id: string) => {
  const profileImg = await fetch(
    `${process.env.NEXT_PUBLIC_NEST_API_URL_SERVER}read-file/profile/${id}`,
  );
  const getProfile = await profileImg.blob();
  return getProfile;
};
export const getStatusNomina = async (): Promise<ApiResponse<Status[]>> => {
  return await apiFetchGet<Status[]>(`estatus-gestion/`);
};
export const getStatusReport = async (): Promise<ApiResponse<Status[]>> => {
  return await apiFetchGet<Status[]>(`estatus/reports/`);
};
export const getStatusEmployee = async (): Promise<ApiResponse<Status[]>> => {
  return await apiFetchGet<Status[]>(`estatus/`);
};
export const getGrado = async (): Promise<ApiResponse<Grado[]>> => {
  return await apiFetchGet<Grado[]>(`listar-grado/`);
};

export const getOrganismosAds = async (): Promise<
  ApiResponse<OrganismosAds[]>
> => {
  return await apiFetchGet<OrganismosAds[]>(`organismos-adscritos/`);
};
export const getOrganismosAdsFather = async (): Promise<
  ApiResponse<OrganismosAds[]>
> => {
  return await apiFetchGet<OrganismosAds[]>(`organismos-adscritos/padre/`);
};
export const getNomina = async (): Promise<ApiResponse<Nomina[]>> => {
  return await apiFetchGet<Nomina[]>(`listar-tipo-nomina/`);
};
export const getNominaEspecial = async (): Promise<ApiResponse<Nomina[]>> => {
  return await apiFetchGet<Nomina[]>(`listar-nomina-especial/`);
};

export const getNominaPasivo = async (): Promise<ApiResponse<Nomina[]>> => {
  return await apiFetchGet<Nomina[]>(`listar-nominaPasivo/`);
};
export const getCargo = async (): Promise<ApiResponse<Cargo[]>> => {
  return await apiFetchGet<Cargo[]>(`listar-denominacion-cargo/`);
};
export const getCargoEspecifico = async (): Promise<ApiResponse<Cargo[]>> => {
  return await apiFetchGet<Cargo[]>(`listar-denominacion-cargo-especifico/`);
};
export const getStates = async (): Promise<ApiResponse<States[]>> => {
  return await apiFetchGet<States[]>(`direccion/estados/`);
};
export const getMunicipalitys = async (
  id: string,
): Promise<ApiResponse<Municipality[]>> => {
  return await apiFetchGet<Municipality[]>(`direccion/municipios/${id}/`);
};

export const getParish = async (id: string): Promise<ApiResponse<Parish[]>> => {
  return await apiFetchGet<Parish[]>(`direccion/parroquias/${id}/`);
};

export const getCodigo = async (): Promise<
  ApiResponse<Code[] | ErrorFetch>
> => {
  return await apiFetchGet<Code[]>(`listar-codigos/`);
};

export const getEmployeeById = async (
  id: string,
): Promise<ApiResponse<EmployeeData>> => {
  return await apiFetchGet<EmployeeData>(`empleados-cedula/${id}/`);
};
export const getPasiveById = async (
  id: string,
): Promise<ApiResponse<EmployeeData>> => {
  return await apiFetchGet<EmployeeData>(`employee/pasivo/${id}/`);
};
export const getEmployeeData = async (): Promise<
  ApiResponse<EmployeeData[]>
> => {
  return await apiFetchGet<EmployeeData[]>(`Employee/cargos/`);
};
export const getEmployeeDataSearch = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<EmployeeData[]>> => {
  const url = searchParams ? `Employee/cargos/?${searchParams}` : `Employee/cargos/`;
  const getEmployee = await apiFetchGet<EmployeeData[]>(url, { cache: "no-cache" });
  console.log("[getEmployeeDataSearch] first employee contrato:", JSON.stringify(getEmployee?.data?.[0]?.contrato));
  return getEmployee;
};
export const getHistoryMoveEmploye = async (
  id: string,
): Promise<ApiResponse<EmployeeCargoHistory[]>> => {
  return await apiFetchGet<EmployeeCargoHistory[]>(`EmployeeMovementHistory/${id}/`);
};

export const getCodeList = async (): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`codigos_lister/`);
};
export const getCodeListSearch = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<Code[]>> => {
  if (!searchParams || searchParams === "") {
    return {
      status: "error",
      message: "",
      data: [],
    };
  }
  return await apiFetchGet<Code[]>(`cargos/general/?${searchParams}`);
};

export const getCodeListSearchFree = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargos/vacantes/?${searchParams}`);
};
export const getReportTypePerson = async (): Promise<
  ApiResponse<ReportTypePerson[]>
> => {
  return await apiFetchGet<ReportTypePerson[]>(`reporte-personal/`);
};
export const getReportStatus = async (): Promise<
  ApiResponse<ReportStatus[]>
> => {
  return await apiFetchGet<ReportStatus[]>(`estatus/reportes/`);
};

export const getReportTypeNomina = async (): Promise<
  ApiResponse<ReportTypeNomina[]>
> => {
  return await apiFetchGet<ReportTypeNomina[]>(`tiponomina/reportes/`);
};
export const getBloodGroup = async (): Promise<
  ApiResponse<BloodGroupType[]>
> => {
  return await apiFetchGet<BloodGroupType[]>(`listar-grupoSanguineos/`);
};

export const getPatologys = async (): Promise<ApiResponse<PatologysType[]>> => {
  return await apiFetchGet<PatologysType[]>(`Patologias/`);
};

export const getDisability = async (): Promise<
  ApiResponse<DisabilitysType[]>
> => {
  return await apiFetchGet<DisabilitysType[]>(`Discapacidades/`);
};

export const getCategory = async (
  type: "discapacidad" | "alergias" | "patologias",
) => {
  return await apiFetchGet<Category[]>(`${type}/categorias`);
};
export const getAllergies = async (): Promise<ApiResponse<allergies[]>> => {
  return await apiFetchGet<allergies[]>(`alergias/`);
};
export const getShirtSize = async (): Promise<ApiResponse<ShirtSize[]>> => {
  return await apiFetchGet<ShirtSize[]>(`listar-tallasCamisas/`);
};

export const getPantsSize = async (): Promise<ApiResponse<PantsSize[]>> => {
  return await apiFetchGet<PantsSize[]>(`listar-tallaPantalones/`);
};

export const getShoesSize = async (): Promise<ApiResponse<ShoesSize[]>> => {
  return await apiFetchGet<ShoesSize[]>(`listar-tallaZapatos/`);
};

export const getTallas = async (tipoPrendaId?: number): Promise<ApiResponse<TallaItem[]>> => {
  const url = tipoPrendaId ? `listar-tallas/?tipo_prenda_id=${tipoPrendaId}` : `listar-tallas/`;
  return await apiFetchGet<TallaItem[]>(url);
};

export const getTipoPrenda = async (): Promise<ApiResponse<TipoPrenda[]>> => {
  return await apiFetchGet<TipoPrenda[]>(`listar-tipo-prenda/`);
};

export const getRegionTalla = async (): Promise<ApiResponse<RegionTalla[]>> => {
  return await apiFetchGet<RegionTalla[]>(`listar-region-talla/`);
};

export const getMaritalstatus = async (): Promise<
  ApiResponse<MaritalStatusType[]>
> => {
  return await apiFetchGet<MaritalStatusType[]>(`listar-estadoCivil/`);
};

export const getParent = async (): Promise<ApiResponse<ParentType[]>> => {
  return await apiFetchGet<ParentType[]>(`Parentesco/`);
};

export const getDirectionGeneral = async (): Promise<
  ApiResponse<DirectionGeneral[]>
> => {
  return await apiFetchGet<DirectionGeneral[]>(`listar-DireccionGeneral/`);
};

export const getDirectionLine = async (
  id: string,
): Promise<ApiResponse<DirectionLine[]>> => {
  return await apiFetchGet<DirectionLine[]>(`listar-DireccionLinea/${id}/`);
};

export const getCoordination = async (
  id: string,
): Promise<ApiResponse<Coordination[]>> => {
  return await apiFetchGet<Coordination[]>(`listar-Coordinacion/${id}/`);
};

export const getEmployeeInfo = async (
  id: string,
): Promise<ApiResponse<EmployeeInfo>> => {
  return await apiFetchGet<EmployeeInfo>(`listar-data-empleados/${id}/`);
};

export const getCodeByDirectionGeneral = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargo_DreccionGeneral/${id}/`);
};
export const getCodeByDirectionGeneralAll = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargos/Direccion_general/${id}/`);
};

export const getCodeByDirectionLine = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargo_DreccionLinea/${id}/`);
};
export const getCodeByDirectionLineAll = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargos/Direccion_linea/${id}/`);
};
export const getCodeByCoordination = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargo_coordinacion/${id}/`);
};
export const getCodeByCoordinationAll = async (
  id: string,
): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargos/coordinacion/${id}/`);
};
export const getCarrera = async (nivelAcademicoId?: number): Promise<ApiResponse<Carrera[]>> => {
  const url = nivelAcademicoId ? `carreras/${nivelAcademicoId}/` : `carreras/`;
  return await apiFetchGet<Carrera[]>(url);
};

export const createCarrera = async (
  nombre_carrera: string,
  nivel_academico_id: number,
): Promise<ApiResponse<{ id: number; nombre_carrera: string }>> => {
  return await apiFetch(`carreras/create/`, {
    method: "POST",
    body: JSON.stringify({ nombre_carrera, nivel_academico_id }),
  });
};

export const createInstitucion = async (
  nombre_institucion: string,
): Promise<ApiResponse<{ id: number; nombre_institucion: string }>> => {
  return await apiFetch(`institucion/`, {
    method: "POST",
    body: JSON.stringify({ nombre_institucion }),
  });
};

export const createMencion = async (
  nombre_mencion: string,
  carrera_id: number,
): Promise<ApiResponse<{ id: number; nombre_mencion: string }[]>> => {
  return await apiFetch(`menciones/create/`, {
    method: "POST",
    body: JSON.stringify([{ nombre_mencion, carrera_id }]),
  });
};

export const createCapacitacion = async (
  nombre_capacitacion: string,
): Promise<ApiResponse<{ id: number; nombre_capacitacion: string }>> => {
  return await apiFetch(`capacitacion/`, {
    method: "POST",
    body: JSON.stringify({ nombre_capacitacion }),
  });
};

export const createOrganismoAdscrito = async (
  nombre: string,
): Promise<ApiResponse<{ id: number; Organismoadscrito: string }>> => {
  return await apiFetch(`OrganismoAdscrito/`, {
    method: "POST",
    body: JSON.stringify({ Organismoadscrito: nombre }),
  });
};

export const getMencion = async (
  id: string,
): Promise<ApiResponse<Mencion[]>> => {
  return await apiFetchGet<Mencion[]>(`Menciones/${id}/`);
};
export const getConditionDwelling = async (): Promise<
  ApiResponse<ConditionDwelling[]>
> => {
  return await apiFetchGet<ConditionDwelling[]>(`condicion_vivienda/`);
};

export const getSex = async (): Promise<ApiResponse<Sex[]>> => {
  return await apiFetchGet<Sex[]>(`listar-sexo/`);
};

export const getPoliticas = async (): Promise<ApiResponse<Politica[]>> => {
  return await apiFetchGet<Politica[]>(`listar-politicas/`);
};

export const getReasonLeaving = async (): Promise<ApiResponse<Motion[]>> => {
  return await apiFetchGet<Motion[]>(`motivos/egreso/`);
};
export const getReasonLeavingPasive = async (): Promise<
  ApiResponse<Motion[]>
> => {
  return await apiFetchGet<Motion[]>(`motivos/egreso/fallecimineto/`);
};
export const getInternalReason = async (): Promise<ApiResponse<Motion[]>> => {
  return await apiFetchGet<Motion[]>(`motivos/estatus/`);
};
export const getMotionReason = async (): Promise<ApiResponse<Motion[]>> => {
  return await apiFetchGet<Motion[]>(`motivos/movimiento/`);
};
export const getReportConfigEmployee = async (): Promise<
  ApiResponse<ReportConfig>
> => {
  return await apiFetchGet<ReportConfig>(`employee/reports/config/`);
};
export const getReportConfigFamily = async (): Promise<
  ApiResponse<ReportConfig>
> => {
  return await apiFetchGet<ReportConfig>(`family/reports/config/`);
};
export const getReportConfigLeaving = async (): Promise<
  ApiResponse<ReportConfig>
> => {
  return await apiFetchGet<ReportConfig>(`graduate/reports/config/`);
};

export const getNominaGeneral = async (): Promise<
  ApiResponse<NominaGeneral[]>
> => {
  return await apiFetchGet<NominaGeneral[]>(`nomina/general/`);
};
export const getDependency = async (): Promise<ApiResponse<Dependency[]>> => {
  return await apiFetchGet<Dependency[]>(`dependencias/`);
};

export const postReport = async <T>(values: T): Promise<globalThis.Blob> => {
  return await apiFetchBlob(`reports/pdf/`, {
    method: "POST",
    body: JSON.stringify(values),
  });
};
export const postReportPasivo = async <T>(
  values: T,
): Promise<globalThis.Blob> => {
  return await apiFetchBlob(`reports/pasivo/`, {
    method: "POST",
    body: JSON.stringify(values),
  });
};
export const getRegion = async (): Promise<ApiResponse<Region[]>> => {
  return await apiFetchGet<Region[]>(`direccion/regiones/`);
};

export const getStateByRegion = async (
  id: number,
): Promise<ApiResponse<States[]>> => {
  return await apiFetchGet<States[]>(`direccion/estado/${id}/`);
};

export const getDirectionGeneralById = async (
  id: number | string,
): Promise<ApiResponse<DirectionGeneral[]>> => {
  return await apiFetchGet<DirectionGeneral[]>(`direccionGeneral/${id}/`);
};

export const getCapacitaciones = async (): Promise<
  ApiResponse<{ id: number; nombre_capacitacion: string }[]>
> => {
  return await apiFetchGet<{ id: number; nombre_capacitacion: string }[]>(`capacitaciones/`);
};

export const getGruposCapacitacion = async (): Promise<
  ApiResponse<{ id: number; nombre_grupo: string }[]>
> => {
  return await apiFetchGet<{ id: number; nombre_grupo: string }[]>(`grupos-capacitacion/`);
};

export const getInstituciones = async (): Promise<
  ApiResponse<{ id: number; nombre_institucion: string }[]>
> => {
  return await apiFetchGet<{ id: number; nombre_institucion: string }[]>(`instituciones/`);
};

export const getTiposProcedencia = async (): Promise<
  ApiResponse<TipoProcedencia[]>
> => {
  return await apiFetchGet<TipoProcedencia[]>(`tiposProcedencia/`);
};
export const getFamilyEmployee = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<Family[]>> => {
  const url = searchParams
    ? `Employeefamily/?${searchParams}`
    : `Employeefamily/`;
  return await apiFetchGet<Family[]>(url);
};

export const getFamilyDocuments = async (
  familyId: number,
): Promise<ApiResponse<{ id: number; document_type: string; file: string; uploaded_at: string }[]>> => {
  return await apiFetchGet(`Employeefamily/${familyId}/documentos/list/`);
};

export const getMotivosEncargaduria = async (): Promise<
  ApiResponse<MotivoEncargaduria[]>
> => {
  return await apiFetchGet<MotivoEncargaduria[]>(`motivos/encargaduria/`);
};

export const createMotivoEncargaduria = async (
  movimiento: string,
): Promise<ApiResponse<MotivoEncargaduria>> => {
  return await apiFetch(`motivos/encargaduria/create/`, {
    method: "POST",
    body: JSON.stringify({ movimiento }),
  });
};

export const createPrestamoCargoFn = async (data: {
  empleado_encargado: string;
  cargo_encargado: number;
  motivo: number;
  fecha_inicio: string;
  fecha_fin: string;
  ejecutado_por: number;
}): Promise<ApiResponse<PrestamoCargoData>> => {
  return await apiFetch(`prestamo-cargo/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updatePrestamoCargoFn = async (
  id: number,
  data: { fecha_fin?: string; motivo?: number },
): Promise<ApiResponse<PrestamoCargoData>> => {
  return await apiFetch(`prestamo-cargo/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const getPrestamosCargo = async (params?: {
  cargo_id?: number;
  empleado?: string;
  activo?: boolean;
}): Promise<ApiResponse<PrestamoCargoData[]>> => {
  const searchParams = new URLSearchParams();
  if (params?.cargo_id) searchParams.set("cargo_id", params.cargo_id.toString());
  if (params?.empleado) searchParams.set("empleado", params.empleado);
  if (params?.activo) searchParams.set("activo", "true");
  const query = searchParams.toString();
  const url = `prestamo-cargo/list/${query ? `?${query}` : ""}`;
  return await apiFetchGet<PrestamoCargoData[]>(url);
};
