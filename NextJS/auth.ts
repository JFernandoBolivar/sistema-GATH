import NextAuth from "next-auth";
import authConfig from "#/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 10 * 60 * 60,
  },

  trustHost: true,
  ...authConfig,
});
