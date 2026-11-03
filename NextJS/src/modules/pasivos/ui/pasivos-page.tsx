"use client";

/**
 * Consultar/Actualizar pasivos: filtros por cédula, nombre, tipo de nómina
 * pasiva y fecha de egreso; paginación en servidor 10/50; detalle y edición
 * de datos básicos. Las acciones se ocultan por permiso (`pasivos.editar`,
 * `familiares.*`) sin cambiar el layout de Gestión de Trabajadores.
 */
import { useEffect, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Eraser, Loader2, Search } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { CatalogoPasivoDTO, PasivoDTO } from "../application/dtos/pasivos-dto";
import { DetallePasivo } from "./detalle-pasivo";
import { construirColumnasPasivos } from "./pasivos-columns";
import {
  descargarPasivoPdfAction,
  getPasivosPaginadosAction,
  getTiposNominaAction,
} from "../infrastructure/actions/pasivos-actions";
import type { FiltrosPasivosFormType } from "./schema/schema-pasivo";

const FILTROS_VACIOS: FiltrosPasivosFormType = {
  cedula: "",
  codigo: "",
  tipoNominaId: undefined,
  limit: 10,
  offset: 0,
};

export default function PasivosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeExportarPdf = tienePermiso(permisos, "pasivos.exportar_pdf");

  const [borrador, setBorrador] = useState<FiltrosPasivosFormType>(FILTROS_VACIOS);
  const [filtros, setFiltros] = useState<FiltrosPasivosFormType>(FILTROS_VACIOS);
  const [tiposNomina, setTiposNomina] = useState<CatalogoPasivoDTO[]>([]);
  const [detalle, setDetalle] = useState<PasivoDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        setTiposNomina(await getTiposNominaAction(true));
      } catch {
        setError("No fue posible cargar los tipos de nómina pasiva.");
      }
    });
  }, []);

  const { data, error: errorLista, isLoading, mutate: recargarLista } = useSWR(
    ["pasivos-paginados", JSON.stringify(filtros)],
    () => getPasivosPaginadosAction(filtros),
  );

  const pagina =
    data && typeof data === "object" && !("error" in data)
      ? (data as { count: number; limit: number; offset: number; results: PasivoDTO[] })
      : null;
  const resultados = pagina?.results ?? [];
  const total = pagina?.count ?? 0;
  const limit = pagina?.limit ?? filtros.limit ?? 10;
  const offset = pagina?.offset ?? filtros.offset ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  const paginaActual = Math.floor(offset / limit) + 1;

  const descargarPdf = async (pasivo: PasivoDTO) => {
    setError(null);
    try {
      const resultado = await descargarPasivoPdfAction(pasivo.cedula);
      if (!(resultado instanceof Blob)) {
        setError(
          (resultado as { error: string }).error ?? "No fue posible generar el PDF del pasivo.",
        );
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `expediente-pasivo-${pasivo.cedula}.pdf`;
      enlace.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("No fue posible generar el PDF del pasivo.");
    }
  };

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFiltros({ ...borrador, offset: 0 });
  };

  const limpiar = () => {
    setBorrador(FILTROS_VACIOS);
    setFiltros(FILTROS_VACIOS);
    setError(null);
  };

  const cambiarPagina = (delta: number) => {
    const nuevo = Math.max(0, Math.min(offset + delta * limit, (totalPaginas - 1) * limit));
    setFiltros((prev) => ({ ...prev, offset: nuevo }));
  };

  return (
    <PageLayout
      title="Consultar Pasivo"
      description="Jubilados, pensionados y sobrevivientes registrados en el sistema."
    >
      <div className="flex flex-col gap-4">
        <Card className="bg-white">
          <CardContent className="p-4">
            <form onSubmit={aplicar} className="flex flex-row items-end gap-2 flex-wrap" noValidate>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <Label htmlFor="filtro-cedula">Buscar Cédula</Label>
                <Input
                  id="filtro-cedula"
                  value={borrador.cedula ?? ""}
                  onChange={(e) => setBorrador((p) => ({ ...p, cedula: e.target.value }))}
                  placeholder="buscar cedula..."
                />
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <Label htmlFor="filtro-codigo">Buscar Código De Trabajador</Label>
                <Input
                  id="filtro-codigo"
                  value={borrador.codigo ?? ""}
                  onChange={(e) => setBorrador((p) => ({ ...p, codigo: e.target.value }))}
                  placeholder="buscar codigo de trabajador..."
                />
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <Label htmlFor="filtro-nomina">Tipo de Nomina</Label>
                <Select
                  value={borrador.tipoNominaId ? String(borrador.tipoNominaId) : "todos"}
                  onValueChange={(v) =>
                    setBorrador((p) => ({
                      ...p,
                      tipoNominaId: v === "todos" ? undefined : Number(v),
                    }))
                  }
                >
                  <SelectTrigger id="filtro-nomina" className="w-full">
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Ninguno</SelectItem>
                    {tiposNomina.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="cursor-pointer shrink-0" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="size-4" aria-hidden="true" />
                  )}
                  Buscar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer shrink-0"
                  onClick={limpiar}
                >
                  Limpiar <Eraser className="size-4 ml-1" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {(error || errorLista) && (
          <p role="alert" className="text-sm text-destructive">
            {error ?? "No fue posible cargar el listado de pasivos."}
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <DataTable
            columns={construirColumnasPasivos({
              onVerDetalle: setDetalle,
              onDescargarPdf: descargarPdf,
              puedeExportarPdf,
            })}
            data={resultados}
            emptyMessage="No hay trabajadores pasivos que coincidan con los filtros."
            hidePagination
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + limit, total)}`} de {total}
            </span>
            <Label htmlFor="tamano-pagina" className="ml-2">
              Por página
            </Label>
            <Select
              value={String(limit)}
              onValueChange={(v) =>
                setFiltros((prev) => ({ ...prev, limit: Number(v), offset: 0 }))
              }
            >
              <SelectTrigger id="tamano-pagina" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cambiarPagina(-1)}
              disabled={paginaActual <= 1}
            >
              <ChevronLeft className="mr-1 size-4" aria-hidden="true" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {paginaActual} de {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cambiarPagina(1)}
              disabled={paginaActual >= totalPaginas}
            >
              Siguiente <ChevronRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <DetallePasivo
          cedula={detalle?.cedula ?? null}
          open={!!detalle}
          onOpenChange={(open) => {
            if (!open) setDetalle(null);
          }}
          onGuardado={() => void recargarLista()}
        />
      </div>
    </PageLayout>
  );
}
