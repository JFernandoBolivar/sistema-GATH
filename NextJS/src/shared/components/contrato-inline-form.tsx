"use client";

import { apiFetch } from "@/lib/api-client";
import { getEmployeeById, getPoliticas } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import type { Contrato, Politica } from "@/app/types/types";

interface ContratoInlineFormProps {
  employee: { id: number; cedulaidentidad: string } | undefined;
  politicas?: Politica[];
  onSuccess?: () => void;
  className?: string;
}

export function ContratoInlineForm({ employee, politicas, onSuccess, className }: ContratoInlineFormProps) {
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [hasActiveContrato, setHasActiveContrato] = useState(false);
  const [contratoData, setContratoData] = useState({
    n_contrato: "",
    politica_id: 0,
    fecha_ingreso: new Date(),
    fecha_culminacion: undefined as Date | undefined,
  });
  const [savingContrato, setSavingContrato] = useState(false);
  const [fullContrato, setFullContrato] = useState<Contrato[]>([]);

  const { data: politicasData } = useSWR(!politicas ? "politicas" : null, getPoliticas);
  const politicasList = politicas ?? politicasData?.data ?? [];

  useEffect(() => {
    if (!employee) {
      setHasActiveContrato(false);
      setShowContratoForm(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const fullEmployee = await getEmployeeById(employee.cedulaidentidad);
      if (cancelled) return;
      if (fullEmployee.data && !Array.isArray(fullEmployee.data)) {
        const contratos = fullEmployee.data.contrato ?? [];
        setFullContrato(contratos || []);
        const hasActive = contratos.some((c) => c.estatus?.estatus !== "VENCIDO");
        setHasActiveContrato(!!hasActive);
        if (!hasActive) {
          setShowContratoForm(true);
          const initials = politicasList[0]?.tipo_politica?.charAt(0)?.toUpperCase() || "C";
          const count = (contratos.length || 0) + 1;
          setContratoData((prev) => ({
            ...prev,
            n_contrato: `${initials}-${fullEmployee.data.cedulaidentidad}-${String(count).padStart(2, "0")}`,
          }));
        } else {
          setShowContratoForm(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [employee, politicasList]);

  const generateNContrato = (cedula: string, politicaId: number) => {
    const selectedPolitica = politicasList.find((p) => p.id === politicaId);
    const initials = selectedPolitica?.tipo_politica?.charAt(0)?.toUpperCase() || "C";
    const count = (fullContrato.length || 0) + 1;
    return `${initials}-${cedula}-${String(count).padStart(2, "0")}`;
  };

  const handleSaveContrato = async () => {
    if (!contratoData.politica_id) {
      toast.error("Seleccione una política");
      return;
    }
    if (!contratoData.fecha_ingreso) {
      toast.error("Seleccione fecha de ingreso");
      return;
    }
    if (!employee) return;

    setSavingContrato(true);
    try {
      const n_contrato = contratoData.n_contrato || generateNContrato(employee.cedulaidentidad, contratoData.politica_id);
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const userId = session?.user?.id;

      const payload = {
        usuario_id: Number(userId),
        contrato: [
          {
            n_contrato,
            fecha_ingreso: contratoData.fecha_ingreso.toISOString().split("T")[0],
            politica_id: contratoData.politica_id,
            fecha_culminacion: contratoData.fecha_culminacion
              ? contratoData.fecha_culminacion.toISOString().split("T")[0]
              : null,
          },
        ],
      };

      const data = await apiFetch<{ status: string; message?: string }>(`Employee/${employee.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (data.status === "success") {
        toast.success("Contrato registrado correctamente");
        setHasActiveContrato(true);
        setShowContratoForm(false);
        onSuccess?.();
      } else {
        toast.error(data.message || "Error al registrar contrato");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingContrato(false);
    }
  };

  if (!employee || !showContratoForm || hasActiveContrato) return null;

  return (
    <div className={`border-2 border-yellow-400/45 bg-yellow-100/40 p-4 rounded-sm gap-3 ${className ?? ""}`}>
      <Label className="text-lg font-bold">El trabajador no tiene contrato activo</Label>
      <p className="text-sm">Debe registrar un contrato antes de asignar el cargo.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>N° Contrato</Label>
          <Input
            placeholder="Auto-generado si se deja vacío"
            value={contratoData.n_contrato}
            onChange={(e) => setContratoData((prev) => ({ ...prev, n_contrato: e.target.value }))}
          />
        </div>
        <div>
          <Label>Tipo de Política</Label>
          <Select
            onValueChange={(v) => {
              const politicaId = Number(v);
              setContratoData((prev) => ({
                ...prev,
                politica_id: politicaId,
                n_contrato: prev.n_contrato || generateNContrato(employee.cedulaidentidad, politicaId),
              }));
            }}
            value={contratoData.politica_id ? contratoData.politica_id.toString() : ""}
          >
            <SelectTrigger className="w-full truncate">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {politicasList.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.tipo_politica}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha de Ingreso</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {contratoData.fecha_ingreso
                  ? formatInTimeZone(contratoData.fecha_ingreso, "UTC", "dd/MM/yyyy")
                  : "..."}
                <CalendarIcon className="ml-auto size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={contratoData.fecha_ingreso}
                onSelect={(d) => d && setContratoData((prev) => ({ ...prev, fecha_ingreso: d }))}
                disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label>Fecha de Culminación (opcional)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                {contratoData.fecha_culminacion
                  ? formatInTimeZone(contratoData.fecha_culminacion, "UTC", "dd/MM/yyyy")
                  : "Seleccionar..."}
                <CalendarIcon className="ml-auto size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={contratoData.fecha_culminacion}
                onSelect={(d) => d && setContratoData((prev) => ({ ...prev, fecha_culminacion: d }))}
                disabled={(d) => d < new Date("1900-01-01")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Button onClick={handleSaveContrato} disabled={savingContrato} className="w-full cursor-pointer">
        {savingContrato ? "Guardando..." : "Guardar Contrato"}
      </Button>
    </div>
  );
}
