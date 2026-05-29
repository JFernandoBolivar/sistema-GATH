import PageLayout from "../../../../../../../components/layout/page-layout";
import { CreateFamilyPasiveForm } from "../../../components/pasive/crear-familiar";

export default function CreateFamilyPage() {
  return (
    <PageLayout
      title="Agregar Familiar"
      description="Registre los familiares del personal pasivo/jubilado"
    >
      <CreateFamilyPasiveForm />
    </PageLayout>
  );
}
