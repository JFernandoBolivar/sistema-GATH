"use server"
import { cookies } from "next/headers";

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("dj_access")?.value;

  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.json();
  }

  const refreshToken = cookieStore.get("dj_refresh")?.value;
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const refreshResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/refresh/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    },
  );

  if (!refreshResponse.ok) {
    throw new Error("Session expired");
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

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${refreshData.tokens.access}`,
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
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("dj_access")?.value;

  const requestOptions: RequestInit = {
    method,
    body: formData,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.json();
  }

  const refreshToken = cookieStore.get("dj_refresh")?.value;
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const refreshResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/refresh/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    },
  );

  if (!refreshResponse.ok) {
    throw new Error("Session expired");
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

  const retryOptions: RequestInit = {
    method,
    body: formData,
    headers: {
      Authorization: `Bearer ${refreshData.tokens.access}`,
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
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("dj_access")?.value;

  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    requestOptions,
  );

  if (response.status !== 401) {
    return response.blob();
  }

  const refreshToken = cookieStore.get("dj_refresh")?.value;
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const refreshResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/refresh/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    },
  );

  if (!refreshResponse.ok) {
    throw new Error("Session expired");
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

  const retryOptions: RequestInit = {
    ...options,
    headers: {
      ...options?.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${refreshData.tokens.access}`,
    },
  };

  const retryResponse = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}${url}`,
    retryOptions,
  );

  return retryResponse.blob();
}
