"use client";

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
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import type { Contrato } from "@/app/types/types";
import {
  getEmpleadoPorCedulaAction,
  actualizarEmpleadoAction,
} from "@/modules/personal/infrastructure/actions/personal-actions";
import { getPoliticasAction } from "@/modules/catalogos/infrastructure/actions/catalogos-actions";

export interface ContratoInlineEmployee {
  id?: number;
  cedulaidentidad?: string;
  cedula?: string;
  contrato?: Contrato[];
  contratoActual?: {
    id?: number;
    nContrato?: string | null;
    estatusNombre?: string | null;
    fechaIngreso?: string | null;
    fechaCulminacion?: string | null;
    politicaId?: number | null;
    politicaNombre?: string | null;
    estatusId?: number | null;
    esFijo?: boolean;
  } | null;
}

export interface PoliticaOption {
  id: number;
  tipo_politica?: string;
  nombre?: string;
}

interface ContratoInlineFormProps {
  employee: ContratoInlineEmployee | undefined;
  politicas?: PoliticaOption[];
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
  const [internalPoliticas, setInternalPoliticas] = useState<PoliticaOption[]>([]);

  useEffect(() => {
    if (politicas && politicas.length > 0) return;
    let active = true;
    getPoliticasAction()
      .then((data) => {
        if (active && Array.isArray(data)) {
          setInternalPoliticas(
            data.map((p) => ({
              id: p.id,
              tipo_politica: p.nombre,
              nombre: p.nombre,
            }))
          );
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [politicas]);

  const politicasList = useMemo(() => {
    return politicas && politicas.length > 0 ? politicas : internalPoliticas;
  }, [politicas, internalPoliticas]);

  const cedula = employee?.cedulaidentidad || employee?.cedula || "";

  useEffect(() => {
    if (!employee || !cedula) {
      setHasActiveContrato(false);
      setShowContratoForm(false);
      return;
    }

    if (employee.contratoActual) {
      const estatus = employee.contratoActual.estatusNombre || "";
      const isActivo = estatus !== "VENCIDO" && estatus !== "CULMINADO";
      if (isActivo) {
        setHasActiveContrato(true);
        setShowContratoForm(false);
        onSuccess?.();
        return;
      }
    }

    if (Array.isArray(employee.contrato) && employee.contrato.length > 0) {
      const hasActive = employee.contrato.some((c: any) => {
        const est = c?.estatus?.estatus || c?.estatusNombre || c?.estatus_nombre || "";
        return est !== "VENCIDO" && est !== "CULMINADO";
      });
      if (hasActive) {
        setHasActiveContrato(true);
        setShowContratoForm(false);
        onSuccess?.();
        return;
      }
    }

    let cancelled = false;
    (async () => {
      const fullEmployee = await getEmpleadoPorCedulaAction(cedula);
      if (cancelled) return;
      if (fullEmployee && "cedula" in fullEmployee) {
        const contratos = (fullEmployee.contratos ?? (fullEmployee.contratoActual ? [fullEmployee.contratoActual] : [])) as unknown as Contrato[];
        setFullContrato(contratos || []);
        const hasActive =
          (fullEmployee.contratoActual &&
            fullEmployee.contratoActual.estatusNombre !== "VENCIDO" &&
            fullEmployee.contratoActual.estatusNombre !== "CULMINADO") ||
          contratos.some((c: any) => {
            const est = c?.estatus?.estatus || c?.estatusNombre || c?.estatus_nombre || "";
            return est !== "VENCIDO" && est !== "CULMINADO";
          });
        setHasActiveContrato(!!hasActive);
        if (!hasActive) {
          setShowContratoForm(true);
          const firstPolitica = politicasList[0];
          const initials =
            (firstPolitica?.tipo_politica || firstPolitica?.nombre)?.charAt(0)?.toUpperCase() || "C";
          const count = (contratos.length || 0) + 1;
          setContratoData((prev) => ({
            ...prev,
            n_contrato: `${initials}-${cedula}-${String(count).padStart(2, "0")}`,
          }));
        } else {
          setShowContratoForm(false);
          onSuccess?.();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [employee, cedula, politicasList, onSuccess]);

  const generateNContrato = (empCedula: string, politicaId: number) => {
    const selectedPolitica = politicasList.find((p) => p.id === politicaId);
    const initials =
      (selectedPolitica?.tipo_politica || selectedPolitica?.nombre)?.charAt(0)?.toUpperCase() || "C";
    const count = (fullContrato.length || 0) + 1;
    return `${initials}-${empCedula}-${String(count).padStart(2, "0")}`;
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
    if (!cedula) return;

    setSavingContrato(true);
    try {
      const n_contrato =
        contratoData.n_contrato || generateNContrato(cedula, contratoData.politica_id);

      const res = await actualizarEmpleadoAction(cedula, {
        contrato: [
          {
            nContrato: n_contrato,
            fechaIngreso: formatInTimeZone(contratoData.fecha_ingreso, "UTC", "yyyy-MM-dd"),
            politicaId: contratoData.politica_id,
            fechaCulminacion: contratoData.fecha_culminacion
              ? formatInTimeZone(contratoData.fecha_culminacion, "UTC", "yyyy-MM-dd")
              : undefined,
          },
        ],
      });

      if (res && "error" in res) {
        toast.error(res.error);
      } else {
        toast.success("Contrato registrado correctamente");
        setHasActiveContrato(true);
        setShowContratoForm(false);
        onSuccess?.();
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
                n_contrato: prev.n_contrato || generateNContrato(cedula, politicaId),
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
      <Button onClick={handleSaveContrato} disabled={savingContrato} className="w-full cursor-pointer mt-3">
        {savingContrato ? "Guardando..." : "Guardar Contrato"}
      </Button>
    </div>
  );
}
