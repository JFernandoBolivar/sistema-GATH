import PageLayout from "../../../../../components/layout/page-layout";
import { ReportDistribution } from "../components/reports/report-distribution";

export default function ReportsPage() {
  return (
    <PageLayout
      description="Análisis y métricas de recursos humanos"
      title="Reportes"
    >
      <ReportDistribution />
    </PageLayout>
  );
}
