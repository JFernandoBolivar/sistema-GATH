import { CodeListPage } from "../../components/employees/code-list";
import PageLayout from "../../../../../../components/layout/page-layout";

export default function AsignarCodigoPage() {
  return (
    <PageLayout
      description="Información General y Detalles De los codigos"
      title="Listado De Codigos"
    >
      <CodeListPage />
    </PageLayout>
  );
}
