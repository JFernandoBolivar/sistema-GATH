"use client"

import { Card } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

const turnoverData = [
  { month: "Ene", egress: 2, newHires: 8, balance: 6 },
  { month: "Feb", egress: 1, newHires: 5, balance: 4 },
  { month: "Mar", egress: 3, newHires: 12, balance: 9 },
  { month: "Abr", egress: 2, newHires: 7, balance: 5 },
  { month: "May", egress: 4, newHires: 15, balance: 11 },
  { month: "Jun", egress: 1, newHires: 6, balance: 5 },
]

export function ReportTurnover() {
  return (
    <Card className="bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Rotación de Personal</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={turnoverData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" />
          <YAxis stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend />
          <Line type="monotone" dataKey="egress" stroke="var(--destructive)" strokeWidth={2} name="Egresos" />
          <Line
            type="monotone"
            dataKey="newHires"
            stroke="var(--chart-2)"
            strokeWidth={2}
            name="Nuevas Contrataciones"
          />
          <Line type="monotone" dataKey="balance" stroke="var(--chart-1)" strokeWidth={2} name="Balance Neto" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
