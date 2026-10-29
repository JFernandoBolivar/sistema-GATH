/**
 * Configuración de NextAuth (Auth.js v5 beta). El provider Credentials
 * ejecuta el flujo de login contra el backend Django (F3.7).
 *
 * Flujo unificado:
 *   1. `authorize()` es el ÚNICO ejecutor HTTP (POST /api/v1/identidad/auth/login/).
 *   2. Fija cookies `dj_access` / `dj_refresh` (C-2) para que `apiClient` funcione.
 *   3. Resuelve roles y departamentos desde catálogos para mantener la forma
 *      de la sesión compatible con el código existente (R16 legacy).
 *   4. NextAuth crea el JWT y la sesión de forma transparente.
 */
import { cookies } from "next/headers";
import { signInSchema } from "@/lib/zod";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DJANGO_API_SERVER } from "@/shared/commons/api";
import { authCookieSecure } from "@/shared/commons/auth-cookies";

const BACKEND = DJANGO_API_SERVER;

interface BackendEnvelope<T> {
  status: string;
  data: T;
  message: string;
}

interface LoginData {
  usuario: {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string;
    departamento_id: number;
    rol_id: number;
    is_active: boolean;
    debe_cambiar_password: boolean;
  };
  tokens: { access: string; refresh: string };
}

interface RolItem {
  id: number;
  nombre_rol: string;
}

interface DepartamentoItem {
  id: number;
  nombre?: string;
  nombre_departamento?: string;
}

interface MeData {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  departamento_id: number;
  rol_id: number;
  is_active: boolean;
  debe_cambiar_password: boolean;
  permisos: string[];
  rol_nombre?: string | null;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Error ${res.status} fetching ${path}`);
  const envelope = (await res.json()) as BackendEnvelope<T>;
  return envelope.data;
}

export default {
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const { data, success } = signInSchema.safeParse(credentials);
        if (!success) throw new Error("Invalid credentials.");

        const idLimpio = data.email.trim();
        const body = {
          usuario: idLimpio,
          correo: idLimpio,
          cedula: idLimpio,
          password: data.password,
        };

        const loginRes = await fetch(`${BACKEND}api/v1/identidad/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!loginRes.ok) throw new Error("Authentication failed");

        const loginEnvelope = (await loginRes.json()) as BackendEnvelope<LoginData>;
        const { usuario, tokens } = loginEnvelope.data;

        // C-2: fijar cookies HttpOnly para apiClient
        const cookieStore = await cookies();
        const secure = authCookieSecure();
        cookieStore.set("dj_access", tokens.access, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          maxAge: 15 * 60,
          path: "/",
        });
        cookieStore.set("dj_refresh", tokens.refresh, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          maxAge: 8 * 60 * 60,
          path: "/",
        });

        // Resolver permisos desde /me/
        let permisos: string[] = [];
        let nombreRolMe = "";
        try {
          const me = await apiGet<MeData>("api/v1/identidad/auth/me/", tokens.access);
          permisos = me.permisos || [];
          nombreRolMe = me.rol_nombre || "";
        } catch {
          /* permisos vacíos si /me/ falla */
        }

        // Resolver nombre_rol y nombre_departamento desde catálogos
        let nombreRol = nombreRolMe;
        let nombreDepartamento = "";
        try {
          const roles = await apiGet<RolItem[]>("api/v1/identidad/roles/", tokens.access);
          const rol = roles.find((r) => r.id === usuario.rol_id);
          nombreRol = rol?.nombre_rol || nombreRol;
        } catch {
          /* vacío */
        }
        try {
          const departamentos = await apiGet<DepartamentoItem[]>(
            "api/v1/identidad/departamentos/",
            tokens.access,
          );
          const dept = departamentos.find((d) => d.id === usuario.departamento_id);
          nombreDepartamento = dept?.nombre_departamento || dept?.nombre || "";
        } catch {
          /* vacío */
        }

        return {
          id: String(usuario.id),
          name: `${usuario.nombres} ${usuario.apellidos}`.trim(),
          role: { id: usuario.rol_id, nombre_rol: nombreRol },
          department: { id: usuario.departamento_id, nombre_departamento: nombreDepartamento },
          cedula: usuario.cedula,
          phone: usuario.telefono || "",
          email: usuario.correo || "",
          directionGeneral: { id: "", nombre: "" },
          direccionLine: null,
          coordination: null,
          dependency: { id: "", nombre: "" },
          debeCambiarPassword: usuario.debe_cambiar_password || false,
          djAccess: tokens.access,
          djRefresh: tokens.refresh,
          permisos,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
