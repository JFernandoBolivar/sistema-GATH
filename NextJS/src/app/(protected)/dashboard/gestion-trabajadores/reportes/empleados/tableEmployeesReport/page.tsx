import { EmployeeData } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { columsReport } from "./columns";
import { DataTableReportEmployee } from "./data-table";
import { useMemo } from "react";

export default function TableEmployeeReport({
  employees,
  className,
}: {
  employees: EmployeeData[];
  className?: string;
}) {
  const safeData = useMemo(() => employees ?? [], [employees]);
  return (
    <div className={`container mx-auto py-10 ${cn(className)}`}>
      <DataTableReportEmployee columns={columsReport} data={safeData} />
    </div>
  );
}
