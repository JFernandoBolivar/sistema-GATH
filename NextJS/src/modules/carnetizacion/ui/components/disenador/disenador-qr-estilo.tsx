"use client";

import { useId, useRef } from "react";
import { Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ElementoBiblioteca } from "../../../domain/entities/carnet";
import type { ElementoKonva } from "../../../domain/entities/disenador";
import {
  aplicarPresetQr,
  ETIQUETA_PRESET_QR,
  normalizarQrEstilo,
  personalizarQr,
  PRESETS_QR,
  QR_LOGO_PCT_MAX,
  QR_LOGO_PCT_MIN,
  type FormaModulosQr,
  type QrEstilo,
} from "../../../domain/entities/qr-estilo";
import { SeccionPropiedades } from "./disenador-campos";

const MUESTRAS = ["#1b2a4a", "#1264aa", "#c8102e", "#000000", "#14284b", "#7f1d1d", "#14532d"];

const FORMAS: { valor: FormaModulosQr; etiqueta: string }[] = [
  { valor: "cuadrado", etiqueta: "Cuadrado" },
  { valor: "redondeado", etiqueta: "Redondeado" },
  { valor: "puntos", etiqueta: "Puntos" },
];

/** Miniatura aproximada de un estilo: ojos, algunos módulos y el logo al centro. */
function MiniaturaQr({ estilo }: { estilo: QrEstilo }) {
  const idGradiente = useId();
  const relleno = estilo.color_modulos_2 ? `url(#${idGradiente})` : estilo.color_modulos;
  const radio = estilo.forma_modulos === "cuadrado" ? 0 : estilo.forma_modulos === "puntos" ? 3 : 1.6;
  const ojo = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect
        x={x + 1}
        y={y + 1}
        width={12}
        height={12}
        rx={estilo.forma_modulos === "cuadrado" ? 0 : 3}
        fill="none"
        stroke={estilo.color_ojo_marco}
        strokeWidth={3}
      />
      <rect x={x + 5} y={y + 5} width={4} height={4} rx={estilo.forma_modulos === "cuadrado" ? 0 : 1} fill={estilo.color_ojo_centro} />
    </g>
  );
  const puntos: [number, number][] = [
    [18, 2], [24, 4], [30, 2], [2, 18], [8, 22], [2, 28], [18, 30], [26, 28], [30, 22], [22, 18], [14, 20], [20, 8],
  ];
  return (
    <svg viewBox="0 0 34 34" className="size-full" aria-hidden>
      <defs>
        <linearGradient id={idGradiente} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={estilo.color_modulos} />
          <stop offset="1" stopColor={estilo.color_modulos_2 ?? estilo.color_modulos} />
        </linearGradient>
      </defs>
      <rect width="34" height="34" fill="#fff" />
      {[ojo(0, 0), ojo(20, 0), ojo(0, 20)]}
      {puntos.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} rx={radio} fill={relleno} />
      ))}
      {estilo.logo.activo && (
        <>
          <circle cx="17" cy="17" r="5.2" fill="#fff" />
          <circle cx="17" cy="17" r="3" fill="#f5b700" />
          <circle cx="18" cy="17.5" r="1.6" fill="#1264aa" />
        </>
      )}
    </svg>
  );
}

