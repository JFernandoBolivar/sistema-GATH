import { describe, expect, it } from "vitest";
import { authCookieSecure } from "./auth-cookies";

const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;

describe("authCookieSecure", () => {
  it("sin variable: seguro solo en producción", () => {
    expect(authCookieSecure(env({ NODE_ENV: "production" }))).toBe(true);
    expect(authCookieSecure(env({ NODE_ENV: "development" }))).toBe(false);
  });

  it("AUTH_COOKIE_SECURE=false permite sesión por HTTP en producción", () => {
    expect(authCookieSecure(env({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false" }))).toBe(
      false,
    );
  });

  it("AUTH_COOKIE_SECURE=true fuerza Secure fuera de producción", () => {
    expect(authCookieSecure(env({ NODE_ENV: "development", AUTH_COOKIE_SECURE: " TRUE " }))).toBe(
      true,
    );
  });

  it("un valor desconocido cae al default seguro", () => {
    expect(authCookieSecure(env({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "quizas" }))).toBe(
      true,
    );
  });
});
