"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  AlertTriangle,
  Database,
  Filter,
  Info,
  Loader2,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampoCredencial, GrupoCampo } from "../../domain/entities/carnet";
import {
  crearCampoPersonalizadoAction,
  eliminarCampoPersonalizadoAction,
  getCamposAction,
} from "../../infrastructure/actions/carnetizacion-actions";

const GRUPOS_ORDENADOS: { clave: GrupoCampo; titulo: string; descripcion: string }[] = [
  {
    clave: "identificacion",
    titulo: "Identificación del Titular",
    descripcion: "Datos primarios de filiación e identidad institucional.",
  },
  {
    clave: "laboral",
    titulo: "Datos Laborales y Estructura",
    descripcion: "Información contractual, cargo, nómina y unidad administrativa.",
  },
  {
    clave: "salud_emergencia",
    titulo: "Salud y Contactos de Emergencia",
    descripcion: "Datos médicos críticos para primeros auxilios (Información Sensible).",
  },
  {
    clave: "emision",
    titulo: "Control de Emisión y Vigencia",
    descripcion: "Fechas de expedición y vencimiento de la credencial física.",
  },
  {
    clave: "personalizado",
    titulo: "Campos Personalizados Institucionales",
    descripcion: "Variables creadas a la medida por la administración del sistema.",
  },
];

