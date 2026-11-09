"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

/**
 * Tema claro/oscuro sin desajuste de hidratación (D6).
 *
 * `next-themes` aplica la clase en un script previo a la hidratación. El
 * servidor no la conocía y React reportaba #418 en `<html>`. Ahora el layout
 * lee la cookie `gath-tema` y renderiza la misma clase desde el servidor; este
 * componente mantiene la cookie al día cuando cambia el tema.
 */
export const COOKIE_TEMA = "gath-tema";

export type Tema = "light" | "dark";

function SincronizarTemaCookie() {
  const { theme } = useTheme();
  useEffect(() => {
    if (theme !== "light" && theme !== "dark") return;
    document.cookie = `${COOKIE_TEMA}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }, [theme]);
  return null;
}

export function TemaProvider({
  children,
  temaInicial = "light",
}: Readonly<{ children: ReactNode; temaInicial?: Tema }>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={temaInicial}
      enableSystem={false}
      storageKey={COOKIE_TEMA}
      disableTransitionOnChange
    >
      <SincronizarTemaCookie />
      {children}
    </ThemeProvider>
  );
}
