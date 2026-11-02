"use client";

/**
 * Matriz de permisos por rol (D4).
 *
 * Filas: permisos agrupados por módulo, con su descripción legible y plegables.
 * Columnas: roles, con el conteo de permisos y el guardado por rol.
 * Editable solo con `identidad.asignar_permisos`; el AUDITOR (y cualquier otro
 * rol con `identidad.ver_roles`) la ve en solo lectura. Cada cambio pide
 * confirmación y motivo, queda en AuditoriaLog e incrementa `permisos_version`
 * de las cuentas del rol (invalida sus sesiones).
 */
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
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
  bienestar: "Bienestar Social",
  fe_de_vida: "Fe de vida",
  notificaciones: "Notificaciones",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  puntocuenta: "Punto de cuenta",
};

function nombreModulo(modulo: string): string {
  return MODULOS[modulo] ?? modulo;
}

/** «ADMIN_BIENESTAR» → «Admin Bienestar»; conserva siglas como RRHH. */
function nombreRol(nombre: string): string {
  const siglas = new Set(["RRHH", "TI", "GATH", "APN"]);
  return nombre
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((palabra) => {
      if (siglas.has(palabra)) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
    })
    .join(" ");
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
  const [busqueda, setBusqueda] = useState("");
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());

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

  const filasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filas = matriz?.filas ?? [];
    if (!texto) return filas;
    return filas.filter(
      (fila) =>
        fila.codigo.toLowerCase().includes(texto) ||
        fila.nombre.toLowerCase().includes(texto) ||
        nombreModulo(fila.modulo).toLowerCase().includes(texto),
    );
  }, [matriz, busqueda]);

  const filasPorModulo = useMemo(() => {
    const mapa = new Map<string, MatrizPermisosDTO["filas"]>();
    for (const fila of filasFiltradas) {
      mapa.set(fila.modulo, [...(mapa.get(fila.modulo) ?? []), fila]);
    }
    return [...mapa.entries()].sort(([a], [b]) =>
      nombreModulo(a).localeCompare(nombreModulo(b), "es"),
    );
  }, [filasFiltradas]);

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

  const totalPorRol = (rolId: number) => (borrador[rolId] ?? []).length;

  const cambiosPorRol = (rolId: number, codigosOriginales: string[]) => {
    const antes = new Set(codigosOriginales);
    const ahora = new Set(borrador[rolId] ?? []);
    let cambios = 0;
    antes.forEach((codigo) => {
      if (!ahora.has(codigo)) cambios += 1;
    });
    ahora.forEach((codigo) => {
      if (!antes.has(codigo)) cambios += 1;
    });
    return cambios;
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

  const alternarModulo = (modulo: string) => {
    setCerrados((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(modulo)) siguiente.delete(modulo);
      else siguiente.add(modulo);
      return siguiente;
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

  const buscando = busqueda.trim().length > 0;

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden px-4 py-4 lg:px-6">
      <header className="flex flex-col gap-3">
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
        <p className="max-w-3xl text-sm text-muted-foreground">
          Defina qué puede hacer cada rol. Marque o desmarque un permiso y guarde los cambios del
          rol; cada guardado pide un motivo y queda registrado en la bitácora.
        </p>
      </header>

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full min-w-0 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar permiso por código o nombre…"
                aria-label="Buscar permiso"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                {filasFiltradas.length} de {matriz.filas.length} permisos · {matriz.roles.length} roles
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCerrados(
                    cerrados.size > 0
                      ? new Set()
                      : new Set(filasPorModulo.map(([modulo]) => modulo)),
                  )
                }
              >
                {cerrados.size > 0 ? "Expandir todo" : "Contraer todo"}
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-21rem)] w-full max-w-full min-w-0 overflow-auto rounded-xl border bg-card shadow-sm">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 top-0 z-30 min-w-72 bg-card">
                    Permiso
                  </TableHead>
                  {matriz.roles.map((rol) => {
                    const cambios = cambiosPorRol(rol.rolId, rol.codigos);
                    return (
                      <TableHead
                        key={rol.rolId}
                        className="sticky top-0 z-20 min-w-40 bg-card text-center align-top"
                      >
                        <div className="flex flex-col items-center gap-1 py-1">
                          <span
                            className="text-sm font-semibold text-foreground"
                            title={rol.nombre}
                          >
                            {nombreRol(rol.nombre)}
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            {totalPorRol(rol.rolId)} permisos
                          </span>
                          {puedeEditar && (
                            <Button
                              type="button"
                              size="sm"
                              variant={cambios > 0 ? "default" : "outline"}
                              disabled={cambios === 0}
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => {
                                setMotivo("");
                                setRolGuardando(rol.rolId);
                              }}
                            >
                              <Save className="size-3" aria-hidden="true" />
                              {cambios > 0 ? `Guardar (${cambios})` : "Sin cambios"}
                            </Button>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPorModulo.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={matriz.roles.length + 1}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No hay permisos que coincidan con «{busqueda.trim()}».
                    </TableCell>
                  </TableRow>
                ) : (
                  filasPorModulo.map(([modulo, filas]) => {
                    const abierto = buscando || !cerrados.has(modulo);
                    return (
                      <Fragment key={`modulo-${modulo}`}>
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableCell
                            colSpan={matriz.roles.length + 1}
                            className="sticky left-0 z-10 bg-muted/60 p-0"
                          >
                            <button
                              type="button"
                              onClick={() => alternarModulo(modulo)}
                              aria-expanded={abierto}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-foreground"
                            >
                              <ChevronDown
                                className={`size-4 transition-transform ${abierto ? "" : "-rotate-90"}`}
                                aria-hidden="true"
                              />
                              {nombreModulo(modulo)}
                              <span className="ml-auto text-xs font-normal text-muted-foreground">
                                {filas.length} permisos
                              </span>
                            </button>
                          </TableCell>
                        </TableRow>
                        {abierto &&
                          filas.map((fila) => (
                            <TableRow key={fila.codigo} className="group">
                              <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                                <span className="block font-mono text-[11px] font-medium text-primary">
                                  {fila.codigo}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {fila.nombre}
                                </span>
                              </TableCell>
                              {matriz.roles.map((rol) => {
                                const marcado = (borrador[rol.rolId] ?? []).includes(fila.codigo);
                                return (
                                  <TableCell
                                    key={`${rol.rolId}-${fila.codigo}`}
                                    className="text-center"
                                  >
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
                    );
                  })
                )}
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
              {(() => {
                const rol = matriz?.roles.find((r) => r.rolId === rolGuardando);
                return rol ? nombreRol(rol.nombre) : "rol";
              })()}
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
