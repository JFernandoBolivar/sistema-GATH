"use client";

import { useState } from "react";
import { FileText, FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FirmanteDocumento, ModoPlantilla, PlantillaCompleta, ProcesoPlantilla } from "../../domain/entities/plantilla";
import { validarMetadatosPlantilla } from "../../domain/lib/esquemas";
import { crearPlantillaAction } from "../../infrastructure/actions/documentos-actions";
import { SelectSimple } from "./select-simple";
import { SelectorProceso } from "./selector-proceso";
import { ETIQUETA_FIRMANTE } from "../lib/etiquetas";

const MODOS: { valor: ModoPlantilla; titulo: string; texto: string; icono: typeof FileText }[] = [
  {
    valor: "formulario",
    titulo: "Formulario propio de CONATEL",
    texto: "Arme el documento con bloques: secciones, filas de campos, casillas, tablas, párrafos, foto y firmas.",
    icono: FileText,
  },
  {
    valor: "pdf_overlay",
    titulo: "Formato de terceros sobre un PDF",
    texto: "Suba el PDF oficial (Caja de Ahorro, seguros…) y coloque los datos encima, campo por campo.",
    icono: FileUp,
  },
];

/** Convierte un nombre libre en un código válido (MAYÚSCULAS, números, guion y guion bajo). */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Procesos disponibles (catálogo del backend). */
  procesos: readonly ProcesoPlantilla[];
  /** Proceso con el que se abre el diálogo (p. ej. desde una alerta de plantilla faltante). */
  procesoInicial?: string;
  onCreada: (p: PlantillaCompleta) => void;
}

export function CrearPlantillaDialog({ abierto, onCerrar, procesos, procesoInicial, onCreada }: Props) {
  const [modo, setModo] = useState<ModoPlantilla>("formulario");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoManual, setCodigoManual] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [procesoElegido, setProcesoElegido] = useState<string>(procesoInicial ?? "");
  const proceso = procesoElegido;
  const [firmante, setFirmante] = useState<FirmanteDocumento>("postulante");
  const [firmaClic, setFirmaClic] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string[]>>({});

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalidos = validarMetadatosPlantilla({
      codigo,
      nombre,
      descripcion,
      proceso,
      firmante,
      requiere_firma_clic: firmaClic,
    }, procesos);
    if (invalidos.length > 0) {
      setErrores(Object.fromEntries(invalidos.map((error) => [error.ruta, [error.mensaje]])));
      toast.error(invalidos[0].mensaje);
      return;
    }
    setErrores({});
    setEnviando(true);
    const r = await crearPlantillaAction({
      codigo,
      nombre,
      descripcion,
      modo,
      proceso,
      firmante,
      requiere_firma_clic: firmaClic,
    });
    setEnviando(false);
    if (!r.success) {
      setErrores(r.errores ?? {});
      toast.error(r.status === 409 ? "Ya existe una plantilla con ese código." : r.error);
      return;
    }
    toast.success("Plantilla creada como borrador.");
    onCreada(r.data);
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && !enviando && onCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva plantilla de documento</DialogTitle>
          <DialogDescription>Elija el tipo de documento y complete los datos básicos. Podrá diseñarla enseguida.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">Tipo de documento</legend>
            {MODOS.map((m) => {
              const Icono = m.icono;
              const activo = modo === m.valor;
              return (
                <button
                  type="button"
                  key={m.valor}
                  aria-pressed={activo}
                  onClick={() => setModo(m.valor)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activo ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent/40",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icono className="size-5 text-primary" aria-hidden /> {m.titulo}
                  </span>
                  <span className="text-sm text-muted-foreground">{m.texto}</span>
                </button>
              );
            })}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nueva-nombre">Nombre</Label>
              <Input
                id="nueva-nombre"
                value={nombre}
                maxLength={160}
                required
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (!codigoManual) setCodigo(codigoDesdeNombre(e.target.value));
                }}
                placeholder="Planilla de itinerancia"
              />
              {errores.nombre && <p className="text-sm text-destructive">{errores.nombre[0]}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nueva-codigo">Código</Label>
              <Input
                id="nueva-codigo"
                value={codigo}
                maxLength={60}
                required
                className="font-mono"
                onChange={(e) => {
                  setCodigoManual(true);
                  setCodigo(e.target.value.toUpperCase());
                }}
                placeholder="PLANILLA_ITINERANCIA"
              />
              <p className="text-xs text-muted-foreground">Identifica la plantilla; no cambia tras publicarla.</p>
              {errores.codigo && <p className="text-sm text-destructive">{errores.codigo[0]}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nueva-descripcion">Descripción (opcional)</Label>
            <Textarea id="nueva-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <SelectorProceso
                id="nueva-proceso"
                procesos={procesos}
                valor={proceso}
                onCambio={setProcesoElegido}
                error={errores.proceso?.[0]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Quién firma</Label>
              <SelectSimple
                valor={firmante}
                onCambio={(v) => setFirmante(v as FirmanteDocumento)}
                opciones={Object.entries(ETIQUETA_FIRMANTE).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="nueva-firma-clic">Requiere firma por clic</Label>
              <p className="text-xs text-muted-foreground">El firmante acepta el documento con un clic en lugar de firmar a mano.</p>
            </div>
            <Switch id="nueva-firma-clic" checked={firmaClic} onCheckedChange={setFirmaClic} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !nombre.trim() || !codigo.trim() || !proceso}>
              {enviando ? "Creando…" : "Crear y diseñar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
