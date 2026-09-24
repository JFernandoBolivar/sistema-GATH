import PageLayout from "@/components/layout/page-layout";
import CreateDirectionDependency from "@/modules/organizacion/ui/create-direction-dependency";

/**
 * Página "Crear Direcciones" (/organizacion/crear-ubicacion-administrativa-direccion).
 * Paridad 100% con `crear-ubicacion-administrativa-direccion/page.tsx` del proyecto legado.
 */
export default function CrearUbicacionDireccionRoutePage() {
  return (
    <PageLayout title="Crear Direcciones Administrativas">
      <CreateDirectionDependency />
    </PageLayout>
  );
}
