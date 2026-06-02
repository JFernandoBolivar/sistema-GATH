"use server"
import { cookies } from "next/headers";
import { auth } from "#/auth";

let refreshPromise: Promise<string | null> | null = null;

async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("dj_access")?.value;
  if (accessToken) return accessToken;

  return refreshTokens();
}

async function refreshTokens(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get("dj_refresh")?.value;
      if (!refreshToken) return null;

      const refreshResponse = await fetch(
        `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/refresh/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        },
      );

      if (!refreshResponse.ok) {
        cookieStore.delete("dj_access");
        cookieStore.delete("dj_refresh");
        return null;
      }

      const refreshData = await refreshResponse.json();

      cookieStore.set("dj_access", refreshData.tokens.access, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      });

      if (refreshData.tokens.refresh) {
        cookieStore.set("dj_refresh", refreshData.tokens.refresh, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 8 * 60 * 60,
          path: "/",
        });
      }

      return refreshData.tokens.access as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const session = await auth();
  if (!session?.user) return null;

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error("No valid session. Please log in again.");

  const requestOptions: RequestInit = {
    ...options,
    headers: { ...options?.headers, ...headers },
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.json();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) throw new Error("No valid session. Please log in again.");

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    retryOptions,
  );

  return retryResponse.json();
}

export async function apiFetchFormData<T>(
  url: string,
  formData: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error("No valid session. Please log in again.");

  const { "Content-Type": _, ...restHeaders } = headers;

  const requestOptions: RequestInit = {
    method,
    body: formData,
    headers: restHeaders,
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.json();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) throw new Error("No valid session. Please log in again.");

  const retryOptions: RequestInit = {
    method,
    body: formData,
    headers: {
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    retryOptions,
  );

  return retryResponse.json();
}

export async function apiFetchBlob(
  url: string,
  options?: RequestInit,
): Promise<globalThis.Blob> {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error("No valid session. Please log in again.");

  const requestOptions: RequestInit = {
    ...options,
    headers: { ...options?.headers, ...headers },
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.blob();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) throw new Error("No valid session. Please log in again.");

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    retryOptions,
  );

  return retryResponse.blob();
}
