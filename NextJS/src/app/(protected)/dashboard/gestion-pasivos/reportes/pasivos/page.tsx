import PageLayout from "../../../../../../components/layout/page-layout";
import ReportPasivo from "../../components/layout/report/report-pasivo";

export default function ReportEmployeePage() {
  return (
    <PageLayout
      title="Reporte De Pasivos"
      description="Filtre La Información de los pasivos"
    >
      <ReportPasivo />
    </PageLayout>
  );
}
