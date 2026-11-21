import NextAuth from "next-auth";
import { encode as codificarJwt } from "next-auth/jwt";
import authConfig from "#/auth.config";
import { aSesionPublica } from "@/modules/postulacion/domain/sesion";
import { maxAgeDeSesion, sesionVencida } from "@/modules/postulacion/domain/vigencia-sesion";

const MAX_AGE_SESION = 8 * 60 * 60; // 8 horas (D-08 / Contrato C-2)

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: MAX_AGE_SESION,
  },

  jwt: {
    // D-5: la sesión del postulante nunca dura más que el token de Django (`expira_el`, ≤ 2 h);
    // la del personal conserva el `maxAge` general.
    encode: (params) =>
      codificarJwt({
        ...params,
        maxAge: maxAgeDeSesion(params.token?.postulante, params.maxAge ?? MAX_AGE_SESION, Date.now()),
      }),
  },

  trustHost: true,
  ...authConfig,

  callbacks: {
    async jwt({ token, user, trigger, session: updatedSession }) {
      // Sesión de invitado vencida: devolver null cierra la sesión (se borra la cookie).
      if (!user && token.postulante && sesionVencida(token.postulante.expiraEl, Date.now())) {
        return null;
      }
      if (user?.postulante) {
        // Postulante (rol sintético): sin permisos de empleado y sin cookies `dj_*` del personal.
        token.id = user.id;
        token.name = user.name;
        token.role = user.role;
        token.cedula = user.cedula;
        token.phone = "";
        token.permisos = [];
        token.condicionTrabajador = "SIN_ASIGNACION";
        token.debeCambiarPassword = false;
        token.postulante = user.postulante;
        return token;
      }
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.cedula = user.cedula;
        token.phone = user.phone;
        token.directionGeneral = user.directionGeneral;
        token.direccionLine = user.direccionLine;
        token.coordination = user.coordination;
        token.dependency = user.dependency;

        token.djAccess = user.djAccess;
        token.djRefresh = user.djRefresh;
        token.debeCambiarPassword = user.debeCambiarPassword || false;
        token.permisos = user.permisos || [];
        token.condicionTrabajador = user.condicionTrabajador || "SIN_ASIGNACION";
      }
      if (trigger === "update" && updatedSession) {
        if (updatedSession.debeCambiarPassword !== undefined) {
          token.debeCambiarPassword = updatedSession.debeCambiarPassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role;
        session.user.cedula = token.cedula;
        session.user.phone = token.phone;
        session.user.directionGeneral = token.directionGeneral;
        session.user.direccionLine = token.direccionLine;
        session.user.coordination = token.coordination;
        session.user.dependency = token.dependency;
        session.user.debeCambiarPassword = token.debeCambiarPassword as boolean;
        session.user.permisos = (token.permisos as string[]) || [];
        session.user.condicionTrabajador =
          (token.condicionTrabajador as string | undefined) || "SIN_ASIGNACION";
        // El token de Django NO se copia: `aSesionPublica` lo omite. Los server actions lo leen
        // del JWT cifrado (`sesion-postulante.ts`), nunca de la sesión que ve el navegador.
        if (token.postulante) {
          session.user.sesionPostulante = aSesionPublica(token.postulante);
          // La sesión del postulante vence con su token, no a las 8 h generales.
          session.expires = new Date(token.postulante.expiraEl * 1000).toISOString() as typeof session.expires;
        }
      }
      return session;
    },
  },
});
