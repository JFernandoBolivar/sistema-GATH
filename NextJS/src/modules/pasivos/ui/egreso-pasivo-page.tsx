"use client";

/**
 * Egreso de un pasivo (flujo original de Gestión de Pasivos): buscar por
 * cédula, elegir el motivo de fallecimiento y, opcionalmente, dar de alta a
 * los familiares como pensionados por sobrevivencia en el mismo proceso.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Search } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoPasivoDTO, PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  egresarPasivoAction,
  getFamiliaresTitularAction,
  getMotivosEgresoPasivoAction,
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
  const [motivos, setMotivos] = useState<CatalogoPasivoDTO[]>([]);
  const [motivoId, setMotivoId] = useState(0);
  const [familiares, setFamiliares] = useState<FamiliarTitular[]>([]);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [conSobrevivientes, setConSobrevivientes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasivo(null);
    setFamiliares([]);
    setSeleccion([]);
    setConSobrevivientes(false);
    startTransition(async () => {
      try {
        const [detalle, motivosLista] = await Promise.all([
          getPasivoPorCedulaAction(cedula.trim()),
          getMotivosEgresoPasivoAction(),
        ]);
        if (!detalle || typeof detalle !== "object" || "error" in detalle) {
          setError((detalle as { error?: string })?.error ?? "No se encontró el pasivo.");
          return;
        }
        setPasivo(detalle as PasivoDTO);
        setMotivos(motivosLista);
      } catch {
        setError("No fue posible consultar el pasivo.");
      }
    });
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
    startTransition(async () => {
      const resultado = await egresarPasivoAction(pasivo.cedula, motivoId, seleccion);
      if (!resultado || typeof resultado !== "object" || "error" in resultado) {
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
      <Card className="max-w-4xl bg-white">
        <CardHeader>
          <CardTitle>Buscar personal pasivo</CardTitle>
          <CardDescription>Ingrese la cédula del jubilado, pensionado o sobreviviente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1">
              <Label htmlFor="egreso-pasivo-cedula">Cédula del pasivo</Label>
              <Input
                id="egreso-pasivo-cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="V-12345678"
                required
              />
            </Field>
            <Button type="submit" disabled={isPending || !cedula.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
              Buscar
            </Button>
          </form>

          {pasivo && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-semibold">{pasivo.nombreCompleto}</p>
                <p className="text-muted-foreground">C.I. {pasivo.cedula} — {pasivo.tipoPasivo}</p>
              </div>

              <Field>
                <Label htmlFor="egreso-pasivo-motivo">Motivo de egreso</Label>
                <Select
                  value={motivoId ? String(motivoId) : undefined}
                  onValueChange={(v) => setMotivoId(Number(v))}
                >
                  <SelectTrigger id="egreso-pasivo-motivo" className="w-full">
                    <SelectValue placeholder="Seleccione el motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
