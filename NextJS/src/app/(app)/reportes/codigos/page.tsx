import PageLayout from "@/components/layout/page-layout";
import ReportCode from "@/modules/reportes/ui/components/report-code";

export default function ReportCodePage() {
  return (
    <PageLayout
      title="Reporte De Cargos"
      description="Filtre La Información de los Cargos"
    >
      <ReportCode />
    </PageLayout>
  );
}
