import { RolesPermisosPage } from "@/modules/identidad/ui/roles-permisos-page";

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; rol?: string }>;
}) {
  const params = await searchParams;
  return (
    <RolesPermisosPage
      pestanaInicial={params.tab === "matriz" ? "matriz" : "roles"}
      rolInicial={params.rol ? Number(params.rol) : undefined}
    />
  );
}
