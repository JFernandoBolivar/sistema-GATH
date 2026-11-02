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
import { getEmpleadoPorCedulaAction } from "@/modules/personal/infrastructure/actions/personal-actions";
import { obtenerCatalogosExpediente } from "@/modules/personal/infrastructure/cache/catalogos-expediente-cache";
import type {
  CatalogosExpedienteDTO,
  EmpleadoDTO,
} from "@/modules/personal/application/dtos/empleado-dto";
import EmpleadoDetalleSheet from "@/modules/personal/ui/empleado-detalle-sheet";
import { construirDetalleExpediente } from "@/modules/personal/ui/expediente-detalle-view-model";

import { descargarPasivoPdfAction } from "../infrastructure/actions/pasivos-actions";

interface DetallePasivoProps {
  cedula: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetallePasivo({ cedula, open, onOpenChange }: DetallePasivoProps) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeExportarPdf = tienePermiso(permisos, "pasivos.exportar_pdf");
  const puedeEditar = tienePermiso(permisos, "personal.editar_personales");

  const [empleado, setEmpleado] = useState<EmpleadoDTO | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [cargando, setCargando] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!open || !cedula) return;
    setCargando(true);
    // El expediente no espera catálogos: el backend ya manda los nombres.
    // Los catálogos se cargan en paralelo para los diálogos de edición.
    obtenerCatalogosExpediente()
      .then((cats) => setCatalogos(cats))
      .catch(() => undefined);
    getEmpleadoPorCedulaAction(cedula)
      .then((valor) => {
        if (valor && typeof valor === "object" && "error" in valor) {
          toast.error((valor as { error: string }).error);
          setEmpleado(null);
          return;
        }
        setEmpleado(valor as EmpleadoDTO);
      })
      .catch(() => {
        toast.error("No fue posible cargar el expediente del pasivo.");
        setEmpleado(null);
      })
      .finally(() => setCargando(false));
  }, [open, cedula, recarga]);

  const detalle = useMemo(
    () => (empleado ? construirDetalleExpediente(empleado, catalogos) : null),
    [empleado, catalogos],
  );

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
      onGuardado={() => setRecarga((n) => n + 1)}
      exportandoPdf={exportandoPdf || cargando}
      puedeExportarPdf={puedeExportarPdf}
      puedeEditar={puedeEditar}
    />
  );
}
