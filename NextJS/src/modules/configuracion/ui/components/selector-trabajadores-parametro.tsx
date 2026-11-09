"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search, UserCheck, UserX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TrabajadorParametroDTO } from "../../application/dtos/parametro-dto";
import { buscarTrabajadoresParametroAction } from "../../infrastructure/actions/parametros-actions";

interface SelectorTrabajadoresParametroProps {
  valor: string;
  onChange: (nuevoValor: string) => void;
  disabled?: boolean;
}

export function SelectorTrabajadoresParametro({
  valor,
  onChange,
  disabled = false,
}: SelectorTrabajadoresParametroProps) {
  const inputId = useId();
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<TrabajadorParametroDTO[]>([]);
  const [trabajadoresConocidos, setTrabajadoresConocidos] = useState<
    Record<string, { nombre: string; activa: boolean }>
  >({});
  const [isSearching, startSearch] = useTransition();
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);

  const cedulasSeleccionadas = useMemo(
    () =>
      valor
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    [valor],
  );

  // Cargar nombres de cédulas seleccionadas que no conocemos aún
  useEffect(() => {
    const pendientes = cedulasSeleccionadas.filter((c) => !trabajadoresConocidos[c]);
    if (pendientes.length === 0) return;

    let cancelado = false;
    buscarTrabajadoresParametroAction(undefined, pendientes)
      .then((res) => {
        if (cancelado || !Array.isArray(res)) return;
        setTrabajadoresConocidos((prev) => {
          const copia = { ...prev };
          for (const t of res) {
            copia[t.cedula] = { nombre: t.nombre, activa: t.cuenta_activa };
          }
          return copia;
        });
      })
      .catch(() => {
        // En caso de error de red, se mantiene la cédula visible
      });

    return () => {
      cancelado = true;
    };
  }, [cedulasSeleccionadas, trabajadoresConocidos]);

  // Búsqueda interactiva con debounce
  useEffect(() => {
    const termino = busqueda.trim();
    // El desplegable solo se muestra con 2+ caracteres; no hace falta vaciar
    // resultados dentro del efecto (CORTE-1: sin setState sincrónico).
    if (!termino || termino.length < 2) return;

    const timer = setTimeout(() => {
      startSearch(async () => {
        try {
          const res = await buscarTrabajadoresParametroAction(termino);
          if (Array.isArray(res)) {
            setResultados(res);
            setTrabajadoresConocidos((prev) => {
              const copia = { ...prev };
              for (const t of res) {
                copia[t.cedula] = { nombre: t.nombre, activa: t.cuenta_activa };
              }
              return copia;
            });
          }
        } catch {
          setResultados([]);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [busqueda]);

  function agregar(t: TrabajadorParametroDTO) {
    if (!t.cuenta_activa) return;
    if (cedulasSeleccionadas.includes(t.cedula)) return;
    const nuevas = [...cedulasSeleccionadas, t.cedula];
    onChange(nuevas.join(","));
    setBusqueda("");
    setBusquedaAbierta(false);
  }

  function quitar(cedula: string) {
    const nuevas = cedulasSeleccionadas.filter((c) => c !== cedula);
    onChange(nuevas.join(","));
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* Buscador de trabajadores */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            id={inputId}
            type="text"
            value={busqueda}
            disabled={disabled}
            placeholder="Buscar trabajador por nombre o cédula…"
            className="h-10 pl-9 pr-8 bg-white"
            onFocus={() => setBusquedaAbierta(true)}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setBusquedaAbierta(true);
            }}
          />
          {isSearching && (
            <Loader2 className="pointer-events-none absolute right-3 size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Desplegable de resultados */}
        {busquedaAbierta && busqueda.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
            {resultados.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                {isSearching ? "Buscando…" : "No se encontraron trabajadores con ese criterio."}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {resultados.map((t) => {
                  const yaAgregado = cedulasSeleccionadas.includes(t.cedula);
                  const deshabilitado = yaAgregado || !t.cuenta_activa;
                  return (
                    <li key={t.cedula}>
                      <button
                        type="button"
                        disabled={deshabilitado}
                        onClick={() => agregar(t)}
                        className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                          deshabilitado
                            ? "cursor-not-allowed opacity-60 bg-muted/30"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {t.cuenta_activa ? (
                            <UserCheck className="size-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <UserX className="size-3.5 text-destructive shrink-0" />
                          )}
                          <div>
                            <span className="font-medium text-foreground">{t.nombre}</span>
                            <span className="ml-1.5 text-muted-foreground">V-{t.cedula}</span>
                          </div>
                        </div>
                        <div>
                          {yaAgregado ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                              <Check className="size-3" /> Agregado
                            </span>
                          ) : !t.cuenta_activa ? (
                            <span className="text-[11px] text-destructive">Sin cuenta activa</span>
                          ) : (
                            <span className="text-[11px] font-medium text-emerald-600">+ Agregar</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t p-1 text-right">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setBusquedaAbierta(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Chips de seleccionados */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {cedulasSeleccionadas.length === 0
              ? "Ningún trabajador seleccionado"
              : `${cedulasSeleccionadas.length} ${
                  cedulasSeleccionadas.length === 1
                    ? "trabajador seleccionado"
                    : "trabajadores seleccionados"
                }`}
          </span>
          <span className="text-[11px] text-muted-foreground/80">
            Solo trabajadores con cuenta activa
          </span>
        </div>

        {cedulasSeleccionadas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input/60 bg-muted/20 p-2 min-h-12">
            {cedulasSeleccionadas.map((cedula) => {
              const info = trabajadoresConocidos[cedula];
              const nombre = info?.nombre || "Cargando…";
              return (
                <Badge
                  key={cedula}
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs font-normal bg-background border shadow-xs"
                >
                  <span className="font-medium text-foreground">{nombre}</span>
                  <span className="text-muted-foreground">({cedula})</span>
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={`Quitar ${nombre} (${cedula})`}
                      onClick={() => quitar(cedula)}
                      className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive focus:outline-none"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
