"use client";
import { Family } from "@/app/types/types";
import { columnsFamily } from "./columns";
import { DataTableFamily } from "./data-table";
import { useMemo } from "react";

export default function TableFamily({ familys }: { familys: Family[] }) {
  return (
    <div
      className="container mx-a
    uto py-10"
    >
      <DataTableFamily columns={columnsFamily} data={familys} />
    </div>
  );
}