function CampoColor({
  etiqueta,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  const selector = useRef<HTMLInputElement>(null);
  const valido = /^#[0-9a-f]{6}$/i.test(valor);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{etiqueta}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {MUESTRAS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`${etiqueta}: ${color}`}
            aria-pressed={valor.toLowerCase() === color}
            onClick={() => onCambiar(color.toUpperCase())}
            className={`size-6 rounded-full border border-border transition-shadow ${
              valor.toLowerCase() === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        <button
          type="button"
          title="Color personalizado"
          aria-label={`${etiqueta}: color personalizado`}
          onClick={() => selector.current?.click()}
          className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-3.5" />
        </button>
        <input
          ref={selector}
          type="color"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={valido ? valor : "#1b2a4a"}
          onChange={(e) => onCambiar(e.target.value.toUpperCase())}
        />
      </div>
      <div className="relative">
        <input
          type="color"
          aria-label={`Selector de ${etiqueta.toLowerCase()}`}
          value={valido ? valor : "#1b2a4a"}
          onChange={(e) => onCambiar(e.target.value.toUpperCase())}
          className="absolute left-2 top-1/2 size-5 -translate-y-1/2 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <Input
          className="h-9 pl-9 font-mono text-xs"
          aria-label={`Código hexadecimal de ${etiqueta.toLowerCase()}`}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </div>
    </div>
  );
}

interface DisenadorQrEstiloProps {
  elemento: ElementoKonva;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  /** Medios de la Biblioteca (se muestran solo los de la categoría Logos). */
  mediosBiblioteca?: readonly ElementoBiblioteca[];
}

/** Sección «Estilo del QR» del panel de Propiedades (elemento QR seleccionado). */
export function DisenadorQrEstilo({
  elemento: el,
  onActualizarElemento,
  mediosBiblioteca = [],
}: DisenadorQrEstiloProps) {
  const estilo = normalizarQrEstilo(el.qr_estilo);
  const logos = mediosBiblioteca.filter((m) => m.categoria === "logo");
  const guardar = (nuevo: QrEstilo) => onActualizarElemento(el.id, { qr_estilo: nuevo });
  const cambiarColor = (clave: "color_modulos" | "color_modulos_2" | "color_ojo_marco" | "color_ojo_centro") =>
    (valor: string) => guardar(personalizarQr(estilo, { [clave]: valor }));
  const cambiarLogo = (cambios: Partial<QrEstilo["logo"]>) =>
    guardar({ ...estilo, logo: { ...estilo.logo, ...cambios } });

  return (
    <SeccionPropiedades titulo="Estilo del QR">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Estilos predefinidos del QR">
        {(Object.keys(PRESETS_QR) as (keyof typeof PRESETS_QR)[]).map((preset) => {
          const activo = estilo.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={activo}
              aria-label={`Estilo ${ETIQUETA_PRESET_QR[preset]}`}
              onClick={() => guardar(aplicarPresetQr(estilo, preset))}
              className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] transition-colors hover:bg-muted/40 ${
                activo ? "border-primary ring-1 ring-primary" : "border-border"
              }`}
            >
              <span className="block size-12 overflow-hidden rounded border bg-white">
                <MiniaturaQr estilo={{ ...PRESETS_QR[preset], logo: estilo.logo }} />
              </span>
              {ETIQUETA_PRESET_QR[preset]}
            </button>
          );
        })}
      </div>
      {estilo.preset === "personalizado" && (
        <p className="text-[11px] text-muted-foreground">Estilo personalizado.</p>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Forma de los módulos</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={estilo.forma_modulos}
          onValueChange={(v) => {
            if (v) guardar(personalizarQr(estilo, { forma_modulos: v as FormaModulosQr }));
          }}
          className="w-full"
        >
          {FORMAS.map((f) => (
            <ToggleGroupItem key={f.valor} value={f.valor} className="h-9 flex-1 text-xs">
              {f.etiqueta}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <CampoColor etiqueta="Color de los módulos" valor={estilo.color_modulos} onCambiar={cambiarColor("color_modulos")} />
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`qr-degradado-${el.id}`} className="text-xs font-medium">
          Degradado
        </Label>
        <Switch
          id={`qr-degradado-${el.id}`}
          checked={!!estilo.color_modulos_2}
          onCheckedChange={(on) =>
            guardar(personalizarQr(estilo, { color_modulos_2: on ? "#1B2A4A" : null }))
          }
        />
      </div>
      {estilo.color_modulos_2 && (
        <CampoColor
          etiqueta="Segundo color del degradado"
          valor={estilo.color_modulos_2}
          onCambiar={cambiarColor("color_modulos_2")}
        />
      )}
      <CampoColor etiqueta="Ojo: marco" valor={estilo.color_ojo_marco} onCambiar={cambiarColor("color_ojo_marco")} />
      <CampoColor etiqueta="Ojo: centro" valor={estilo.color_ojo_centro} onCambiar={cambiarColor("color_ojo_centro")} />

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`qr-logo-${el.id}`} className="text-xs font-medium">
            Logo al centro
          </Label>
          <Switch
            id={`qr-logo-${el.id}`}
            checked={estilo.logo.activo}
            onCheckedChange={(activo) => cambiarLogo({ activo })}
          />
        </div>
        {estilo.logo.activo && (
          <>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="Logo del QR (Biblioteca de Medios, categoría Logos)"
            >
              <button
                type="button"
                aria-pressed={estilo.logo.medio_id === null}
                onClick={() => cambiarLogo({ medio_id: null })}
                className={`flex h-16 flex-col items-center justify-center rounded-lg border p-1 text-[10px] leading-tight hover:bg-muted/40 ${
                  estilo.logo.medio_id === null ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <span className="font-semibold">CONATEL</span>
                <span className="text-muted-foreground">predeterminado</span>
              </button>
              {logos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.nombre}
                  aria-label={`Logo ${m.nombre}`}
                  aria-pressed={estilo.logo.medio_id === m.id}
                  onClick={() => cambiarLogo({ medio_id: m.id })}
                  className={`flex h-16 items-center justify-center rounded-lg border bg-muted/20 p-1 hover:bg-muted/40 ${
                    estilo.logo.medio_id === m.id ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.archivo_url} alt={m.nombre} className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
            {logos.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No hay logos en la Biblioteca de Medios; se usa el de CONATEL.
              </p>
            )}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span>Tamaño del logo</span>
                <span className="font-mono text-muted-foreground">{estilo.logo.tamano_pct} %</span>
              </div>
              <Slider
                aria-label="Tamaño del logo"
                value={[estilo.logo.tamano_pct]}
                min={QR_LOGO_PCT_MIN}
                max={QR_LOGO_PCT_MAX}
                step={1}
                onValueChange={([v]) => cambiarLogo({ tamano_pct: v })}
              />
            </div>
          </>
        )}
      </div>
    </SeccionPropiedades>
  );
}
