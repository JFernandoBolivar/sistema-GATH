"use client";

import { useRef } from "react";
import { ImageUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type {
  DefinicionFormulario,
  OrientacionPagina,
  TamanoPagina,
  TipoEncabezado,
} from "../../domain/entities/plantilla";
import type { EntornoEditor } from "../lib/entorno";
import { validarLogo } from "../lib/subir-archivo";
import { SelectSimple } from "./select-simple";

interface Props {
  definicion: DefinicionFormulario;
  onCambio: (fn: (d: DefinicionFormulario) => DefinicionFormulario) => void;
  onSubirLogo: (archivo: File) => Promise<boolean>;
  subiendo: boolean;
  progreso: number | null;
  entorno: EntornoEditor;
  maxBytesLogo?: number;
}

/** Página y encabezado del documento (modo formulario). */
export function AjustesDocumento({ definicion, onCambio, onSubirLogo, subiendo, progreso, entorno, maxBytesLogo }: Props) {
  const ro = entorno.soloLectura;
  const inputLogo = useRef<HTMLInputElement>(null);
  const enc = definicion.encabezado;

  return (
    <section aria-labelledby="titulo-ajustes" className="grid gap-4">
      <h3 id="titulo-ajustes" className="font-semibold">Página y encabezado</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Tamaño de página</Label>
          <SelectSimple
            valor={definicion.pagina.tamano}
            deshabilitado={ro}
            onCambio={(v) => onCambio((d) => ({ ...d, pagina: { ...d.pagina, tamano: v as TamanoPagina } }))}
            opciones={[
              { valor: "carta", etiqueta: "Carta" },
              { valor: "oficio", etiqueta: "Oficio" },
            ]}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Orientación</Label>
          <SelectSimple
            valor={definicion.pagina.orientacion}
            deshabilitado={ro}
            onCambio={(v) => onCambio((d) => ({ ...d, pagina: { ...d.pagina, orientacion: v as OrientacionPagina } }))}
            opciones={[
              { valor: "vertical", etiqueta: "Vertical" },
              { valor: "horizontal", etiqueta: "Horizontal" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Encabezado</Label>
        <SelectSimple
          valor={enc.tipo}
          deshabilitado={ro}
          onCambio={(v) => onCambio((d) => ({ ...d, encabezado: { ...d.encabezado, tipo: v as TipoEncabezado } }))}
          opciones={[
            { valor: "institucional", etiqueta: "Institucional (logo y cintillo de CONATEL)" },
            { valor: "logo_propio", etiqueta: "Logo propio" },
            { valor: "ninguno", etiqueta: "Sin encabezado" },
          ]}
        />
      </div>

      {enc.tipo === "logo_propio" && (
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="text-sm">
            {enc.logo_clave ? "Hay un logo cargado para este documento." : "Todavía no hay un logo cargado."}
          </p>
          <input
            ref={inputLogo}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Elegir imagen del logo"
            onChange={async (e) => {
              const archivo = e.target.files?.[0];
              e.target.value = "";
              if (!archivo) return;
              const problema = validarLogo(archivo, maxBytesLogo);
              if (problema) return toast.error(problema);
              await onSubirLogo(archivo);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={ro || subiendo} onClick={() => inputLogo.current?.click()}>
              <ImageUp aria-hidden /> {enc.logo_clave ? "Cambiar logo" : "Subir logo"}
            </Button>
            <span className="text-xs text-muted-foreground">PNG o JPEG, hasta 2 MB.</span>
          </div>
          {subiendo && progreso !== null && <Progress value={progreso} aria-label="Progreso de la subida" />}
        </div>
      )}

      {enc.tipo !== "ninguno" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="enc-titulo">Título</Label>
            <Input
              id="enc-titulo"
              value={enc.titulo}
              maxLength={160}
              disabled={ro}
              aria-invalid={Boolean(entorno.errores["encabezado.titulo"])}
              onChange={(e) => onCambio((d) => ({ ...d, encabezado: { ...d.encabezado, titulo: e.target.value } }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="enc-subtitulo">Subtítulo</Label>
            <Input
              id="enc-subtitulo"
              value={enc.subtitulo}
              maxLength={200}
              disabled={ro}
              onChange={(e) => onCambio((d) => ({ ...d, encabezado: { ...d.encabezado, subtitulo: e.target.value } }))}
            />
          </div>
        </>
      )}
    </section>
  );
}
