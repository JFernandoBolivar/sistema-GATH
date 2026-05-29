"use server";
import { registerInSchema, signInSchema } from "@/lib/zod";
import { z } from "zod";
import { signIn, signOut } from "#/auth";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";

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

    await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
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
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_DJANGO_API_URL_SERVER}accounts/logout/`,
      { method: "POST" },
    );
  } catch {
    // Silenciar error de red, igual cerramos sesion local
  }
  await signOut({ redirect: false });
};
