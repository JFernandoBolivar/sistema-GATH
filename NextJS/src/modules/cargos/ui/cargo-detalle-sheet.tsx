"use client";

/**
 * Vista de detalle (solo lectura) de un código de posición + las acciones
 * operativas embebidas (asignar/desasignar/trasladar/cambiar estatus),
 * réplica de paridad estructural del legado: en `listado-codigo` las
 * acciones sobre un código viven en el detalle/menú de la fila, no en un
 * formulario siempre visible en la página de listado.
 *
 * Nota de alcance: el legado también permitía editar ahí mismo TODOS los
 * atributos del código (denominación, específica, nómina, grado, ubicación)
 * vía `UpdateCode`; esa capacidad no tiene caso de uso equivalente en el
 * backend nuevo (`apps.cargos` no expone "actualizar cargo", solo
 * "trasladar"/"cambiar estatus"/"asignar"/"desasignar") — se documenta como
 * brecha pendiente de autorización explícita, no se inventa el endpoint.
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightLeft, Loader2, UserMinus, UserPlus } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/components/sheet";

import type { CargoAsignacionDTO, CatalogoCargoItemDTO } from "../application/dtos/cargo-dto";
import {
  asignarCargoSchema,
  cambiarCargoSchema,
  gestionarEstatusSchema,
  type AsignarCargoFormType,
  type CambiarCargoFormType,
  type GestionarEstatusFormType,
} from "./schema/schema-asignar-cargo";

function FilaInfo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{etiqueta}</div>
      <div>{valor}</div>
    </div>
  );
}

function EstatusBadge({ estatusNombre, estaVacante }: { estatusNombre: string; estaVacante: boolean }) {
  if (estaVacante) return <Badge className="bg-green-700 text-white hover:bg-green-700">{estatusNombre}</Badge>;
  if (estatusNombre === "ACTIVO") return <Badge className="bg-[#ffc523] text-black hover:bg-[#ffc523]">{estatusNombre}</Badge>;
  if (estatusNombre === "SUSPENDIDO") return <Badge className="bg-gray-500 text-white hover:bg-gray-500">{estatusNombre}</Badge>;
  return <Badge variant="destructive">{estatusNombre}</Badge>;
}

interface CargoDetalleSheetProps {
  cargo: CargoAsignacionDTO | null;
  cargosVacantes: CargoAsignacionDTO[];
  motivos: CatalogoCargoItemDTO[];
  estatus: CatalogoCargoItemDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAsignar: (empleadoCedula: string) => void;
  onDesasignar: () => void;
  onTrasladar: (cargoNuevoId: number, motivoId: number) => void;
  onCambiarEstatus: (estatusId: number, motivoId: number) => void;
  isPending: boolean;
  puedeAsignar: boolean;
}

export default function CargoDetalleSheet({
  cargo,
  cargosVacantes,
  motivos,
  estatus,
  open,
  onOpenChange,
  onAsignar,
  onDesasignar,
  onTrasladar,
  onCambiarEstatus,
  isPending,
  puedeAsignar,
}: CargoDetalleSheetProps) {
  const asignarForm = useForm<AsignarCargoFormType>({
    resolver: zodResolver(asignarCargoSchema),
    defaultValues: { cargoId: cargo?.id ?? 0, empleadoCedula: "" },
  });
  const cambiarForm = useForm<CambiarCargoFormType>({
    resolver: zodResolver(cambiarCargoSchema),
    defaultValues: { cargoActualId: cargo?.id ?? 0, cargoNuevoId: undefined, motivoId: undefined },
  });
  const estatusForm = useForm<GestionarEstatusFormType>({
    resolver: zodResolver(gestionarEstatusSchema),
    defaultValues: { cargoId: cargo?.id ?? 0, estatusId: undefined, motivoId: undefined },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalle del código</SheetTitle>
        </SheetHeader>
        {!cargo ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div>
              <h2 className="text-lg font-semibold">{cargo.codigo}</h2>
              <p className="text-sm text-muted-foreground">{cargo.denominacionNombre} — {cargo.especificaNombre}</p>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Información general</CardTitle></CardHeader>
              <CardContent>
                <FilaInfo etiqueta="Tipo de nómina" valor={cargo.tipoNominaNombre} />
                <div className="grid grid-cols-2 gap-2 py-1 text-sm">
                  <div className="text-muted-foreground">Estatus</div>
                  <div><EstatusBadge estatusNombre={cargo.estatusNombre} estaVacante={cargo.estaVacante} /></div>
                </div>
                <FilaInfo etiqueta="Grado" valor={cargo.gradoNombre ?? "N/A"} />
                <FilaInfo etiqueta="Organismo adscrito" valor={cargo.organismoNombre ?? "N/A"} />
                <FilaInfo etiqueta="Dependencia" valor={cargo.dependenciaNombre ?? "—"} />
                <FilaInfo etiqueta="Dirección general" valor={cargo.direccionGeneralNombre ?? "—"} />
                <FilaInfo etiqueta="Dirección de línea" valor={cargo.direccionLineaNombre ?? "—"} />
                <FilaInfo etiqueta="Coordinación" valor={cargo.coordinacionNombre ?? "—"} />
                <FilaInfo etiqueta="Observaciones" valor={cargo.observaciones ?? "—"} />
              </CardContent>
            </Card>

            {puedeAsignar && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Empleado</CardTitle></CardHeader>
                <CardContent>
                  {cargo.estaVacante ? (
                    <form
                      onSubmit={asignarForm.handleSubmit((data) => onAsignar(data.empleadoCedula))}
                      className="flex items-end gap-2"
                      noValidate
                    >
                      <Field className="flex-1" data-invalid={!!asignarForm.formState.errors.empleadoCedula}>
                        <Label htmlFor="detalleEmpleadoCedula">Cédula del empleado</Label>
                        <Input id="detalleEmpleadoCedula" placeholder="Ej. 12345678" {...asignarForm.register("empleadoCedula")} />
                        {asignarForm.formState.errors.empleadoCedula && (
                          <p role="alert" className="text-sm text-destructive">{asignarForm.formState.errors.empleadoCedula.message}</p>
                        )}
                      </Field>
                      <Button type="submit" disabled={isPending}>
                        <UserPlus className="size-4" aria-hidden="true" /> Asignar
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <FilaInfo etiqueta="Cédula" valor={cargo.empleadoCedula ?? "—"} />
                      <Button variant="outline" size="sm" onClick={onDesasignar} disabled={isPending}>
                        <UserMinus className="size-4" aria-hidden="true" /> Desasignar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {puedeAsignar && !cargo.estaVacante && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Trasladar a otro código</CardTitle></CardHeader>
                <CardContent>
                  <form
                    onSubmit={cambiarForm.handleSubmit((data) => onTrasladar(data.cargoNuevoId, data.motivoId))}
                    className="flex flex-col gap-3"
                    noValidate
                  >
                    <Field>
                      <Label htmlFor="cargoNuevoId">Código de destino (vacante)</Label>
                      <Select
                        value={cambiarForm.watch("cargoNuevoId") ? String(cambiarForm.watch("cargoNuevoId")) : undefined}
                        onValueChange={(v) => cambiarForm.setValue("cargoNuevoId", Number(v))}
                      >
                        <SelectTrigger id="cargoNuevoId" className="w-full">
                          <SelectValue placeholder="Seleccione un código vacante" />
                        </SelectTrigger>
                        <SelectContent>
                          {cargosVacantes.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.codigo} — {c.denominacionNombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor="trasladoMotivoId">Motivo</Label>
                      <Select
                        value={cambiarForm.watch("motivoId") ? String(cambiarForm.watch("motivoId")) : undefined}
                        onValueChange={(v) => cambiarForm.setValue("motivoId", Number(v))}
                      >
                        <SelectTrigger id="trasladoMotivoId" className="w-full">
                          <SelectValue placeholder="Seleccione un motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {motivos.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button type="submit" disabled={isPending}>
                      <ArrowRightLeft className="size-4" aria-hidden="true" /> Trasladar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {puedeAsignar && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Gestionar estatus</CardTitle></CardHeader>
                <CardContent>
                  <form
                    onSubmit={estatusForm.handleSubmit((data) => onCambiarEstatus(data.estatusId, data.motivoId))}
                    className="flex flex-col gap-3"
                    noValidate
                  >
                    <Field>
                      <Label htmlFor="detalleEstatusId">Estatus</Label>
                      <Select
                        value={estatusForm.watch("estatusId") ? String(estatusForm.watch("estatusId")) : undefined}
                        onValueChange={(v) => estatusForm.setValue("estatusId", Number(v))}
                      >
                        <SelectTrigger id="detalleEstatusId" className="w-full">
                          <SelectValue placeholder="Seleccione un estatus" />
                        </SelectTrigger>
                        <SelectContent>
                          {estatus.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor="detalleEstatusMotivoId">Motivo</Label>
                      <Select
                        value={estatusForm.watch("motivoId") ? String(estatusForm.watch("motivoId")) : undefined}
                        onValueChange={(v) => estatusForm.setValue("motivoId", Number(v))}
                      >
                        <SelectTrigger id="detalleEstatusMotivoId" className="w-full">
                          <SelectValue placeholder="Seleccione un motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {motivos.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button type="submit" disabled={isPending}>
                      Actualizar estatus
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
