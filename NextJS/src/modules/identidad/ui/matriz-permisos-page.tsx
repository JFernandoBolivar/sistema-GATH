"use client";

/**
 * Matriz de permisos por rol (D4).
 *
 * Filas: permisos agrupados por módulo, con su descripción legible.
 * Columnas: roles. Editable solo con `identidad.asignar_permisos`; el AUDITOR
 * (y cualquier otro rol con `identidad.ver_roles`) la ve en solo lectura.
 * Cada cambio pide confirmación y motivo, queda en AuditoriaLog e incrementa
 * `permisos_version` de las cuentas del rol (invalida sus sesiones).
 */
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/components/alert-dialog";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { MatrizPermisosDTO } from "../application/dtos/usuario-dto";
import { guardarMatrizAction, obtenerMatrizAction } from "../infrastructure/actions/usuario-actions";

const MODULOS: Record<string, string> = {
  identidad: "Identidad y seguridad",
  organizacion: "Organización",
  catalogos: "Catálogos",
  personal: "Personal activo",
  pasivos: "Personal pasivo",
  cargos: "Cargos y ubicaciones",
  familiares: "Familiares y cargas",
  movimientos: "Movimientos e historial",
  reportes: "Reportes y constancias",
  carnetizacion: "Carnetización",
  autogestion: "Autogestión",
  bienestar: "Bienestar social",
  fe_de_vida: "Fe de vida",
  notificaciones: "Notificaciones",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  puntocuenta: "Punto de cuenta",
};

function nombreModulo(modulo: string): string {
  return MODULOS[modulo] ?? modulo;
}

export default function MatrizPermisosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, "identidad.ver_roles");
  const puedeEditar = tienePermiso(permisos, "identidad.asignar_permisos");

  const [matriz, setMatriz] = useState<MatrizPermisosDTO | null>(null);
  const [borrador, setBorrador] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, startTransition] = useTransition();
  const [rolGuardando, setRolGuardando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const cargar = () => {
    startTransition(async () => {
      setError(null);
      const datos = await obtenerMatrizAction();
      if (datos && typeof datos === "object" && "error" in datos) {
        setError((datos as { error: string }).error);
        return;
      }
      const m = datos as MatrizPermisosDTO;
      setMatriz(m);
      setBorrador(Object.fromEntries(m.roles.map((r) => [r.rolId, [...r.codigos]])));
    });
  };

  useEffect(() => {
    if (puedeVer) cargar();
  }, [puedeVer]);

  const filasPorModulo = useMemo(() => {
    const mapa = new Map<string, MatrizPermisosDTO["filas"]>();
    for (const fila of matriz?.filas ?? []) {
      mapa.set(fila.modulo, [...(mapa.get(fila.modulo) ?? []), fila]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matriz]);

  const alternar = (rolId: number, codigo: string) => {
    if (!puedeEditar) return;
    setBorrador((previo) => {
      const actuales = previo[rolId] ?? [];
      const siguientes = actuales.includes(codigo)
        ? actuales.filter((c) => c !== codigo)
        : [...actuales, codigo];
      return { ...previo, [rolId]: siguientes };
    });
  };

  const guardar = () => {
    if (rolGuardando === null) return;
    if (motivo.trim().length < 10) {
      toast.error("Indique el motivo del cambio (al menos 10 caracteres).");
      return;
    }
    startTransition(async () => {
      const resultado = await guardarMatrizAction(rolGuardando, borrador[rolGuardando] ?? [], motivo);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success("Matriz actualizada. Las sesiones del rol se invalidaron.");
      setRolGuardando(null);
      setMotivo("");
      cargar();
    });
  };

  if (!puedeVer) {
    return (
      <section className="px-6 py-4">
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No tiene el permiso «identidad.ver_roles» para consultar la matriz de permisos.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/usuarios">
            <ArrowLeft className="size-4" aria-hidden="true" /> Volver
          </Link>
        </Button>
        <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Matriz de permisos</h1>
        {!puedeEditar && <Badge variant="outline">Solo lectura</Badge>}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!puedeEditar && (
        <p className="text-sm text-muted-foreground">
          Puede consultar la matriz, pero solo quien tiene
          <code className="mx-1">identidad.asignar_permisos</code> puede modificarla.
        </p>
      )}

      {cargando && !matriz ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : matriz ? (
        <>
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-72">Permiso</TableHead>
                  {matriz.roles.map((rol) => (
                    <TableHead key={rol.rolId} className="text-center">
                      <span className="block">{rol.nombre}</span>
                      {puedeEditar && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-1"
                          onClick={() => {
                            setMotivo("");
                            setRolGuardando(rol.rolId);
                          }}
                        >
                          <Save className="size-3" aria-hidden="true" /> Guardar
                        </Button>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPorModulo.map(([modulo, filas]) => (
                  <Fragment key={`modulo-${modulo}`}>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={matriz.roles.length + 1} className="font-semibold">
                        {nombreModulo(modulo)}
                      </TableCell>
                    </TableRow>
                    {filas.map((fila) => (
                      <TableRow key={fila.codigo}>
                        <TableCell>
                          <span className="block font-mono text-xs">{fila.codigo}</span>
                          <span className="block text-xs text-muted-foreground">{fila.nombre}</span>
                        </TableCell>
                        {matriz.roles.map((rol) => {
                          const marcado = (borrador[rol.rolId] ?? []).includes(fila.codigo);
                          return (
                            <TableCell key={`${rol.rolId}-${fila.codigo}`} className="text-center">
                              <Checkbox
                                checked={marcado}
                                disabled={!puedeEditar || cargando}
                                onCheckedChange={() => alternar(rol.rolId, fila.codigo)}
                                aria-label={`${fila.codigo} para ${rol.nombre}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No se pudo cargar la matriz.</p>
      )}

      <AlertDialog
        open={rolGuardando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setRolGuardando(null);
            setMotivo("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar cambio de la matriz de{" "}
              {matriz?.roles.find((r) => r.rolId === rolGuardando)?.nombre ?? "rol"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <Field>
            <Label htmlFor="motivo-matriz">Motivo</Label>
            <Input
              id="motivo-matriz"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Mínimo 10 caracteres"
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            El cambio queda en la bitácora con el antes/después y cierra las sesiones de las cuentas del rol.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cargando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cargando}
              onClick={(e) => {
                e.preventDefault();
                guardar();
              }}
            >
              {cargando ? "Guardando…" : "Confirmar cambio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
