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
import { Switch } from "@/components/ui/switch";
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

export default function MatrizPermisosPage({ rolInicial }: { rolInicial?: number } = {}) {
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
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const [rolFiltro, setRolFiltro] = useState<string>(rolInicial ? String(rolInicial) : "todos");
  const [rolSeleccionado, setRolSeleccionado] = useState<number | null>(rolInicial ?? null);
  const [modoComparar, setModoComparar] = useState(false);

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
      setRolSeleccionado((actual) => actual ?? m.roles[0]?.rolId ?? null);
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

  const rolesVisibles = useMemo(() => {
    const roles = matriz?.roles ?? [];
    return rolFiltro === "todos" ? roles : roles.filter((r) => String(r.rolId) === rolFiltro);
  }, [matriz, rolFiltro]);

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
      setErrorMotivo("Indique el motivo del cambio (al menos 10 caracteres).");
      return;
    }
    setErrorMotivo(null);
    startTransition(async () => {
      const resultado = await guardarMatrizAction(rolGuardando, borrador[rolGuardando] ?? [], motivo);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const fallo = resultado as { error: string; errores?: Record<string, string[]> };
        const detalle = fallo.errores?.motivo?.join(" ");
        if (detalle) setErrorMotivo(detalle);
        else toast.error(fallo.error);
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

  const marcarModulo = (rolId: number, modulo: string, activar: boolean) => {
    if (!puedeEditar) return;
    const codigos = (matriz?.filas ?? []).filter((f) => f.modulo === modulo).map((f) => f.codigo);
    setBorrador((previo) => {
      const actuales = new Set(previo[rolId] ?? []);
      codigos.forEach((codigo) => (activar ? actuales.add(codigo) : actuales.delete(codigo)));
      return { ...previo, [rolId]: [...actuales] };
    });
  };

  const descartar = (rolId: number) => {
    const original = matriz?.roles.find((r) => r.rolId === rolId);
    if (original) {
      setBorrador((previo) => ({ ...previo, [rolId]: [...original.codigos] }));
    }
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
  const rolActual = matriz?.roles.find((rol) => rol.rolId === rolSeleccionado) ?? matriz?.roles[0] ?? null;
  const cambiosActuales = rolActual ? cambiosPorRol(rolActual.rolId, rolActual.codigos) : 0;

  return (
    <section className="flex w-full min-w-0 max-w-full flex-col gap-4 px-4 py-4 lg:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/usuarios/roles">
              <ArrowLeft className="size-4" aria-hidden="true" /> Volver
            </Link>
          </Button>
          <ShieldCheck className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold tracking-tight">Matriz de permisos</h1>
          {!puedeEditar && <Badge variant="outline">Solo lectura</Badge>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex ml-auto"
            onClick={() => setModoComparar((valor) => !valor)}
          >
            {modoComparar ? "Vista por rol" : "Comparar roles"}
          </Button>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Elija un rol y active los permisos que necesita. Cada guardado pide un motivo y queda en la bitácora.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando && !matriz ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : !matriz ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No se pudo cargar la matriz.</p>
      ) : modoComparar ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full min-w-0 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar permiso por nombre…"
                aria-label="Buscar permiso"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <label htmlFor="matriz-rol" className="font-medium text-foreground">Ver solo un rol</label>
              <select
                id="matriz-rol"
                className="min-h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={rolFiltro}
                onChange={(evento) => setRolFiltro(evento.target.value)}
              >
                <option value="todos">Todos los roles</option>
                {matriz.roles.map((rol) => (
                  <option key={rol.rolId} value={String(rol.rolId)}>{rol.nombre}</option>
                ))}
              </select>
              <span>{filasFiltradas.length} de {matriz.filas.length} permisos · {rolesVisibles.length} roles</span>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-18rem)] w-full max-w-full min-w-0 overflow-auto rounded-xl border bg-card shadow-sm">
            <Table className="min-w-max" containerClassName="overflow-auto">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 top-0 z-30 min-w-72 bg-card">Permiso</TableHead>
                  {rolesVisibles.map((rol) => (
                    <TableHead key={rol.rolId} className="sticky top-0 z-20 min-w-40 bg-card text-center">
                      <span className="text-sm font-semibold">{nombreRol(rol.nombre)}</span>
                      <span className="block text-[11px] font-normal text-muted-foreground">{totalPorRol(rol.rolId)} permisos</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasPorModulo.map(([modulo, filas]) => (
                  <Fragment key={modulo}>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableCell colSpan={rolesVisibles.length + 1} className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-sm font-semibold">
                        {nombreModulo(modulo)}
                      </TableCell>
                    </TableRow>
                    {filas.map((fila) => (
                      <TableRow key={fila.codigo}>
                        <TableCell className="sticky left-0 z-10 bg-card">
                          <span className="block text-sm font-medium">{fila.nombre}</span>
                          <span className="block font-mono text-[11px] text-muted-foreground">{fila.codigo}</span>
                        </TableCell>
                        {rolesVisibles.map((rol) => (
                          <TableCell key={`${rol.rolId}-${fila.codigo}`} className="text-center">
                            <Checkbox
                              checked={(borrador[rol.rolId] ?? []).includes(fila.codigo)}
                              disabled={!puedeEditar || cargando}
                              onCheckedChange={() => alternar(rol.rolId, fila.codigo)}
                              aria-label={`${fila.codigo} para ${rol.nombre}`}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="lg:hidden">
            <Label htmlFor="rol-movil" className="mb-1 block text-sm font-medium">
              Rol
            </Label>
            <select
              id="rol-movil"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              value={rolActual ? String(rolActual.rolId) : ""}
              onChange={(evento) => setRolSeleccionado(Number(evento.target.value))}
            >
              {matriz.roles.map((rol) => {
                const cambios = cambiosPorRol(rol.rolId, rol.codigos);
                return (
                  <option key={rol.rolId} value={String(rol.rolId)}>
                    {nombreRol(rol.nombre)} ({totalPorRol(rol.rolId)} activos)
                    {cambios > 0 ? ` · ${cambios} cambio(s)` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <aside aria-label="Roles" className="hidden flex-col gap-2 lg:flex">
            {matriz.roles.map((rol) => {
              const activo = rolActual?.rolId === rol.rolId;
              const cambios = cambiosPorRol(rol.rolId, rol.codigos);
              return (
                <button
                  key={rol.rolId}
                  type="button"
                  onClick={() => setRolSeleccionado(rol.rolId)}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                    activo ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-muted/40"
                  }`}
                  aria-current={activo ? "true" : undefined}
                >
                  <span className="font-semibold">{nombreRol(rol.nombre)}</span>
                  <span className="text-xs text-muted-foreground">
                    {rol.codigos.length} permisos · {totalPorRol(rol.rolId)} activos
                  </span>
                  {cambios > 0 ? <Badge className="w-fit" variant="outline">{cambios} cambio(s)</Badge> : null}
                </button>
              );
            })}
          </aside>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar permiso por nombre o código…"
                aria-label="Buscar permiso"
                className="pl-9"
              />
            </div>

            {rolActual ? (
              <div className="flex flex-col gap-3 pb-28 sm:pb-24">
                {filasPorModulo.map(([modulo, filas]) => {
                  const abierto = buscando || !cerrados.has(modulo);
                  const activosModulo = filas.filter((f) => (borrador[rolActual.rolId] ?? []).includes(f.codigo)).length;
                  return (
                    <section key={modulo} className="rounded-xl border bg-card">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                        <button
                          type="button"
                          onClick={() => alternarModulo(modulo)}
                          aria-expanded={abierto}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
                        >
                          <ChevronDown className={`size-4 shrink-0 transition-transform ${abierto ? "" : "-rotate-90"}`} aria-hidden="true" />
                          <span className="truncate">{nombreModulo(modulo)}</span>
                          <span className="shrink-0 text-xs font-normal text-muted-foreground">
                            {activosModulo}/{filas.length}
                          </span>
                        </button>
                        {puedeEditar ? (
                          <div className="flex shrink-0 gap-1 text-xs">
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => marcarModulo(rolActual.rolId, modulo, true)}>Activar todos</Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => marcarModulo(rolActual.rolId, modulo, false)}>Quitar todos</Button>
                          </div>
                        ) : null}
                      </div>
                      {abierto ? (
                        <ul className="divide-y">
                          {filas.map((fila) => {
                            const marcado = (borrador[rolActual.rolId] ?? []).includes(fila.codigo);
                            return (
                              <li key={fila.codigo} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{fila.nombre}</p>
                                  <p className="font-mono text-[11px] text-muted-foreground">{fila.codigo}</p>
                                </div>
                                <Switch
                                  checked={marcado}
                                  disabled={!puedeEditar || cargando}
                                  onCheckedChange={() => alternar(rolActual.rolId, fila.codigo)}
                                  aria-label={`${fila.nombre} para ${rolActual.nombre}`}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay roles para configurar.</p>
            )}
          </div>

          {rolActual ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 shadow-lg backdrop-blur lg:left-auto lg:right-0 lg:w-[calc(100%-18rem-3rem)]">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-medium">
                  {cambiosActuales > 0 ? `${cambiosActuales} cambio(s) pendiente(s)` : "Sin cambios pendientes"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={cambiosActuales === 0} onClick={() => descartar(rolActual.rolId)}>
                    Descartar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={cambiosActuales === 0 || !puedeEditar}
                    onClick={() => {
                      setMotivo("");
                      setErrorMotivo(null);
                      setRolGuardando(rolActual.rolId);
                    }}
                  >
                    <Save className="size-4" aria-hidden="true" /> Guardar cambios ({cambiosActuales})
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      )}

      <AlertDialog
        open={rolGuardando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setRolGuardando(null);
            setMotivo("");
            setErrorMotivo(null);
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
          <Field data-invalid={!!errorMotivo}>
            <Label htmlFor="motivo-matriz">Motivo</Label>
            <Input
              id="motivo-matriz"
              value={motivo}
              minLength={10}
              maxLength={500}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErrorMotivo(null);
              }}
              placeholder="Mínimo 10 caracteres"
              aria-invalid={!!errorMotivo}
            />
            {errorMotivo && (
              <p role="alert" className="text-sm text-destructive">{errorMotivo}</p>
            )}
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
