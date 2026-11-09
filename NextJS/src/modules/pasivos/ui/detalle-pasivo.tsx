"use client";

/**
 * Detalle de pasivo con la misma hoja de expediente que un trabajador activo:
 * foto, secciones del expediente y diálogos de actualización por sección.
 *
 * Reutiliza `EmpleadoDetalleSheet` (A1): los datos personales viven en
 * `Employee`, así que un pasivo se consulta y actualiza con el mismo contrato.
 * La exportación se mantiene con el PDF propio del pasivo.
 */
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { obtenerCatalogosExpediente } from "@/modules/personal/infrastructure/cache/catalogos-expediente-cache";
import type { CatalogosExpedienteDTO } from "@/modules/personal/application/dtos/empleado-dto";
import EmpleadoDetalleSheet from "@/modules/personal/ui/empleado-detalle-sheet";
import { construirDetalleExpediente } from "@/modules/personal/ui/expediente-detalle-view-model";
import { useExpedienteVigente } from "@/modules/personal/ui/use-expediente-vigente";
import { formatearFecha } from "@/shared/lib/formato-fecha";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";
import {
  descargarPasivoPdfAction,
  getPasivoPorCedulaAction,
} from "../infrastructure/actions/pasivos-actions";

interface DetallePasivoProps {
  cedula: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tras guardar un cambio: la página recarga su listado (la fila se ve al instante). */
  onGuardado?: () => void;
}

export function DetallePasivo({ cedula, open, onOpenChange, onGuardado }: DetallePasivoProps) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeExportarPdf = tienePermiso(permisos, "pasivos.exportar_pdf");
  const puedeEditar = tienePermiso(permisos, "personal.editar_personales");

  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [pasivo, setPasivo] = useState<PasivoDTO | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  // El expediente se deriva de la cédula vigente: al cambiar de pasivo se
  // vacía al instante (carga) y se descartan respuestas de otra cédula.
  const { empleado, cargando, revision, recargar } = useExpedienteVigente({
    cedula,
    activo: open,
    onError: (mensaje) => toast.error(mensaje),
  });

  useEffect(() => {
    if (!open || !cedula) {
      setPasivo(null);
      return;
    }
    // El expediente no espera catálogos: el backend ya manda los nombres.
    // Los catálogos se cargan en paralelo para los diálogos de edición.
    obtenerCatalogosExpediente()
      .then((cats) => setCatalogos(cats))
      .catch(() => undefined);

    getPasivoPorCedulaAction(cedula)
      .then((p) => {
        if (p && typeof p === "object" && !("error" in p)) {
          setPasivo(p as PasivoDTO);
        }
      })
      .catch(() => undefined);
  }, [open, cedula]);

  const detalle = useMemo(() => {
    if (!empleado) return null;
    const base = construirDetalleExpediente(empleado, catalogos);
    if (pasivo && base) {
      if (pasivo.motivoEgreso || pasivo.fechaEgreso) {
        base.cargosAsignados = base.cargosAsignados.map((c) => ({
          ...c,
          tipoNomina: pasivo.motivoEgreso
            ? `${c.tipoNomina} — ${pasivo.motivoEgreso}`
            : c.tipoNomina,
          estatus: pasivo.fechaEgreso
            ? `${c.estatus} (Vigencia: ${formatearFecha(pasivo.fechaEgreso, "—")})`
            : c.estatus,
        }));
      }
    }
    return base;
  }, [empleado, catalogos, pasivo]);

  const exportarPdf = async () => {
    if (!cedula) return;
    setExportandoPdf(true);
    try {
      const resultado = await descargarPasivoPdfAction(cedula);
      if (!(resultado instanceof Blob)) {
        toast.error(
          (resultado as { error: string }).error ?? "No fue posible descargar el PDF.",
        );
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expediente-pasivo-${cedula}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("No fue posible descargar el PDF.");
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <EmpleadoDetalleSheet
      detalle={detalle}
      empleado={empleado}
      catalogos={catalogos}
      open={open}
      onOpenChange={onOpenChange}
      onExportarPdf={exportarPdf}
      onGuardado={() => {
        recargar();
        onGuardado?.();
      }}
      exportandoPdf={exportandoPdf || cargando}
      puedeExportarPdf={puedeExportarPdf}
      puedeEditar={puedeEditar}
      revision={revision}
      permitirPais
    />
  );
}
