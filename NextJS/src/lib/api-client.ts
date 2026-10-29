"use server";
import { cookies } from "next/headers";
import { auth } from "#/auth";
import { AuthSessionExpiredError } from "./auth-errors";
import { cache } from "react";
import { DJANGO_API_SERVER } from "@/shared/commons/api";
import { authCookieSecure } from "@/shared/commons/auth-cookies";

const AUTH_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

function deleteAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const secure = authCookieSecure();
  cookieStore.set("dj_access", "", {
    maxAge: 0,
    path: "/",
    secure,
    httpOnly: true,
    sameSite: "lax",
  });
  cookieStore.set("dj_refresh", "", {
    maxAge: 0,
    path: "/",
    secure,
    httpOnly: true,
    sameSite: "lax",
  });
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => c.name.startsWith(prefix))) {
      cookieStore.set(c.name, "", {
        maxAge: 0,
        path: "/",
        secure: secure || c.name.startsWith("__Secure-"),
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }
}

async function throwAuthExpired(): Promise<never> {
  const cookieStore = await cookies();
  deleteAuthCookies(cookieStore);
  throw new AuthSessionExpiredError();
}

const executeRefresh = cache(async (refreshToken: string): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    const refreshResponse = await fetch(`${DJANGO_API_SERVER}api/v1/identidad/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!refreshResponse.ok) {
      deleteAuthCookies(cookieStore);
      return null;
    }

    const refreshData = await refreshResponse.json();
    const tokenPayload = refreshData?.data?.tokens || refreshData?.tokens;
    if (!tokenPayload?.access) {
      deleteAuthCookies(cookieStore);
      return null;
    }

    cookieStore.set("dj_access", tokenPayload.access, {
      httpOnly: true,
      secure: authCookieSecure(),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    if (tokenPayload.refresh) {
      cookieStore.set("dj_refresh", tokenPayload.refresh, {
        httpOnly: true,
        secure: authCookieSecure(),
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
        path: "/",
      });
    }

    return tokenPayload.access as string;
  } catch {
    return null;
  }
});

export async function ensureValidAccessToken(): Promise<boolean> {
  const token = await getValidAccessToken();
  return token !== null;
}

async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("dj_access")?.value;
  if (accessToken) return accessToken;

  return refreshTokens();
}

export async function refreshTokens(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("dj_refresh")?.value;
  if (!refreshToken) return null;

  return executeRefresh(refreshToken);
}

export const refreshAccessToken = refreshTokens;

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const session = await auth();
  if (!session?.user) return null;

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

function buildApiUrl(url: string): string {
  const cleanUrl = url.startsWith("/") ? url.slice(1) : url;
  return `${DJANGO_API_SERVER}${cleanUrl}`;
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers) await throwAuthExpired();

  const requestOptions: RequestInit = {
    ...options,
    headers: { ...options?.headers, ...headers },
  };

  const response = await fetch(buildApiUrl(url), requestOptions);

  if (response.status !== 401) {
    return response.json();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) await throwAuthExpired();

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(buildApiUrl(url), retryOptions);

  return retryResponse.json();
}

export async function apiFetchFormData<T>(
  url: string,
  formData: FormData,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  const headers = await getAuthHeaders();
  if (!headers) await throwAuthExpired();

  const { "Content-Type": _, ...restHeaders } = headers!;

  const requestOptions: RequestInit = {
    method,
    body: formData,
    headers: restHeaders,
  };

  const response = await fetch(buildApiUrl(url), requestOptions);

  if (response.status !== 401) {
    return response.json();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) await throwAuthExpired();

  const retryOptions: RequestInit = {
    method,
    body: formData,
    headers: {
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(buildApiUrl(url), retryOptions);

  return retryResponse.json();
}

export async function apiFetchBlob(url: string, options?: RequestInit): Promise<globalThis.Blob> {
  const headers = await getAuthHeaders();
  if (!headers) await throwAuthExpired();

  const requestOptions: RequestInit = {
    ...options,
    headers: { ...options?.headers, ...headers },
  };

  const response = await fetch(buildApiUrl(url), requestOptions);

  if (response.status !== 401) {
    return response.blob();
  }

  const newAccessToken = await refreshTokens();
  if (!newAccessToken) await throwAuthExpired();

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${newAccessToken}`,
    },
  };

  const retryResponse = await fetch(buildApiUrl(url), retryOptions);

  return retryResponse.blob();
}
