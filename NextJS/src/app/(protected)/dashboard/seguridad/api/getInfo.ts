"use server";
import { ApiResponse, Depart, Role, UserSystem } from "@/app/types/types";
import { apiFetchGet } from "@/lib/utils";

export const getDeparment = async () => {
  return await apiFetchGet<Depart[]>("v1/identidad/departamentos/");
};
export const getRole = async () => {
  return await apiFetchGet<Role[]>("v1/identidad/roles/");
};

export const getUserListSearch = async ({
  searchParams,
}: {
  searchParams: string | undefined;
}): Promise<ApiResponse<UserSystem[]>> => {
  if (!searchParams || searchParams === "")
    return {
      data: [],
      status: "",
      message: "",
    };
  return await apiFetchGet<UserSystem[]>(`v1/identidad/usuarios/?${searchParams}`);
};
