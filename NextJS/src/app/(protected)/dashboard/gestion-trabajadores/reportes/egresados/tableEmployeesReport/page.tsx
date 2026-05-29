import { Leaving } from "@/app/types/types";
import { columnsLeavingReport } from "./columns";
import { DataTableLeaving } from "./data-table";
import { useMemo } from "react";

export default function TableReportLeaving({
  leaving,
}: {
  leaving: Leaving[];
}) {
  const safeData = useMemo(() => leaving ?? [], [leaving]);
  return (
    <div className="container mx-auto py-10">
      <DataTableLeaving columns={columnsLeavingReport} data={safeData} />
    </div>
  );
}
