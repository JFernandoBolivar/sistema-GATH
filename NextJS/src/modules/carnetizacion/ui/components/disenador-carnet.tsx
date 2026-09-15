"use client";

/**
 * Diseñador visual de carnet institucional con vista previa en vivo (Fase 2.3).
 * Réplica funcional de la experiencia del legado (`carnetizacion/generar/page.tsx`):
 * - Edición reactiva del nombre del titular con debounce.
 * - Carga interactiva de la fotografía en el cliente con previsualización inmediata.
 * - Renderizado en vivo del carnet con proporciones físicas CR80.
 * - Respeta las 4 capas de la arquitectura Onion y opera con DTOs (R5, R8).
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  FileDown,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Upload,
  User,
} from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
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

import type { CarnetDTO, DatosCarnetEmpleadoDTO, PlantillaCarnetDTO } from "../../application/dtos/carnet-dto";
import { truncarNombre } from "../../application/use-cases/disenar-carnet";
import { CarnetVistaPrevia } from "./carnet-vista-previa";
import {
  buscarEmpleadoParaCarnetAction,
  descargarPdfCarnetAction,
  emitirCarnetAction,
} from "../../infrastructure/actions/carnetizacion-actions";

export interface DisenadorCarnetProps {
  plantillas: PlantillaCarnetDTO[];
  onCarnetEmitido?: (carnet: CarnetDTO) => void;
  initialCedula?: string;
}

const MOTIVOS_PREDETERMINADOS = [
  { id: 1, nombre: "1 - Emisión Inicial / Nuevo Ingreso" },
  { id: 2, nombre: "2 - Deterioro de Carnet" },
  { id: 3, nombre: "3 - Pérdida o Extravío" },
  { id: 4, nombre: "4 - Actualización de Cargo / Datos" },
  { id: 5, nombre: "5 - Renovación Institucional" },
];

export function DisenadorCarnet({
  plantillas,
  onCarnetEmitido,
  initialCedula = "",
}: DisenadorCarnetProps) {
  const [cedulaInput, setCedulaInput] = useState<string>(initialCedula);
  const [cedulaActiva, setCedulaActiva] = useState<string>(initialCedula);
  const [nombre, setNombre] = useState<string>("");
  const [nombreDebounced, setNombreDebounced] = useState<string>("");
  const [codigo, setCodigo] = useState<string>("");
  const [cargo, setCargo] = useState<string>("");
  const [departamento, setDepartamento] = useState<string>("");
  const [motivoId, setMotivoId] = useState<number>(1);
  const [observaciones, setObservaciones] = useState<string>("");
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<number | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoNombre, setFotoNombre] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [carnetEmitido, setCarnetEmitido] = useState<CarnetDTO | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce reactivo para la actualización en vivo del nombre (500ms al igual que el legado)
  useEffect(() => {
    const timer = setTimeout(() => {
      setNombreDebounced(nombre);
    }, 400);
    return () => clearTimeout(timer);
  }, [nombre]);

  // Si se provee cédula inicial, disparar búsqueda
  useEffect(() => {
    if (initialCedula && initialCedula.trim()) {
      setCedulaInput(initialCedula.trim());
      cargarEmpleado(initialCedula.trim());
    }
  }, [initialCedula]);

  // Determinar plantilla activa
  const plantillaActiva = useMemo(() => {
    if (plantillaSeleccionadaId) {
      const encontrada = plantillas.find((p) => p.id === plantillaSeleccionadaId);
      if (encontrada) return encontrada;
    }
    return plantillas.find((p) => p.activo) ?? plantillas[0] ?? null;
  }, [plantillas, plantillaSeleccionadaId]);

  const cargarEmpleado = async (ci: string) => {
    if (!ci.trim()) return;
    setIsSearching(true);
    setError(null);
    setExito(null);
    try {
      const res = await buscarEmpleadoParaCarnetAction(ci.trim());
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      if (res) {
        const emp = res as DatosCarnetEmpleadoDTO;
        setCedulaActiva(emp.cedula);
        const nombreAjustado = truncarNombre(emp.nombreCompleto);
        setNombre(nombreAjustado);
        setNombreDebounced(nombreAjustado);
        setCodigo(emp.codigo || "");
        setCargo(emp.cargo || "");
        setDepartamento(emp.departamento || "");
        if (emp.fotoUrl) {
          setFotoUrl(emp.fotoUrl);
          setFotoNombre("Fotografía de expediente");
        }
        setExito(`Datos de ${emp.nombreCompleto} cargados correctamente.`);
      }
    } catch {
      setError("No fue posible consultar los datos del trabajador.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    cargarEmpleado(cedulaInput);
  };

  // Carga interactiva de fotografía en el cliente con previsualización inmediata
  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado debe ser una imagen válida.");
      return;
    }
    setError(null);
    setFotoNombre(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarFoto = () => {
    setFotoUrl(null);
    setFotoNombre(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  // Envío final contra la Server Action del módulo
  const handleEmitir = () => {
    const cedulaFinal = (cedulaActiva || cedulaInput).trim();
    if (!cedulaFinal) {
      setError("Debe especificar la cédula del trabajador.");
      return;
    }
    if (!nombre.trim()) {
      setError("El nombre del titular no puede estar vacío.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setExito(null);
      try {
        const resultado = await emitirCarnetAction(cedulaFinal, motivoId, observaciones);
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          return;
        }
        const carnet = resultado as CarnetDTO;
        setCarnetEmitido(carnet);
        setExito(`Carnet #${carnet.id} emitido exitosamente.`);
        onCarnetEmitido?.(carnet);
      } catch {
        setError("Error al emitir el carnet en el servidor.");
      }
    });
  };

  const handleDescargarPdf = (carnetId: number) => {
    startTransition(async () => {
      setError(null);
      try {
        const blob = await descargarPdfCarnetAction(carnetId);
        if (!(blob instanceof Blob)) {
          setError((blob as { error: string }).error ?? "Error al descargar el PDF.");
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `carnet-${cedulaActiva || carnetId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        setError("No fue posible descargar el archivo PDF.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {exito && (
        <div role="status" className="rounded-md border border-emerald-500/20 bg-emerald-50 p-3 text-sm text-emerald-700">
          {exito}
        </div>
      )}

      {carnetEmitido && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                ¡Carnet #{carnetEmitido.id} emitido para {carnetEmitido.empleadoNombres} {carnetEmitido.empleadoApellidos}!
              </p>
              <p className="text-xs text-emerald-700">
                Hash de autenticidad: <code className="font-mono">{carnetEmitido.securityHash.slice(0, 16)}…</code>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDescargarPdf(carnetEmitido.id)}
            disabled={isPending}
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-100"
          >
            <FileDown className="size-4 mr-1.5" aria-hidden="true" />
            Descargar PDF Oficial
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUMNA IZQUIERDA: Formulario de diseño y datos */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                Datos del Personal y Diseño
              </CardTitle>
              <CardDescription>
                Consulte al trabajador por cédula, personalice el nombre y previsualice el carnet en vivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Búsqueda por cédula */}
              <form onSubmit={handleBuscar} className="flex items-end gap-2" noValidate>
                <Field className="flex-1">
                  <Label htmlFor="cedulaBusqueda">Cédula de Identidad</Label>
                  <Input
                    id="cedulaBusqueda"
                    placeholder="Ej. 12345678"
                    value={cedulaInput}
                    onChange={(e) => setCedulaInput(e.target.value)}
                    disabled={isSearching || isPending}
                  />
                </Field>
                <Button type="submit" variant="outline" disabled={isSearching || isPending}>
                  {isSearching ? (
                    <Loader2 className="size-4 animate-spin mr-1" aria-hidden="true" />
                  ) : (
                    <Search className="size-4 mr-1" aria-hidden="true" />
                  )}
                  Cargar Datos
                </Button>
              </form>

              {/* Nombre completo editable con indicador reactivo */}
              <Field>
                <div className="flex items-center justify-between">
                  <Label htmlFor="nombreTitular">Nombre en el carnet (editable)</Label>
                  <span className="text-xs text-muted-foreground">Reactivo en vivo</span>
                </div>
                <Input
                  id="nombreTitular"
                  placeholder="Nombre y apellido que figurarán en el carnet"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Puede ajustar la disposición de nombres y apellidos para optimizar el diseño.
                </p>
              </Field>

              {/* Campos complementarios de solo lectura con candado */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="codigoEmpleado" className="flex items-center gap-1 text-xs">
                    <Lock className="size-3 text-muted-foreground" aria-hidden="true" /> Código
                  </Label>
                  <Input id="codigoEmpleado" value={codigo || "—"} disabled className="bg-muted/40 font-mono text-xs" />
                </Field>
                <Field>
                  <Label htmlFor="cargoEmpleado" className="flex items-center gap-1 text-xs">
                    <Lock className="size-3 text-muted-foreground" aria-hidden="true" /> Cargo
                  </Label>
                  <Input id="cargoEmpleado" value={cargo || "—"} disabled className="bg-muted/40 text-xs" />
                </Field>
              </div>

              <Field>
                <Label htmlFor="deptoEmpleado" className="flex items-center gap-1 text-xs">
                  <Lock className="size-3 text-muted-foreground" aria-hidden="true" /> Dirección General / Dependencia
                </Label>
                <Input id="deptoEmpleado" value={departamento || "—"} disabled className="bg-muted/40 text-xs" />
              </Field>

              {/* Selector de Plantilla y Motivo */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="plantillaSelector">Plantilla de diseño</Label>
                  <Select
                    value={plantillaSeleccionadaId ? String(plantillaSeleccionadaId) : ""}
                    onValueChange={(val) => setPlantillaSeleccionadaId(val ? Number(val) : null)}
                  >
                    <SelectTrigger id="plantillaSelector">
                      <SelectValue placeholder={plantillaActiva ? `Activa: ${plantillaActiva.nombre}` : "Plantilla oficial"} />
                    </SelectTrigger>
                    <SelectContent>
                      {plantillas.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nombre} {p.activo ? "★ (Activa)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <Label htmlFor="motivoSelector">Motivo de Emisión</Label>
                  <Select
                    value={String(motivoId)}
                    onValueChange={(val) => setMotivoId(Number(val))}
                  >
                    <SelectTrigger id="motivoSelector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_PREDETERMINADOS.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Carga interactiva de foto en cliente */}
              <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
                <Label className="text-xs font-semibold">Fotografía del Trabajador</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                  >
                    <Upload className="size-3.5 mr-1.5" aria-hidden="true" />
                    {fotoUrl ? "Cambiar Fotografía" : "Subir Fotografía"}
                  </Button>
                  {fotoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleQuitarFoto}
                      disabled={isPending}
                      className="text-xs text-muted-foreground"
                    >
                      Restablecer
                    </Button>
                  )}
                  {fotoNombre && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      <ImageIcon className="size-3 mr-1" aria-hidden="true" />
                      {fotoNombre}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  La foto se procesa y previsualiza de forma interactiva en el cliente antes de la emisión.
                </p>
              </div>

              {/* Observaciones opcionales */}
              <Field>
                <Label htmlFor="observacionesInput">Observaciones (opcional)</Label>
                <Input
                  id="observacionesInput"
                  placeholder="Detalles adicionales o justificación de emisión"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  disabled={isPending}
                />
              </Field>

              {/* Botón principal de Emisión */}
              <div className="pt-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleEmitir}
                  disabled={isPending || isSearching || (!cedulaActiva && !cedulaInput)}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" aria-hidden="true" />
                  ) : (
                    <IdCard className="size-4 mr-2" aria-hidden="true" />
                  )}
                  {isPending ? "Generando carnet en servidor…" : "Emitir Carnet Oficial"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: Vista Previa en Vivo (Live Preview) */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="size-4 text-amber-500" aria-hidden="true" />
                  Vista Previa del Carnet
                </CardTitle>
                {plantillaActiva && (
                  <Badge variant="outline" className="text-xs">
                    {plantillaActiva.nombre}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Previsualización fiel en tiempo real con dimensiones físicas estándar CR80.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center justify-center p-4">
              {cedulaActiva || cedulaInput ? (
                <div className="flex flex-col items-center">
                  <div className="flex justify-center transition-all duration-300">
                    <CarnetVistaPrevia
                      cedula={cedulaActiva || cedulaInput || "00000000"}
                      nombreCompleto={nombreDebounced.trim() || (cedulaActiva ? "TITULAR" : "")}
                      codigo={codigo.trim()}
                      cargo={cargo.trim()}
                      departamento={departamento.trim()}
                      fotoUrl={fotoUrl}
                      plantillaUrl={plantillaActiva?.imagenUrl ?? null}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3 max-w-xs leading-relaxed">
                    Solo el nombre es editable. Cédula, código, cargo y dirección general se cargan automáticamente.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Camera className="size-20 opacity-30" aria-hidden="true" />
                  <p className="mt-4 text-sm font-medium">La vista previa se cargará aquí</p>
                  <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                    Ingrese una cédula de trabajador en el panel lateral para iniciar el diseñador.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
