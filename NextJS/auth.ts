import NextAuth from "next-auth";
import authConfig from "#/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 5 * 60,
  },

  trustHost: true,
  ...authConfig,

  callbacks: {
    async jwt({ token, user }) {
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
        token.debeCambiarPassword = user.debeCambiarPassword;

        token.djAccess = (user as any).djAccess;
        token.djRefresh = (user as any).djRefresh;
        token.debeCambiarPassword = (user as any).debeCambiarPassword || false;
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
        session.user.debeCambiarPassword = token.debeCambiarPassword;
      }
      return session;
    },
  },
});
