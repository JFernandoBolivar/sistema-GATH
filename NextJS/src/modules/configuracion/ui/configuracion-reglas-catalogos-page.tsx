"use client";

/**
 * Reglas de catálogos del sistema (A5).
 * Control de marcas y reglas operativas sobre tablas maestras:
 *  1. Parentescos: interruptor «Permitido para familiares» (aplica_familiar).
 *  2. Motivos de movimiento: lista agrupada por categoría con selector para cambiar
 *     categoría y modal para crear nuevo motivo. Bloquea motivos reservados del sistema
 *     y no permite dejar sin motivos una categoría requerida.
 *  3. Tipos de nómina: interruptores «Nómina activa» y «Requiere código» con advertencia.
 */
import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AlertTriangle, Lock, Plus, RefreshCw, ShieldAlert } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type {
  ReglaMotivoDTO,
  ReglaNominaDTO,
  ReglaParentescoDTO,
  ReglasCatalogosCompletoDTO,
} from "../application/dtos/reglas-catalogos-dto";
import {
  actualizarNominaAction,
  actualizarParentescoAction,
  cambiarCategoriaMotivoAction,
  crearMotivoAction,
  obtenerReglasCatalogosAction,
} from "../infrastructure/actions/reglas-catalogos-actions";
import { PERMISO_CONFIGURACION } from "../domain/value-objects/permisos-configuracion";

const PERMISO_VER = "configuracion.ver";

function esError(resultado: unknown): resultado is { error: string; errores?: Record<string, string[]> } {
  return typeof resultado === "object" && resultado !== null && "error" in resultado;
}

export function ConfiguracionReglasCatalogosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, PERMISO_VER) || tienePermiso(permisos, PERMISO_CONFIGURACION.editar);
  const puedeEditar = tienePermiso(permisos, PERMISO_CONFIGURACION.editar);

  const [isPending, startTransition] = useTransition();

  // Estados para diálogos de confirmación
  const [confirmParentesco, setConfirmParentesco] = useState<{
    parentesco: ReglaParentescoDTO;
    nuevoValor: boolean;
  } | null>(null);

  const [confirmMotivo, setConfirmMotivo] = useState<{
    motivo: ReglaMotivoDTO;
    nuevaCategoriaId: number;
    nuevaCategoriaNombre: string;
  } | null>(null);

  const [confirmNomina, setConfirmNomina] = useState<{
    nomina: ReglaNominaDTO;
    campo: "es_activo" | "requiere_codig";
    nuevoValor: boolean;
  } | null>(null);

  // Estado para modal de crear nuevo motivo
  const [modalNuevoMotivo, setModalNuevoMotivo] = useState(false);
  const [nuevoMovimiento, setNuevoMovimiento] = useState("");
  const [categoriaNuevoMotivo, setCategoriaNuevoMotivo] = useState<number | null>(null);
  const [errorNuevoMotivo, setErrorNuevoMotivo] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR(
    puedeVer ? "configuracion-reglas-catalogos" : null,
    async () => {
      const res = await obtenerReglasCatalogosAction();
      if (esError(res)) throw new Error(res.error);
      return res as ReglasCatalogosCompletoDTO;
    },
  );

  // Agrupar motivos por categoría
  const motivosPorCategoria = useMemo(() => {
    if (!data?.motivos || !data?.categorias_motivo) return [];
    return data.categorias_motivo.map((cat) => ({
      categoria: cat,
      motivos: data.motivos.filter((m) => m.categoria_id === cat.id),
    }));
  }, [data]);

  // Manejadores de acciones
  const handleGuardarParentesco = () => {
    if (!confirmParentesco) return;
    const { parentesco, nuevoValor } = confirmParentesco;
    setConfirmParentesco(null);

    startTransition(async () => {
      const res = await actualizarParentescoAction(parentesco.id, nuevoValor);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Parentesco «${parentesco.descripcion}» actualizado correctamente.`);
        mutate();
      }
    });
  };

  const handleGuardarCategoriaMotivo = () => {
    if (!confirmMotivo) return;
    const { motivo, nuevaCategoriaId, nuevaCategoriaNombre } = confirmMotivo;
    setConfirmMotivo(null);

    startTransition(async () => {
      const res = await cambiarCategoriaMotivoAction(motivo.id, nuevaCategoriaId);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(
          `Motivo «${motivo.movimiento}» transferido a la categoría «${nuevaCategoriaNombre}».`,
        );
        mutate();
      }
    });
  };

  const handleGuardarNuevoMotivo = () => {
    if (!categoriaNuevoMotivo || !nuevoMovimiento.trim()) {
      setErrorNuevoMotivo("Debe ingresar el nombre del motivo y seleccionar una categoría.");
      return;
    }
    setErrorNuevoMotivo(null);

    startTransition(async () => {
      const res = await crearMotivoAction(nuevoMovimiento, categoriaNuevoMotivo);
      if (esError(res)) {
        setErrorNuevoMotivo(res.error);
        toast.error(res.error);
      } else {
        toast.success("Motivo creado con éxito.");
        setModalNuevoMotivo(false);
        setNuevoMovimiento("");
        setCategoriaNuevoMotivo(null);
        mutate();
      }
    });
  };

  const handleGuardarNomina = () => {
    if (!confirmNomina) return;
    const { nomina, campo, nuevoValor } = confirmNomina;
    setConfirmNomina(null);

    startTransition(async () => {
      const payload = campo === "es_activo" ? { es_activo: nuevoValor } : { requiere_codig: nuevoValor };
      const res = await actualizarNominaAction(nomina.id, payload);
      if (esError(res)) {
        toast.error(res.error);
      } else {
        toast.success(`Nómina «${nomina.nomina}» actualizada correctamente.`);
        mutate();
      }
    });
  };

  if (!puedeVer) {
    return (
      <PageLayout title="Reglas de catálogos">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          No tiene los permisos requeridos para consultar la configuración de reglas de catálogos.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Reglas de Catálogos"
      description="Control y configuración de marcas de tablas maestras que gobiernan reglas operativas del sistema."
    >
      <Tabs defaultValue="parentescos" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 max-w-xl">
          <TabsTrigger value="parentescos">Parentescos</TabsTrigger>
          <TabsTrigger value="motivos">Motivos de Movimiento</TabsTrigger>
          <TabsTrigger value="nominas">Tipos de Nómina</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 1: PARENTESCOS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="parentescos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parentescos y Reglas de Vinculación</CardTitle>
              <CardDescription>
                Habilite o deshabilite si un parentesco está permitido exclusivamente para
                familiares en RRHH o si puede usarse en contactos de emergencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Descripción del Parentesco</TableHead>
                        <TableHead className="text-center w-[220px]">
                          Permitido para Familiares
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.parentescos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.id}</TableCell>
                          <TableCell className="font-medium">{p.descripcion}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={p.aplica_familiar}
                                disabled={!puedeEditar || isPending}
                                onCheckedChange={(val) => {
                                  setConfirmParentesco({
                                    parentesco: p,
                                    nuevoValor: val,
                                  });
                                }}
                              />
                              <span className="text-xs text-muted-foreground w-12 text-left">
                                {p.aplica_familiar ? "Sí" : "No"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 2: MOTIVOS DE MOVIMIENTO */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="motivos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Motivos de Movimiento por Categoría</CardTitle>
                <CardDescription>
                  Cada operación del sistema consume los motivos de su categoría correspondiente.
                  Los motivos reservados del sistema están protegidos contra reasignación.
                </CardDescription>
              </div>
              {puedeEditar && (
                <Button
                  onClick={() => {
                    setErrorNuevoMotivo(null);
                    setNuevoMovimiento("");
                    setCategoriaNuevoMotivo(data?.categorias_motivo[0]?.id ?? null);
                    setModalNuevoMotivo(true);
                  }}
                  className="shrink-0"
                >
                  <Plus className="mr-2 size-4" /> Nuevo Motivo
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                motivosPorCategoria.map((grupo) => (
                  <div key={grupo.categoria.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-bold text-sm bg-background">
                          {grupo.categoria.categoria}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({grupo.motivos.length} motivo{grupo.motivos.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </div>

                    <div className="rounded-md border bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead>Nombre del Motivo</TableHead>
                            <TableHead className="w-[200px]">Tipo / Restricción</TableHead>
                            <TableHead className="w-[260px] text-right">Categoría Asignada</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grupo.motivos.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">
                                Sin motivos asignados a esta categoría.
                              </TableCell>
                            </TableRow>
                          ) : (
                            grupo.motivos.map((m) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-mono text-xs">{m.id}</TableCell>
                                <TableCell className="font-medium flex items-center gap-2">
                                  {m.movimiento}
                                  {m.es_reservado && (
                                    <span title="Motivo reservado del sistema" className="inline-flex items-center">
                                      <Lock className="size-3.5 text-amber-500" aria-hidden="true" />
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {m.es_reservado ? (
                                    <Badge variant="secondary" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
                                      Reservado (Pase a Pasivo)
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Estándar
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {m.es_reservado ? (
                                    <span className="text-xs text-muted-foreground italic">
                                      Bloqueado por sistema
                                    </span>
                                  ) : (
                                    <div className="flex justify-end">
                                      <Select
                                        disabled={!puedeEditar || isPending}
                                        value={String(m.categoria_id)}
                                        onValueChange={(val) => {
                                          const catId = Number.parseInt(val);
                                          const catObj = data?.categorias_motivo.find((c) => c.id === catId);
                                          if (catObj && catId !== m.categoria_id) {
                                            setConfirmMotivo({
                                              motivo: m,
                                              nuevaCategoriaId: catId,
                                              nuevaCategoriaNombre: catObj.categoria,
                                            });
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="w-[210px] h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {data?.categorias_motivo.map((cat) => (
                                            <SelectItem key={cat.id} value={String(cat.id)}>
                                              {cat.categoria}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* PESTAÑA 3: TIPOS DE NÓMINA */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="nominas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reglas y Marcas de Tipos de Nómina</CardTitle>
              <CardDescription>
                Gobernanza sobre qué nóminas se consideran personal activo y cuáles exigen
                código de cargo asignado para sus trabajadores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>Nombre de Nómina</TableHead>
                        <TableHead className="text-center w-[180px]">Nómina Activa</TableHead>
                        <TableHead className="text-center w-[180px]">Requiere Código</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.nominas.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs">{n.id}</TableCell>
                          <TableCell className="font-medium">{n.nomina}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={n.es_activo}
                                disabled={!puedeEditar || isPending}
                                onCheckedChange={(val) => {
                                  setConfirmNomina({
                                    nomina: n,
                                    campo: "es_activo",
                                    nuevoValor: val,
                                  });
                                }}
                              />
                              <span className="text-xs text-muted-foreground w-8 text-left">
                                {n.es_activo ? "Sí" : "No"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Switch
                                checked={n.requiere_codig}
                                disabled={!puedeEditar || isPending}
                                onCheckedChange={(val) => {
                                  setConfirmNomina({
                                    nomina: n,
                                    campo: "requiere_codig",
                                    nuevoValor: val,
                                  });
                                }}
                              />
                              <span className="text-xs text-muted-foreground w-8 text-left">
                                {n.requiere_codig ? "Sí" : "No"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------- */}
      {/* DIÁLOGOS DE CONFIRMACIÓN */}
      {/* ------------------------------------------------------------- */}

      {/* Confirmación Parentesco */}
      <AlertDialog
        open={confirmParentesco !== null}
        onOpenChange={(open) => !open && setConfirmParentesco(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio en parentesco</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea cambiar el estado de «Permitido para familiares» del
              parentesco <strong>{confirmParentesco?.parentesco.descripcion}</strong> a{" "}
              <strong>{confirmParentesco?.nuevoValor ? "SÍ" : "NO"}</strong>?
              <br />
              Este cambio surtirá efecto inmediato en los registros y validaciones de expedientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarParentesco}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación Motivo de Movimiento */}
      <AlertDialog
        open={confirmMotivo !== null}
        onOpenChange={(open) => !open && setConfirmMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de categoría de motivo</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                ¿Desea reasignar el motivo <strong>{confirmMotivo?.motivo.movimiento}</strong> a la
                categoría <strong>{confirmMotivo?.nuevaCategoriaNombre}</strong>?
              </p>
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Al transferir el motivo, sólo estará disponible para los procesos y pantallas
                  asociadas a la nueva categoría.
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarCategoriaMotivo}>
              Confirmar Traslado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación Nómina */}
      <AlertDialog
        open={confirmNomina !== null}
        onOpenChange={(open) => !open && setConfirmNomina(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Confirmar cambio de regla de nómina
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                ¿Confirma el cambio de la regla{" "}
                <strong>
                  {confirmNomina?.campo === "es_activo" ? "«Nómina activa»" : "«Requiere código»"}
                </strong>{" "}
                para la nómina <strong>{confirmNomina?.nomina.nomina}</strong> a{" "}
                <strong>{confirmNomina?.nuevoValor ? "Activado (SÍ)" : "Desactivado (NO)"}</strong>?
              </p>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                <strong>Advertencia de impacto:</strong> Este parámetro altera de inmediato qué
                trabajadores aparecen en los listados y reportes de personal activo vs pasivo, y qué
                nóminas se ofrecen al asignar códigos especiales de cargo.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGuardarNomina}>Confirmar Cambio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Crear Nuevo Motivo */}
      <Dialog open={modalNuevoMotivo} onOpenChange={setModalNuevoMotivo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Motivo de Movimiento</DialogTitle>
            <DialogDescription>
              Agregue un nuevo motivo asignado directamente a una categoría de operación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nuevo-movimiento">Nombre del Motivo</Label>
              <Input
                id="nuevo-movimiento"
                placeholder="P. ej. INGRESO POR CONCURSO PÚBLICO"
                maxLength={100}
                value={nuevoMovimiento}
                onChange={(e) => setNuevoMovimiento(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-nuevo-motivo">Categoría</Label>
              <Select
                value={categoriaNuevoMotivo ? String(categoriaNuevoMotivo) : ""}
                onValueChange={(val) => setCategoriaNuevoMotivo(Number.parseInt(val))}
              >
                <SelectTrigger id="cat-nuevo-motivo">
                  <SelectValue placeholder="Seleccione una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {data?.categorias_motivo.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errorNuevoMotivo && (
              <p role="alert" className="text-xs text-destructive">
                {errorNuevoMotivo}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNuevoMotivo(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarNuevoMotivo} disabled={isPending}>
              Guardar Motivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
