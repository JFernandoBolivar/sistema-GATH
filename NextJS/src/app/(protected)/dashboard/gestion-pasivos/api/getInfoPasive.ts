"use server";
import { apiFetchGet } from "@/lib/utils";
import { apiFetchBlob } from "@/lib/api-client";
import { ApiResponse, Code, Family, Motion } from "./../../../../types/types";

export const getPasiveSearch = async <T>({
  searchParams,
}: {
  searchParams: string;
}) => {
  const url = searchParams ? `employee/pasivo/?${searchParams}` : `employee/pasivo/`;
  return await apiFetchGet<T>(url);
};

export const getCodeListPasiveSearch = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<Code[]>> => {
  return await apiFetchGet<Code[]>(`cargos/pasivo/?${searchParams}`);
};
export const getInternalReasonPasive = async (): Promise<
  ApiResponse<Motion[]>
> => {
  return await apiFetchGet<Motion[]>("motivos/estatus/pasivos/");
};
export const getFamilyPasive = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<Family[]>> => {
  const url = searchParams
    ? `Passivefamily/?${searchParams}`
    : `Passivefamily/`;
  return await apiFetchGet<Family[]>(url);
};

export const getFamilyPasiveOne = async (id: number) => {
  return await apiFetchGet<Family[]>(`Passivefamily/${id}`);
};

export const getExcel = async () => {
  return await apiFetchBlob(`reportes/excel/`);
};
