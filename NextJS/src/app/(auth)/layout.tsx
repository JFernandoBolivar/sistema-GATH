export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El fondo fotográfico queda solo en las pantallas de acceso (login y recuperación);
  // las pantallas de trabajo usan superficie plana (PLAN_REDISENO §2.1, principio 1).
  return (
    <div className="grid min-h-screen place-items-center bg-[url('/bg.jpg')] bg-cover bg-center bg-no-repeat">
      {children}
    </div>
  );
}
