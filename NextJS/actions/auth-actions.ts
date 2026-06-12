"use server";
import { registerInSchema, signInSchema } from "@/lib/zod";
import { z } from "zod";
import { signIn, signOut } from "#/auth";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";

function deleteAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.delete("dj_access");
  cookieStore.delete("dj_refresh");
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (
      c.name.startsWith("authjs.session-token") ||
      c.name.startsWith("__Secure-authjs.session-token") ||
      c.name.startsWith("next-auth.session-token") ||
      c.name.startsWith("__Secure-next-auth.session-token")
    ) {
      cookieStore.delete(c.name);
    }
  }
}

export const loginAction = async (values: z.infer<typeof signInSchema>) => {
  try {
    const loginResponse = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/login/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: values.email,
          password: values.password,
        }),
      },
    );

    if (!loginResponse.ok) {
      return { error: "Credenciales Invalidas o Usuario Bloqueado" };
    }

    const data = await loginResponse.json();
    if (data.tokens) {
      const cookieStore = await cookies();
      cookieStore.set("dj_access", data.tokens.access, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60,
        path: "/",
      });
      cookieStore.set("dj_refresh", data.tokens.refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60,
        path: "/",
      });
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      return { error: "Credenciales Invalidas o Usuario Bloqueado" };
    }

    return { success: "Login successful" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Credenciales Invalidas o Usuario Bloqueado" };
    }
    return { error: "Something went wrong" };
  }
};

export const changePasswordAction = async (
  userId: number,
  newPassword: string,
) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/cambiar-password/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, password: newPassword }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { message: errorData.message || "Error al cambiar la contraseña" };
    }

    return { success: true };
  } catch {
    return { message: "Error de conexión al cambiar la contraseña" };
  }
};

export const logoutAction = async () => {
  const cookieStore = await cookies();
  deleteAuthCookies(cookieStore);
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/logout/`,
      { method: "POST" },
    );
  } catch {
  }
  await signOut({ redirect: false });
};

export const clearAuthCookies = async () => {
  const cookieStore = await cookies();
  deleteAuthCookies(cookieStore);
  return { success: true };
};
