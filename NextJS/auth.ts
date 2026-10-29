import NextAuth from "next-auth";
import authConfig from "#/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas (D-08 / Contrato C-2)
  },

  trustHost: true,
  ...authConfig,

  callbacks: {
    async jwt({ token, user, trigger, session: updatedSession }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
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
        session.user.department = token.department;
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
      }
      return session;
    },
  },
});
