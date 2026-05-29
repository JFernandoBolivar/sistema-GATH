"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Filter } from "lucide-react"
import { useState } from "react"

export function ReportFilters() {
  const [selectedPeriod, setSelectedPeriod] = useState("month")

  const periods = [
    { id: "week", label: "Última Semana" },
    { id: "month", label: "Último Mes" },
    { id: "quarter", label: "Último Trimestre" },
    { id: "year", label: "Último Año" },
  ]

  return (
    <Card className="bg-card p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Período:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {periods.map((period) => (
            <Button
              key={period.id}
              variant={selectedPeriod === period.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period.id)}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  )
}
