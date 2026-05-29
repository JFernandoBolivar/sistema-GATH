import { CreateFamilyForm } from "../../../components/employees/crear-familiar";
import PageLayout from "../../../../../../../components/layout/page-layout";

export default function CreateFamilyPage() {
  return (
    <PageLayout
      title="Agregar Familiar"
      description="Registre los familiares del empleado"
    >
      <CreateFamilyForm />
    </PageLayout>
  );
}
