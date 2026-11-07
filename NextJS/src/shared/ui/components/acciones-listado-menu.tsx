"use client";

/**
 * Menú de acciones compartido por los listados (personal, pasivos, etc.).
 *
 * Mantiene la misma estructura y diseño en todos los módulos: sección
 * «Acciones», separador, sección «Extras» y el botón principal al final.
 * Cada listado solo aporta sus propias acciones; el color del botón sale del
 * token `primary`, no de una clase fija.
 */
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";

export interface ItemAccionListado {
  etiqueta: string;
  onSelect: () => void | Promise<void>;
  deshabilitado?: boolean;
}

export interface AccionesListadoMenuProps {
  acciones: ItemAccionListado[];
  extras?: ItemAccionListado[];
  accionPrincipal: ItemAccionListado;
  /** Texto accesible del disparador; por defecto «Abrir menú». */
  etiquetaMenu?: string;
}

export function AccionesListadoMenu({
  acciones,
  extras = [],
  accionPrincipal,
  etiquetaMenu = "Abrir menú",
}: AccionesListadoMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">{etiquetaMenu}</span>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        {acciones.map((accion) => (
          <DropdownMenuItem
            key={accion.etiqueta}
            className="cursor-pointer"
            disabled={accion.deshabilitado}
            onClick={accion.onSelect}
          >
            {accion.etiqueta}
          </DropdownMenuItem>
        ))}
        {extras.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Extras</DropdownMenuLabel>
            {extras.map((extra) => (
              <DropdownMenuItem
                key={extra.etiqueta}
                className="cursor-pointer"
                disabled={extra.deshabilitado}
                onClick={extra.onSelect}
              >
                {extra.etiqueta}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuItem asChild>
          <Button
            type="button"
            className="w-full rounded-sm bg-primary p-2 font-medium text-primary-foreground hover:bg-primary/90"
            onClick={accionPrincipal.onSelect}
          >
            {accionPrincipal.etiqueta}
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
