import PageLayout from "../../../../../../components/layout/page-layout";
import ReportEmployee from "../../components/reports/report-employees";

export default function ReportEmployeePage() {
  return (
    <PageLayout
      title="Reporte De Trabajadores"
      description="Filtre La Información de los trabajadores"
    >
      <ReportEmployee />
    </PageLayout>
  );
}
