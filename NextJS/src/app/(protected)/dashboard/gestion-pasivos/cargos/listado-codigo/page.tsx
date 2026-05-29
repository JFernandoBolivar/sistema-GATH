import PageLayout from "../../../../../../components/layout/page-layout";
import { CodeListPage } from "../../components/pasive/code-list";

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
