"use client";

/**
 * Egreso de un pasivo (flujo original de Gestión de Pasivos): buscar por
 * cédula, elegir el motivo de fallecimiento y, opcionalmente, dar de alta a
 * los familiares como pensionados por sobrevivencia en el mismo proceso.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import { MotivoSelect } from "@/modules/cargos/ui/components/motivo-select";

import { SelectorPasivo } from "./components/selector-pasivo";
import type { PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  egresarPasivoAction,
  getFamiliaresTitularAction,
  getPasivoPorCedulaAction,
} from "../infrastructure/actions/pasivos-actions";

interface FamiliarTitular {
  id: number;
  cedulaFamiliar: string | null;
  nombreCompleto: string;
  heredero: boolean;
}

export default function EgresoPasivoPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [pasivo, setPasivo] = useState<PasivoDTO | null>(null);
  const [motivoId, setMotivoId] = useState(0);
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [familiares, setFamiliares] = useState<FamiliarTitular[]>([]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [conSobrevivientes, setConSobrevivientes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buscar = (cedulaBusqueda: string) => {
    const cedulaLimpia = cedulaBusqueda.trim();
    if (!cedulaLimpia) return;
    setCedula(cedulaLimpia);
    setError(null);
    setPasivo(null);
    setFamiliares([]);
    setSeleccion([]);
    setConSobrevivientes(false);
    startTransition(async () => {
      try {
        const detalle = await getPasivoPorCedulaAction(cedulaLimpia);
        if (!detalle || typeof detalle !== "object" || "error" in detalle) {
          setError((detalle as { error?: string })?.error ?? "No se encontró el pasivo.");
          return;
        }
        setPasivo(detalle as PasivoDTO);
      } catch {
        setError("No fue posible consultar el pasivo.");
      }
    });
  };

  const cambiar = () => {
    setPasivo(null);
    setError(null);
    setCedula("");
    setMotivoId(0);
    setErrorMotivo(null);
    setFamiliares([]);
    setSeleccion([]);
    setConSobrevivientes(false);
  };

  const activarSobrevivientes = (valor: boolean) => {
    setConSobrevivientes(valor);
    setSeleccion([]);
    if (!valor) {
      setFamiliares([]);
      return;
    }
    startTransition(async () => {
      const lista = await getFamiliaresTitularAction(cedula.trim());
      if (!lista || typeof lista !== "object" || "error" in lista) {
        setError((lista as { error?: string })?.error ?? "No fue posible cargar los familiares.");
        return;
      }
      const familiaresLista = lista as FamiliarTitular[];
      setFamiliares(familiaresLista);
      setSeleccion(familiaresLista.filter((f) => f.heredero).map((f) => f.id));
    });
  };

  const egresar = () => {
    if (!pasivo || !motivoId) {
      setError("Seleccione el pasivo y el motivo de egreso.");
      return;
    }
    setError(null);
    setErrorMotivo(null);
    startTransition(async () => {
      const resultado = await egresarPasivoAction(pasivo.cedula, motivoId, seleccion);
      if (!resultado || typeof resultado !== "object" || "error" in resultado) {
        const errorDeMotivo = resultado && "errores" in resultado ? resultado.errores?.motivo_id?.[0] : undefined;
        if (errorDeMotivo) {
          setErrorMotivo(errorDeMotivo);
          return;
        }
        setError((resultado as { error?: string })?.error ?? "No fue posible egresar el pasivo.");
        return;
      }
      toast.success("Egreso de pasivo procesado.");
      router.push("/pasivos/consultar");
    });
  };

  return (
    <PageLayout
      title="Egreso de Pasivo"
      description="Registre el fallecimiento de un pasivo y, si aplica, el alta de sus sobrevivientes."
    >
      {/* Mismo contenedor que las pantallas de activos (Movimientos): ancho completo y p-6. */}
      <Card className="bg-card">
        <CardContent className="flex flex-col gap-5 p-6">
          <SelectorPasivo
            pasivo={pasivo}
            buscando={isPending && !pasivo}
            error={pasivo ? null : error}
            onBuscar={buscar}
            onCambiar={cambiar}
          />

          {pasivo && error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {pasivo && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <Field>
                <Label htmlFor="egreso-pasivo-motivo">Motivo de egreso</Label>
                <MotivoSelect
                  id="egreso-pasivo-motivo"
                  operacion="egreso_pasivo"
                  value={motivoId}
                  onChange={(id) => {
                    setMotivoId(id);
                    setErrorMotivo(null);
                  }}
                  aria-invalid={errorMotivo ? true : undefined}
                />
                {errorMotivo && (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMotivo}
                  </p>
                )}
              </Field>

              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={conSobrevivientes}
                  onCheckedChange={(v) => activarSobrevivientes(v === true)}
                />
                Seleccionar pensionado sobreviviente
              </label>

              {conSobrevivientes && (
                <div className="flex flex-col gap-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Familiares beneficiarios</p>
                  {familiares.length === 0 ? (
                    <p className="text-sm text-muted-foreground">El pasivo no tiene familiares registrados.</p>
                  ) : (
                    familiares.map((f) => (
                      <label key={f.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={seleccion.includes(f.id)}
                          onCheckedChange={(v) =>
                            setSeleccion((prev) =>
                              v ? [...new Set([...prev, f.id])] : prev.filter((id) => id !== f.id),
                            )
                          }
                        />
                        <span className="font-medium">{f.nombreCompleto}</span>
                        <span className="text-muted-foreground">C.I. {f.cedulaFamiliar ?? "sin cédula"}</span>
                        {f.heredero && <span className="ml-auto text-xs text-emerald-700">Heredero</span>}
                      </label>
                    ))
                  )}
                </div>
              )}

              <Button type="button" onClick={egresar} disabled={isPending || !motivoId}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
                Ejecutar egreso
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
