import { columns } from "./columns";
import { DataTable } from "./data-table";
import { EmployeeData } from "@/app/types/types";
export default function TableEmployee({
  employeeData,
}: {
  employeeData: EmployeeData[];
}) {
  return (
    <div>
      <DataTable columns={columns} data={employeeData || []} />
    </div>
  );
}
