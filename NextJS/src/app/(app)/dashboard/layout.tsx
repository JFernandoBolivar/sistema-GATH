/**
 * Layout del dashboard principal (restaurado de `(protected)/dashboard/layout.tsx`).
 *
 * El `SessionProvider` y el `Toaster` que tenía el layout original ya viven en
 * `src/app/(app)/layout.tsx`, que envuelve esta ruta; aquí solo se conserva el
 * contenedor visual para no duplicar proveedores ni toasts.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat">
      {children}
    </main>
  );
}
