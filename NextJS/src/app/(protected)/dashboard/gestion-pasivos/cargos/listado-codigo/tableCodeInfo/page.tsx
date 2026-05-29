"use client";
import { Code } from "@/app/types/types";
import { columnsCode } from "./columns";
import { DataTableCodeInfo } from "./data-table";
import { useMemo } from "react";

export default function TableCode({ codeList }: { codeList: Code[] }) {
  const safeData = useMemo(() => codeList ?? [], [codeList]);
  return (
    <div>
      <DataTableCodeInfo columns={columnsCode} data={safeData} />
    </div>
  );
}
