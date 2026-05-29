import CreateUbication from "../../components/dependencias/create-dependency";
import PageLayout from "../../../../../../components/layout/page-layout";

export default function Ubication() {
  return (
    <PageLayout
      title="Gestión de Ubicaciones Administrativas"
      description="Registre Nuevas Ubicaciones Administrativas Para Trabajadores"
    >
      <CreateUbication />
    </PageLayout>
  );
}
