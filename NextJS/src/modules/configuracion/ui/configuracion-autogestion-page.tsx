"use client";

/**
 * O12: solicitudes de actualización configurables por condición del trabajador.
 * Dos bloques (ACTIVOS / PASIVOS) con interruptor y checklist de secciones. Los
 * valores son parámetros del sistema: cada guardado queda versionado y auditado.
 */
import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CheckCheck, CreditCard, ExternalLink, Save } from "lucide-react";
import Link from "next/link";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { RUTA_PARAMETROS } from "@/shared/lib/administracion-sistema";
import { SECCIONES_DEF } from "@/modules/autogestion/domain/value-objects/campos-seccion";

import type { ParametroDTO } from "../application/dtos/parametro-dto";
import {
  actualizarParametroAction,
  listarParametrosAction,
} from "../infrastructure/actions/parametros-actions";
import {
  CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
  CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
  CLAVES_AUTOGESTION,
} from "../domain/value-objects/claves-parametros";
import { PERMISO_CONFIGURACION } from "../domain/value-objects/permisos-configuracion";
import { SelectorTrabajadoresParametro } from "./components/selector-trabajadores-parametro";

const SECCIONES = Object.values(SECCIONES_DEF).map((seccion) => ({
  codigo: seccion.codigo,
  nombre: seccion.nombre,
}));

type Condicion = "ACTIVOS" | "PASIVOS";

interface Bloque {
  habilitado: boolean;
  secciones: string[];
}

const CLAVES: Record<Condicion, { habilitado: string; secciones: string }> = {
  ACTIVOS: {
    habilitado: CLAVES_AUTOGESTION.activosHabilitado,
    secciones: CLAVES_AUTOGESTION.activosSecciones,
  },
  PASIVOS: {
    habilitado: CLAVES_AUTOGESTION.pasivosHabilitado,
    secciones: CLAVES_AUTOGESTION.pasivosSecciones,
  },
};

function separarSecciones(valor: string): string[] {
  return valor
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function bloqueDesde(parametros: ParametroDTO[], condicion: Condicion): Bloque {
  const claves = CLAVES[condicion];
  const habilitado = parametros.find((p) => p.clave === claves.habilitado)?.valor === "true";
  const secciones = separarSecciones(
    parametros.find((p) => p.clave === claves.secciones)?.valor ?? "",
  );
  return {
    habilitado,
    secciones: secciones.length ? secciones : SECCIONES.map((s) => s.codigo),
  };
}

export function ConfiguracionAutogestionPage() {
  const { data: session } = useSession();
  const puedeEditar = tienePermiso(session?.user?.permisos, PERMISO_CONFIGURACION.editar);
  const { data, isLoading, mutate } = useSWR("parametros-sistema", listarParametrosAction);

  const parametros = useMemo<ParametroDTO[]>(
    () => (Array.isArray(data) ? data : []),
    [data],
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  function guardar(condicion: Condicion, bloque: Bloque) {
    const claves = CLAVES[condicion];
    setError(null);
    iniciarGuardado(async () => {
      const habilitado = await actualizarParametroAction(
        claves.habilitado,
        bloque.habilitado ? "true" : "false",
      );
      if (habilitado && typeof habilitado === "object" && "error" in habilitado) {
        setError(habilitado.error);
        toast.error(habilitado.error);
        return;
      }
      const secciones = await actualizarParametroAction(
        claves.secciones,
        bloque.secciones.join(","),
      );
      if (secciones && typeof secciones === "object" && "error" in secciones) {
        setError(secciones.error);
        toast.error(secciones.error);
        return;
      }
      toast.success(
        condicion === "ACTIVOS"
          ? "Configuración de trabajadores activos guardada."
          : "Configuración de trabajadores pasivos guardada.",
      );
      await mutate();
    });
  }

  return (
    <PageLayout
      title="Solicitudes de actualización"
      description="Defina para qué condiciones está abierto el flujo y qué secciones puede pedir cada trabajador."
    >
      {!puedeEditar ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          No tiene el permiso «{PERMISO_CONFIGURACION.editar}» para editar la configuración.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-44 w-full lg:col-span-2" />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["ACTIVOS", "PASIVOS"] as const).map((condicion) => (
            <BloqueCondicion
              // Al recargar los parámetros se reinicia el borrador local.
              key={`${condicion}-${parametros.map((p) => p.valor).join("|")}`}
              condicion={condicion}
              inicial={bloqueDesde(parametros, condicion)}
              puedeEditar={puedeEditar}
              guardando={guardando}
              onGuardar={guardar}
            />
          ))}

          {/* Tarjeta de configuración de Mi carnet (Punto 16) */}
          <BloqueMiCarnet
            // Al recargar los parámetros se reinicia el borrador local.
            key={`carnet-${parametros.map((p) => `${p.clave}=${p.valor}`).join("|")}`}
            parametros={parametros}
            puedeEditar={puedeEditar}
            guardando={guardando}
            onGuardado={async () => {
              await mutate();
            }}
          />
        </div>
      )}
    </PageLayout>
  );
}

