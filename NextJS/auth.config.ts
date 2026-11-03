/**
 * Configuración de NextAuth (Auth.js v5 beta). El provider Credentials
 * ejecuta el flujo de login contra el backend Django (F3.7).
 *
 * Flujo unificado:
 *   1. `authorize()` es el ÚNICO ejecutor HTTP (POST /api/v1/identidad/auth/login/).
 *   2. Fija cookies `dj_access` / `dj_refresh` (C-2) para que `apiClient` funcione.
 *   3. Resuelve el nombre del rol desde el catálogo para mantener la forma
 *      de la sesión compatible con el código existente (R16 legacy).
 *   4. NextAuth crea el JWT y la sesión de forma transparente.
 */
import { cookies } from "next/headers";
import { signInSchema } from "@/lib/zod";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { DJANGO_API_SERVER } from "@/shared/commons/api";
import { authCookieSecure } from "@/shared/commons/auth-cookies";

const BACKEND = DJANGO_API_SERVER;

/** D8: la contraseña inicial (la cédula) venció a los 7 días; el mensaje claro llega a la pantalla de login. */
class PasswordInicialVencida extends CredentialsSignin {
  code = "password_inicial_vencida";
}

/**
 * QA 2026-11-03: la cuenta (o el correo tecleado) está bloqueada por intentos fallidos (HTTP 429).
 * Decirlo no revela si la cuenta existe: el bloqueo también se aplica a correos inexistentes.
 */
class CuentaBloqueada extends CredentialsSignin {
  code = "cuenta_bloqueada";
}

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

interface MeData {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  rol_id: number;
  is_active: boolean;
  debe_cambiar_password: boolean;
  permisos: string[];
  rol_nombre?: string | null;
  condicion_trabajador?: string | null;
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

        if (!loginRes.ok) {
          const cuerpo = (await loginRes.json().catch(() => null)) as {
            data?: { password_inicial_vencida?: boolean; bloqueada_hasta?: string };
          } | null;
          if (cuerpo?.data?.password_inicial_vencida) throw new PasswordInicialVencida();
          if (loginRes.status === 429 && cuerpo?.data?.bloqueada_hasta) throw new CuentaBloqueada();
          throw new Error("Authentication failed");
        }

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

        // Resolver permisos y nombre del rol en paralelo: /me y /roles no
        // dependen entre sí. Si uno falla, el otro conserva su valor.
        const [me, roles] = await Promise.all([
          apiGet<MeData>("api/v1/identidad/auth/me/", tokens.access).catch(() => null),
          apiGet<RolItem[]>("api/v1/identidad/roles/", tokens.access).catch(() => [] as RolItem[]),
        ]);

        const permisos = me?.permisos || [];
        const condicionTrabajador = me?.condicion_trabajador || "SIN_ASIGNACION";
        const rol = roles.find((r) => r.id === usuario.rol_id);
        const nombreRol = rol?.nombre_rol || me?.rol_nombre || "";

        return {
          id: String(usuario.id),
          name: `${usuario.nombres} ${usuario.apellidos}`.trim(),
          role: { id: usuario.rol_id, nombre_rol: nombreRol },
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
          condicionTrabajador,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
