"use client";

import { useState } from "react";
import { Palette, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CriterioColor, ReglasColorConfig, SugerenciasReglasColor } from "../../../domain/entities/disenador";
import {
  aplicarColoresAValores,
  cambiarCriterioColor,
  cargarValoresSugeridos,
  quitarTodosLosValores,
  CRITERIOS_COLOR_SOPORTADOS,
  ETIQUETA_VALORES_CRITERIO,
  REGLAS_COLOR_DEFECTO,
  etiquetaSugerencia,
  sugerenciasCriterio,
  type TipoExternoColor,
} from "../../../domain/entities/disenador";

interface DisenadorReglasColorPanelProps {
  reglasColor: ReglasColorConfig;
  onActualizarReglasColor: (
    actualizar: ReglasColorConfig | ((prev: ReglasColorConfig) => ReglasColorConfig)
  ) => void;
  nuevoValorNombre: string;
  onCambiarNuevoValorNombre: (valor: string) => void;
  /** Tipos de credencial externa del catálogo (visitante, contratista...) para sugerir como nómina. */
  tiposExternos?: readonly TipoExternoColor[];
  /** Cargos y oficinas reales (el mismo texto que usa el PDF). */
  sugerenciasReglasColor?: Partial<SugerenciasReglasColor>;
  cargandoSugerencias?: boolean;
}