function BloqueMiCarnet({
  parametros,
  puedeEditar,
  guardando,
  onGuardado,
}: {
  parametros: ParametroDTO[];
  puedeEditar: boolean;
  guardando: boolean;
  onGuardado: () => Promise<void>;
}) {
  const paramAlcance = parametros.find((p) => p.clave === CLAVE_CARNETIZACION_MI_CARNET_ALCANCE);
  const paramUsuarios = parametros.find((p) => p.clave === CLAVE_CARNETIZACION_MI_CARNET_USUARIOS);

  const [alcance, setAlcance] = useState(paramAlcance?.valor ?? "nadie");
  const [usuarios, setUsuarios] = useState(paramUsuarios?.valor ?? "");
  const [error, setError] = useState<string | null>(null);
  const [salvando, iniciarSalvado] = useTransition();

  function guardarCarnet() {
    setError(null);
    if (alcance === "usuarios_especificos" && !usuarios.trim()) {
      setError("Debe seleccionar al menos un trabajador para el alcance de usuarios específicos.");
      toast.error("Seleccione al menos un trabajador.");
      return;
    }
    iniciarSalvado(async () => {
      const resAlcance = await actualizarParametroAction(
        CLAVE_CARNETIZACION_MI_CARNET_ALCANCE,
        alcance,
      );
      if (resAlcance && typeof resAlcance === "object" && "error" in resAlcance) {
        setError(resAlcance.error);
        toast.error(resAlcance.error);
        return;
      }
      if (alcance === "usuarios_especificos") {
        const resUsuarios = await actualizarParametroAction(
          CLAVE_CARNETIZACION_MI_CARNET_USUARIOS,
          usuarios,
        );
        if (resUsuarios && typeof resUsuarios === "object" && "error" in resUsuarios) {
          setError(resUsuarios.error);
          toast.error(resUsuarios.error);
          return;
        }
      }
      toast.success("Configuración de Credencial Digital (Mi carnet) guardada.");
      await onGuardado();
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5 text-primary" aria-hidden="true" />
              <span>Credencial Digital (Mi carnet)</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure qué trabajadores tienen acceso a ver y solicitar su credencial digital en el portal de Autogestión.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5 h-9 text-xs">
            <Link href={RUTA_PARAMETROS}>
              <ExternalLink className="size-3.5" />
              Ver en Parámetros del sistema
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Label htmlFor="selector-alcance-carnet" className="text-base font-medium min-w-44">
            Alcance de visibilidad
          </Label>
          <div className="w-full sm:w-80">
            <Select
              value={alcance}
              disabled={!puedeEditar || guardando || salvando}
              onValueChange={(val) => {
                setError(null);
                setAlcance(val);
              }}
            >
              <SelectTrigger id="selector-alcance-carnet" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nadie">Nadie (desactivado)</SelectItem>
                <SelectItem value="todos">Todos los trabajadores (activos y pasivos)</SelectItem>
                <SelectItem value="activos">Solo trabajadores activos</SelectItem>
                <SelectItem value="pasivos">Solo trabajadores pasivos</SelectItem>
                <SelectItem value="usuarios_especificos">Usuarios específicos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {alcance === "usuarios_especificos" && (
          <div className="pl-0 sm:pl-48 space-y-2">
            <Label className="text-sm font-medium">Trabajadores autorizados</Label>
            <div className="max-w-2xl">
              <SelectorTrabajadoresParametro
                valor={usuarios}
                disabled={!puedeEditar || guardando || salvando}
                onChange={(nuevo) => {
                  setError(null);
                  setUsuarios(nuevo);
                }}
              />
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end pt-2 border-t">
          <Button
            type="button"
            disabled={!puedeEditar || guardando || salvando}
            onClick={guardarCarnet}
          >
            <Save aria-hidden="true" /> {salvando ? "Guardando…" : "Guardar credencial digital"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BloqueCondicion({
  condicion,
  inicial,
  puedeEditar,
  guardando,
  onGuardar,
}: {
  condicion: Condicion;
  inicial: Bloque;
  puedeEditar: boolean;
  guardando: boolean;
  onGuardar: (condicion: Condicion, bloque: Bloque) => void;
}) {
  const [bloque, setBloque] = useState<Bloque>(inicial);
  const [error, setError] = useState<string | null>(null);

  function cambiar(cambio: Partial<Bloque>) {
    setError(null);
    setBloque((previo) => ({ ...previo, ...cambio }));
  }

  function alternarSeccion(codigo: string) {
    const secciones = bloque.secciones.includes(codigo)
      ? bloque.secciones.filter((c) => c !== codigo)
      : [...bloque.secciones, codigo];
    if (secciones.length === 0) {
      setError("Debe dejar al menos una sección habilitada por condición.");
      return;
    }
    cambiar({ secciones });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span>{condicion === "ACTIVOS" ? "Trabajadores activos" : "Trabajadores pasivos"}</span>
          <span className="flex items-center gap-2 text-sm font-normal">
            <Label htmlFor={`habilitado-${condicion}`} className="cursor-pointer">
              Permitir solicitudes
            </Label>
            <Switch
              id={`habilitado-${condicion}`}
              checked={bloque.habilitado}
              disabled={!puedeEditar || guardando}
              onCheckedChange={(marcado) => cambiar({ habilitado: marcado })}
            />
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {bloque.habilitado
            ? "El trabajador puede crear solicitudes nuevas con las secciones marcadas."
            : "No puede crear solicitudes nuevas. Las que ya están en curso siguen su tramitación."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-medium">Secciones permitidas</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!puedeEditar || guardando}
            onClick={() => cambiar({ secciones: SECCIONES.map((s) => s.codigo) })}
          >
            <CheckCheck aria-hidden /> Todas
          </Button>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECCIONES.map((seccion) => (
            <li key={seccion.codigo}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1 text-sm hover:bg-accent/40">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={bloque.secciones.includes(seccion.codigo)}
                  disabled={!puedeEditar || guardando}
                  onChange={() => alternarSeccion(seccion.codigo)}
                />
                <span>{seccion.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">
            {bloque.secciones.length} de {SECCIONES.length} secciones
          </p>
          <Button
            type="button"
            disabled={!puedeEditar || guardando}
            onClick={() => onGuardar(condicion, bloque)}
          >
            <Save aria-hidden /> {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
