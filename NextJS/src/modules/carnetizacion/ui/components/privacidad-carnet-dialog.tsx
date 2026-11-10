"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import type { NivelPrivacidadDato, PreferenciasPrivacidadCarnet } from "../../domain/entities/carnet";
import { PRIVACIDAD_DEFECTO } from "../../domain/entities/carnet";
import {
  guardarPreferenciasPrivacidadAction,
  obtenerPreferenciasPrivacidadAction,
} from "../../infrastructure/actions/carnetizacion-actions";

interface PrivacidadCarnetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado?: () => void;
}

interface FilaConfigPrivacidad {
  clave: string;
  etiqueta: string;
  descripcion: string;
  permitePublico: boolean;
}

const FILAS_CONFIG: FilaConfigPrivacidad[] = [
  {
    clave: "foto",
    etiqueta: "Fotografía del titular",
    descripcion: "Visible en el anverso del carnet y al escanear el QR.",
    permitePublico: true,
  },
  {
    clave: "nombre",
    etiqueta: "Nombre y apellido",
    descripcion: "Identificación de la persona acreditada.",
    permitePublico: true,
  },
  {
    clave: "cargo",
    etiqueta: "Cargo institucional",
    descripcion: "Denominación del cargo y nivel.",
    permitePublico: true,
  },
  {
    clave: "contactos_emergencia",
    etiqueta: "Contactos de emergencia",
    descripcion: "Nombres y teléfonos de contacto para auxilio o accidentes.",
    permitePublico: true,
  },
  {
    clave: "salud",
    etiqueta: "Información médica",
    descripcion: "Alergias, patologías y grupo sanguíneo para primeros auxilios.",
    permitePublico: true,
  },
  {
    clave: "cedula",
    etiqueta: "Cédula de identidad",
    descripcion: "Número de cédula institucional.",
    permitePublico: true,
  },
  {
    clave: "fecha_nacimiento",
    etiqueta: "Fecha de nacimiento",
    descripcion: "Día, mes y año de nacimiento.",
    permitePublico: true,
  },
  {
    clave: "direccion_vivienda",
    etiqueta: "Dirección de vivienda",
    descripcion: "Domicilio particular. Nunca puede ser público por seguridad.",
    permitePublico: false,
  },
];

export function PrivacidadCarnetDialog({
  open,
  onOpenChange,
  onGuardado,
}: PrivacidadCarnetDialogProps) {
  const [prefs, setPrefs] = useState<PreferenciasPrivacidadCarnet>(PRIVACIDAD_DEFECTO);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!open) return;
    let montado = true;
    async function cargar() {
      try {
        setCargando(true);
        setError(null);
        setExito(false);
        const data = await obtenerPreferenciasPrivacidadAction();
        if (montado) {
          setPrefs({ ...PRIVACIDAD_DEFECTO, ...data });
        }
      } catch (err) {
        if (montado) {
          setError(err instanceof Error ? err.message : "Error cargando configuración.");
        }
      } finally {
        if (montado) {
          setCargando(false);
        }
      }
    }
    cargar();
    return () => {
      montado = false;
    };
  }, [open]);

  const handleCambio = (clave: string, valor: NivelPrivacidadDato) => {
    if (clave === "direccion_vivienda" && valor === "PUBLICO") {
      return; // Bloqueado por regla de negocio
    }
    setPrefs((prev) => ({ ...prev, [clave]: valor }));
  };

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      setError(null);
      await guardarPreferenciasPrivacidadAction(prefs);
      setExito(true);
      onGuardado?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" /> Privacidad de la Credencial en el QR
          </DialogTitle>
          <DialogDescription className="text-xs">
            Usted decide qué información estará disponible al escanear el código QR de su carnet.
            El rol Administrador conserva acceso con registro obligatorio en la bitácora institucional.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Cargando preferencias de privacidad...
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {FILAS_CONFIG.map((fila) => {
              const valorActual = prefs[fila.clave] || PRIVACIDAD_DEFECTO[fila.clave] || "SOLO_PERSONAL";
              return (
                <div key={fila.clave} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2">
                  <div className="space-y-0.5 max-w-sm">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {fila.etiqueta}
                      {!fila.permitePublico && (
                        <span title="Dato reservado" className="inline-flex items-center text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                          <Lock className="h-3 w-3 mr-0.5" /> No pública
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{fila.descripcion}</p>
                  </div>

                  <div className="shrink-0">
                    <Select
                      value={valorActual}
                      onValueChange={(val) => handleCambio(fila.clave, val as NivelPrivacidadDato)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        {fila.permitePublico && <SelectItem value="PUBLICO">Público</SelectItem>}
                        <SelectItem value="CON_SESION">Con sesión</SelectItem>
                        <SelectItem value="SOLO_PERSONAL">Solo Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleGuardar}
            disabled={cargando || guardando}
          >
            {guardando ? "Guardando..." : exito ? "Guardado ✓" : "Guardar privacidad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