export function RegistroCamposTab() {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("trabajador");
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estados modal nuevo campo
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState<GrupoCampo>("personalizado");
  const [nuevoTipo, setNuevoTipo] = useState<string>("todos");
  const [nuevoSensible, setNuevoSensible] = useState(false);
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevoValorEjemplo, setNuevoValorEjemplo] = useState("");

  // Estado eliminación
  const [campoAEliminar, setCampoAEliminar] = useState<CampoCredencial | null>(null);

  const {
    data: respuestaCampos,
    isLoading,
    mutate,
  } = useSWR(["registro-campos", tipoSeleccionado], () => getCamposAction(tipoSeleccionado));

  const campos: CampoCredencial[] =
    respuestaCampos && respuestaCampos.success ? respuestaCampos.data : [];

  const handleCrearCampo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoCodigo.trim() || !nuevaEtiqueta.trim()) {
      toast.error("El código y la etiqueta son obligatorios.");
      return;
    }

    startTransition(async () => {
      const res = await crearCampoPersonalizadoAction({
        codigo: nuevoCodigo.trim().toLowerCase(),
        etiqueta: nuevaEtiqueta.trim(),
        grupo: nuevoGrupo,
        tipo_credencial: nuevoTipo,
        sensible: nuevoSensible,
        descripcion: nuevaDescripcion.trim(),
        valor_ejemplo: nuevoValorEjemplo.trim(),
      });

      if (res.success) {
        toast.success(`Campo '${res.data.etiqueta}' registrado exitosamente.`);
        setModalNuevoOpen(false);
        setNuevoCodigo("");
        setNuevaEtiqueta("");
        setNuevoSensible(false);
        setNuevaDescripcion("");
        setNuevoValorEjemplo("");
        mutate();
      } else {
        toast.error(res.error || "No fue posible registrar el campo.");
      }
    });
  };

  const ejecutarEliminacion = () => {
    if (!campoAEliminar) return;
    startTransition(async () => {
      const res = await eliminarCampoPersonalizadoAction(campoAEliminar.codigo);
      if (res.success) {
        toast.success(`Campo '${campoAEliminar.etiqueta}' eliminado.`);
        setCampoAEliminar(null);
        mutate();
      } else {
        toast.error(res.error || "No fue posible eliminar el campo.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtro y Creación */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-muted-foreground mr-1" />
          <span className="text-sm font-medium text-muted-foreground mr-2">Tipo de Credencial:</span>
          <Button
            variant={tipoSeleccionado === "trabajador" ? "default" : "outline"}
            size="sm"
            onClick={() => setTipoSeleccionado("trabajador")}
          >
            Trabajador Activo
          </Button>
          <Button
            variant={tipoSeleccionado === "pasivo" ? "default" : "outline"}
            size="sm"
            onClick={() => setTipoSeleccionado("pasivo")}
          >
            Pasivo / Jubilado
          </Button>
        </div>

        <Button
          onClick={() => setModalNuevoOpen(true)}
          className="gap-2 shrink-0"
          size="sm"
        >
          <PlusCircle className="size-4" />
          Nuevo Campo Personalizado
        </Button>
      </div>

      {/* Banner de Advertencia de Datos Sensibles */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-sm">
        <ShieldAlert className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div>
          <h4 className="font-semibold text-sm leading-tight">Política de Datos Sensibles en Carnets</h4>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Los datos marcados como <span className="font-semibold underline">Sensibles</span> (Cédula, Nacimiento, Tipo de Sangre, Alergias y Contactos de Emergencia) quedarán impresos a la vista en la credencial física. El diseñador Konva alertará antes de emitirlos.
          </p>
        </div>
      </div>

      {/* Lista Agrupada de Campos */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {GRUPOS_ORDENADOS.map((grupo) => {
            const camposDelGrupo = campos.filter((c) => c.grupo === grupo.clave);
            if (camposDelGrupo.length === 0 && grupo.clave !== "personalizado") return null;

            return (
              <Card key={grupo.clave} className="shadow-xs border overflow-hidden">
                <CardHeader className="bg-muted/20 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{grupo.titulo}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {grupo.descripcion}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {camposDelGrupo.length} campos
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0 divide-y">
                  {camposDelGrupo.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No hay campos personalizados registrados aún. Pulsa «Nuevo Campo Personalizado» para agregar variables dinámicas.
                    </div>
                  ) : (
                    camposDelGrupo.map((campo) => (
                      <div
                        key={campo.codigo}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {campo.etiqueta}
                            </span>
                            <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0">
                              {`{{${campo.codigo}}}`}
                            </Badge>
                            {campo.sensible && (
                              <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[10px] gap-1 px-1.5 py-0">
                                <AlertTriangle className="size-3" />
                                Dato Sensible
                              </Badge>
                            )}
                            {campo.es_personalizado ? (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                                Personalizado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Expediente
                              </Badge>
                            )}
                          </div>
                          {campo.descripcion && (
                            <p className="text-xs text-muted-foreground">{campo.descripcion}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                          <div className="text-right">
                            <span className="text-[11px] text-muted-foreground block">Ejemplo:</span>
                            <span className="text-xs font-medium text-foreground bg-muted/40 px-2 py-0.5 rounded border inline-block max-w-[200px] truncate">
                              {campo.valor_ejemplo || "—"}
                            </span>
                          </div>

                          {campo.es_personalizado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                              onClick={() => setCampoAEliminar(campo)}
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- DIALOG DE CREACIÓN DE CAMPO PERSONALIZADO --- */}
      <Dialog open={modalNuevoOpen} onOpenChange={setModalNuevoOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCrearCampo}>
            <DialogHeader>
              <DialogTitle>Nuevo Campo Personalizado</DialogTitle>
              <DialogDescription>
                Define una variable para insertar en las capas del diseñador de credenciales.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="campo-codigo">Código Slug</Label>
                  <Input
                    id="campo-codigo"
                    placeholder="ej: matricula_interna"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Solo minúsculas y _</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campo-etiqueta">Etiqueta Visible</Label>
                  <Input
                    id="campo-etiqueta"
                    placeholder="ej: Matrícula Interna"
                    value={nuevaEtiqueta}
                    onChange={(e) => setNuevaEtiqueta(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Grupo</Label>
                  <Select value={nuevoGrupo} onValueChange={(val: GrupoCampo) => setNuevoGrupo(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="identificacion">Identificación</SelectItem>
                      <SelectItem value="laboral">Laboral</SelectItem>
                      <SelectItem value="salud_emergencia">Salud y Emergencia</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de Credencial</Label>
                  <Select value={nuevoTipo} onValueChange={setNuevoTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los tipos</SelectItem>
                      <SelectItem value="trabajador">Solo Trabajador</SelectItem>
                      <SelectItem value="pasivo">Solo Pasivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campo-ejemplo">Valor de Muestra / Ejemplo</Label>
                <Input
                  id="campo-ejemplo"
                  placeholder="ej: MI-90214"
                  value={nuevoValorEjemplo}
                  onChange={(e) => setNuevoValorEjemplo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="campo-desc">Descripción (Opcional)</Label>
                <Input
                  id="campo-desc"
                  placeholder="ej: Número de matrícula de activo fijo"
                  value={nuevaDescripcion}
                  onChange={(e) => setNuevaDescripcion(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t">
                <input
                  type="checkbox"
                  id="campo-sensible"
                  checked={nuevoSensible}
                  onChange={(e) => setNuevoSensible(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                />
                <Label htmlFor="campo-sensible" className="text-xs cursor-pointer">
                  Marcar como <span className="font-semibold text-amber-700 dark:text-amber-400">Dato Sensible</span> (alertará al diseñador antes de imprimirlo)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNuevoOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !nuevoCodigo || !nuevaEtiqueta} className="gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Registrar Campo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL CONFIRMACIÓN DE ELIMINACIÓN --- */}
      <Dialog open={!!campoAEliminar} onOpenChange={(open) => !open && setCampoAEliminar(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar campo personalizado?</DialogTitle>
            <DialogDescription>
              Se eliminará el campo <span className="font-semibold text-foreground">{campoAEliminar?.etiqueta}</span>. Las plantillas que utilicen esta variable dejarán de resolver su valor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCampoAEliminar(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={ejecutarEliminacion}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Eliminar Campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
