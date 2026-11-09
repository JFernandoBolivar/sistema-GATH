import PageLayout from "@/components/layout/page-layout";
import { ReportDistribution } from "@/modules/reportes/ui/components/report-distribution";

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
