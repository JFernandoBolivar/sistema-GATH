import PageLayout from "@/components/layout/page-layout";
import CreateDependency from "@/modules/organizacion/ui/create-dependency";

/**
 * Página "Crear Ub. Administrativa" (/organizacion/crear-ubicacion).
 * Paridad 100% con `crear-ubicacion/page.tsx` del proyecto legado.
 */
export default function CrearUbicacionRoutePage() {
  return (
    <PageLayout
      title="Gestión de Ubicaciones Administrativas"
      description="Registre Nuevas Ubicaciones Administrativas Para Trabajadores"
    >
      <CreateDependency />
    </PageLayout>
  );
}