export function DisenadorReglasColorPanel({
  reglasColor,
  onActualizarReglasColor,
  nuevoValorNombre,
  onCambiarNuevoValorNombre,
  tiposExternos = [],
  sugerenciasReglasColor = {},
  cargandoSugerencias = false,
}: DisenadorReglasColorPanelProps) {
  const [busquedaValor, setBusquedaValor] = useState("");
  const [colorMasivo, setColorMasivo] = useState({ primario: "#1f3a5f", acento: "#1273bd" });
  const [marcados, setMarcados] = useState<string[]>([]);
  const [confirmacion, setConfirmacion] = useState<"todos" | "seleccionados" | "quitar" | null>(
    null,
  );
  const criterio = reglasColor.criterio;
  const entradas = Object.entries(reglasColor.valores);
  const filtradas = busquedaValor.trim()
    ? entradas.filter(([k]) => k.toLowerCase().includes(busquedaValor.trim().toLowerCase()))
    : entradas;
  const sugerencias = sugerenciasCriterio(
    criterio,
    tiposExternos,
    sugerenciasReglasColor,
  ).filter((v) => !(v in reglasColor.valores));
  const soportado = (c: string) => (CRITERIOS_COLOR_SOPORTADOS as readonly string[]).includes(c);

  const marcadosVigentes = marcados.filter((k) => k in reglasColor.valores);
  const todosFiltradosMarcados =
    filtradas.length > 0 && filtradas.every(([k]) => marcadosVigentes.includes(k));
  const alternarMarcado = (clave: string) =>
    setMarcados((prev) =>
      prev.includes(clave) ? prev.filter((k) => k !== clave) : [...prev, clave],
    );
  const alternarFiltrados = () =>
    setMarcados(todosFiltradosMarcados ? [] : filtradas.map(([k]) => k));

  // El editor no guarda historial de reglas: las acciones en bloque piden confirmación.
  const ejecutarConfirmacion = () => {
    if (confirmacion === "todos") {
      onActualizarReglasColor((prev) => aplicarColoresAValores(prev, colorMasivo));
      toast.success("Colores aplicados a todos los valores.");
    } else if (confirmacion === "seleccionados") {
      const claves = marcadosVigentes;
      onActualizarReglasColor((prev) => aplicarColoresAValores(prev, colorMasivo, claves));
      toast.success(`Colores aplicados a ${claves.length} valores.`);
    } else if (confirmacion === "quitar") {
      onActualizarReglasColor((prev) => quitarTodosLosValores(prev));
      setMarcados([]);
      toast.success("Valores quitados: se usará el color de respaldo.");
    }
    setConfirmacion(null);
  };

  const handleAnadirValor = () => {
    if (!nuevoValorNombre.trim()) return;
    onActualizarReglasColor((prev) => ({
      ...prev,
      valores: {
        ...prev.valores,
        [nuevoValorNombre.trim()]: {
          primario: "#1f3a5f",
          acento: "#1273bd",
          texto: "#ffffff",
        },
      },
    }));
    onCambiarNuevoValorNombre("");
    toast.success(`Regla para '${nuevoValorNombre.trim()}' agregada.`);
  };

  const handleEliminarValor = (clave: string) => {
    onActualizarReglasColor((prev) => {
      const copia = { ...prev.valores };
      delete copia[clave];
      return { ...prev, valores: copia };
    });
  };

  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Palette className="size-4 text-primary" />
          Reglas de Color (O44 - E7)
        </CardTitle>
        <p className="text-[11px] text-muted-foreground leading-tight">
          Configura si los colores del carnet cambian por nómina, cargo, oficina o valor único.
        </p>
      </CardHeader>
      <CardContent className="p-3 space-y-4 text-xs">
        {/* Selector de Criterio */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold">Criterio de Color</Label>
          <Select
            value={reglasColor.criterio}
            onValueChange={(val: CriterioColor) =>
              onActualizarReglasColor((prev) => cambiarCriterioColor(prev, val))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unico">Un solo color para todos (Único)</SelectItem>
              <SelectItem value="nomina">Por Tipo de Nómina</SelectItem>
              <SelectItem value="cargo">Por Cargo del Titular</SelectItem>
              <SelectItem value="oficina">Por Oficina / Dependencia</SelectItem>
              <SelectItem value="nivel" disabled={!soportado("nivel") && criterio !== "nivel"}>
                Por Nivel Jerárquico (no disponible en el PDF)
              </SelectItem>
              <SelectItem value="otro" disabled={!soportado("otro") && criterio !== "otro"}>
                Otro Catálogo Personalizado (no disponible en el PDF)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Color de Respaldo Institucional (Fallback) */}
        <div className="space-y-2 p-2.5 rounded-lg border bg-muted/10">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[11px] text-foreground">
              Color de Respaldo (Fallback)
            </span>
            <Badge variant="outline" className="text-[9px]">
              Institucional
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Aplica si el titular no tiene valor tabulado o si el criterio es único.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Primario</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.primario}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, primario: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.primario}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Acento</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.acento}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, acento: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.acento}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Texto</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.texto}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, texto: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.texto}</span>
              </div>
            </div>
          </div>
        </div>

        {!soportado(criterio) && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
            El PDF aún no aplica este criterio: todos los carnets usarán el color de respaldo.
          </p>
        )}

        {/* Tabla de Valores según el Criterio */}
        {reglasColor.criterio !== "unico" && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-semibold">
                {ETIQUETA_VALORES_CRITERIO[criterio]}
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {Object.keys(reglasColor.valores).length} configurados
              </span>
            </div>

            {entradas.length > 0 && (
              <div className="space-y-2 rounded-lg border bg-muted/10 p-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium">
                    Primario
                    <input
                      type="color"
                      aria-label="Color primario para aplicar"
                      className="size-6 cursor-pointer rounded border p-0"
                      value={colorMasivo.primario}
                      onChange={(e) => setColorMasivo((c) => ({ ...c, primario: e.target.value }))}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium">
                    Acento
                    <input
                      type="color"
                      aria-label="Color de acento para aplicar"
                      className="size-6 cursor-pointer rounded border p-0"
                      value={colorMasivo.acento}
                      onChange={(e) => setColorMasivo((c) => ({ ...c, acento: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-auto min-h-9 w-full whitespace-normal py-1.5 text-xs leading-tight"
                    onClick={() => setConfirmacion("todos")}
                  >
                    Aplicar a todos
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-auto min-h-9 w-full whitespace-normal py-1.5 text-xs leading-tight"
                    disabled={marcadosVigentes.length === 0}
                    onClick={() => setConfirmacion("seleccionados")}
                  >
                    Aplicar a seleccionados ({marcadosVigentes.length})
                  </Button>
                </div>
              </div>
            )}

            {entradas.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar…"
                  aria-label="Buscar valor"
                  className="h-9 pl-7 text-xs"
                  value={busquedaValor}
                  onChange={(e) => setBusquedaValor(e.target.value)}
                />
              </div>
            )}

            {filtradas.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium">
                  <Checkbox
                    checked={todosFiltradosMarcados}
                    onCheckedChange={alternarFiltrados}
                    aria-label="Seleccionar todos los filtrados"
                  />
                  Seleccionar todos los filtrados
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmacion("quitar")}
                >
                  Quitar todos
                </Button>
              </div>
            )}

            {entradas.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Aún no hay valores para este criterio; añada abajo los que necesite.
              </p>
            )}

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {filtradas.map(([clave, cols]) => (
                <div
                  key={clave}
                  className="p-1.5 rounded border bg-card flex items-center justify-between gap-1 text-[11px]"
                >
                  <label className="flex min-w-0 items-center gap-1.5">
                    <Checkbox
                      checked={marcadosVigentes.includes(clave)}
                      onCheckedChange={() => alternarMarcado(clave)}
                      aria-label={`Seleccionar ${clave}`}
                    />
                    <span className="max-w-[110px] truncate font-medium" title={clave}>
                      {clave}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1" title="Color Primario">
                      <input
                        type="color"
                        className="size-5 rounded border cursor-pointer p-0"
                        value={cols.primario}
                        onChange={(e) => {
                          const val = e.target.value;
                          onActualizarReglasColor((prev) => ({
                            ...prev,
                            valores: {
                              ...prev.valores,
                              [clave]: { ...cols, primario: val },
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1" title="Color de Acento">
                      <input
                        type="color"
                        className="size-5 rounded border cursor-pointer p-0"
                        value={cols.acento}
                        onChange={(e) => {
                          const val = e.target.value;
                          onActualizarReglasColor((prev) => ({
                            ...prev,
                            valores: {
                              ...prev.valores,
                              [clave]: { ...cols, acento: val },
                            },
                          }));
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-5 text-muted-foreground hover:text-destructive"
                      onClick={() => handleEliminarValor(clave)}
                      title="Quitar regla"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar nuevo valor de regla */}
            {cargandoSugerencias && (
              <p className="text-[10px] text-muted-foreground">Cargando sugerencias…</p>
            )}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <Input
                placeholder={criterio === "nomina" ? "Nuevo valor (ej. Pasante)" : "Nuevo valor (ej. Analista)"}
                list="sugerencias-criterio-color"
                className="h-7 min-w-[110px] flex-1 text-xs"
                value={nuevoValorNombre}
                onChange={(e) => onCambiarNuevoValorNombre(e.target.value)}
              />
              <datalist id="sugerencias-criterio-color">
                {sugerencias.map((v) => (
                  <option key={v} value={v} label={etiquetaSugerencia(v, tiposExternos) ?? undefined} />
                ))}
              </datalist>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 shrink-0"
                disabled={cargandoSugerencias || sugerencias.length === 0}
                title="Añadir todos los valores sugeridos con el color de respaldo"
                onClick={() => {
                  onActualizarReglasColor((prev) => cargarValoresSugeridos(prev, sugerencias));
                  toast.success(
                    `${sugerencias.length} valores cargados con el color de respaldo.`,
                  );
                }}
              >
                {cargandoSugerencias ? "Cargando…" : `Cargar todos (${sugerencias.length})`}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[11px] px-2 shrink-0"
                onClick={handleAnadirValor}
              >
                <Plus className="size-3 mr-1" /> Añadir
              </Button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={() => {
              onActualizarReglasColor(REGLAS_COLOR_DEFECTO);
              toast.info(
                "Reglas restablecidas a los valores institucionales (Funcionario azul marino)."
              );
            }}
          >
            Restablecer reglas iniciales
          </Button>
        </div>
        <AlertDialog
          open={confirmacion !== null}
          onOpenChange={(abierto) => !abierto && setConfirmacion(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmacion === "quitar"
                  ? "¿Quitar todos los valores?"
                  : "¿Aplicar esta combinación?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmacion === "quitar"
                  ? "Los valores quedarán sin regla y se usará el color de respaldo."
                  : confirmacion === "seleccionados"
                    ? `Se cambiarán los colores primario y de acento de ${marcadosVigentes.length} valores.`
                    : `Se cambiarán los colores primario y de acento de los ${entradas.length} valores.`}{" "}
                No se guarda hasta pulsar Guardar Borrador.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={ejecutarConfirmacion}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
