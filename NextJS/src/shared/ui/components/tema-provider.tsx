"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/** Tema claro por defecto; respeta `prefers-color-scheme` y permite alternar (clase `dark`). */
export function TemaProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
