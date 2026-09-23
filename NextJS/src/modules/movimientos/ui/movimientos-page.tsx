"use client";

/**
 * Página de consulta del historial de movimientos de trabajadores — 100% paridad visual y funcional
 * con el sistema de referencia (`gestion-trabajadores/movimientos/consultar/page.tsx`).
 *
 * Características:
 * - PageLayout con título "Consulta De Movimientos De Trabajadores" y subtítulo "Verifique El Movimiento Del Personal".
 * - Formulario con "Buscar Cédula" (placeholder: "buscar cedula..."), opción "Buscar Código Puesto", y botones "Buscar" y "Limpiar".
 * - Indicador animado estandarizado `<Loading promiseMessage="Cargando Información" />`.
 * - Exportación de PDF con `ExportButton` (`ReportMovementsPDF`) al obtener resultados.
 * - Tabla con `DataTable` (TanStack) y menú desplegable de acciones por fila (Copiar Código Puesto, Ver detalles).
 * - Hoja de detalle `DetalleMovimiento` con ScrollArea e información del cargo y ubicación.
 * - Estricta arquitectura limpia: Server Actions tipadas y DTOs (`MovimientoCargoDTO`).
 */
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import ExportButton from "@/components/ui/ExportButtonPDF";
import { DataTable } from "@/shared/ui/components/data-table";
import Loading from "@/shared/ui/components/loading";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";
import {
  getHistorialPorCargoAction,
  getHistorialPorEmpleadoAction,
} from "../infrastructure/actions/movimientos-actions";
import { DetalleMovimiento } from "./detalle-movimiento";
import { construirColumnasMovimientos } from "./movimientos-columns";
import { ReportMovementsPDF } from "./pdf/report-movements-pdf";
import {
  consultaHistorialSchema,
  type ConsultaHistorialFormType,
} from "./schema/schema-historial";

type TipoConsulta = { tipo: "empleado" | "cargo"; valor: string } | null;

export default function MovimientosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const esAdmin =
    session?.user?.role?.nombre_rol === "ADMINISTRADOR" || session?.user?.role?.id === 1;
  const puedeVer = esAdmin || tienePermiso(permisos, "movimientos.ver");

  const [movimientos, setMovimientos] = useState<MovimientoCargoDTO[]>([]);
  const [consulta, setConsulta] = useState<TipoConsulta>(null);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [viendoDetalle, setViendoDetalle] = useState<MovimientoCargoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const form = useForm<ConsultaHistorialFormType>({
    resolver: zodResolver(consultaHistorialSchema),
    defaultValues: {
      cedulaidentidad: "",
      codigoPuesto: "",
    },
  });

  const onSearch = (values: ConsultaHistorialFormType) => {
    const cedula = values.cedulaidentidad?.trim();
    const codigo = values.codigoPuesto?.trim();

    if (!cedula && !codigo) {
      setError("Ingrese una cédula o un código de puesto para buscar.");
      return;
    }

    if (!puedeVer) return;

    setError(null);
    setBuscado(true);

    startTransition(async () => {
      try {
        if (cedula) {
          setConsulta({ tipo: "empleado", valor: cedula });
          const resultado = await getHistorialPorEmpleadoAction(cedula);
          if (resultado && typeof resultado === "object" && "error" in resultado) {
            setError((resultado as { error: string }).error);
            setMovimientos([]);
            return;
          }
          setMovimientos((resultado as MovimientoCargoDTO[]) ?? []);
        } else if (codigo) {
          setConsulta({ tipo: "cargo", valor: codigo.toUpperCase() });
          const resultado = await getHistorialPorCargoAction(codigo.toUpperCase());
          if (resultado && typeof resultado === "object" && "error" in resultado) {
            setError((resultado as { error: string }).error);
            setMovimientos([]);
            return;
          }
          setMovimientos((resultado as MovimientoCargoDTO[]) ?? []);
        }
      } catch {
        setError("No fue posible cargar el historial de movimientos.");
        setMovimientos([]);
      }
    });
  };

  const cleanFields = () => {
    form.reset({
      cedulaidentidad: "",
      codigoPuesto: "",
    });
    setConsulta(null);
    setMovimientos([]);
    setBuscado(false);
    setError(null);
  };

  const onVerDetalle = (movimiento: MovimientoCargoDTO) => {
    setViendoDetalle(movimiento);
    setDetalleAbierto(true);
  };

  const columnas = useMemo(
    () => construirColumnasMovimientos(onVerDetalle, puedeVer),
    [puedeVer],
  );

  const pdfDocument = useMemo(
    () => (
      <ReportMovementsPDF
        moves={movimientos}
        cedula={consulta?.valor ?? ""}
        userName={session?.user?.name}
      />
    ),
    [movimientos, consulta?.valor, session?.user?.name],
  );

  return (
    <PageLayout
      title="Consulta De Movimientos De Trabajadores"
      description="Verifique El Movimiento Del Personal"
    >
      <div className="flex flex-col gap-4 mt-2">
        {!puedeVer && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium"
          >
            No tiene permisos suficientes para consultar el historial de movimientos de personal (se requiere movimientos.ver).
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSearch)}
            className="flex flex-col justify-start gap-2"
            noValidate
          >
            <div className="flex items-center gap-2 flex-wrap">
              <FormField
                name="cedulaidentidad"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buscar Cédula</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-white"
                        type="text"
                        placeholder="buscar cedula..."
                        disabled={!puedeVer || isPending}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                name="codigoPuesto"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buscar Código Puesto</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-white"
                        type="text"
                        placeholder="buscar código puesto..."
                        disabled={!puedeVer || isPending}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="cursor-pointer self-end"
                disabled={isPending || !puedeVer}
              >
                Buscar <Search className="size-4 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer self-end"
                type="button"
                onClick={cleanFields}
                disabled={isPending}
              >
                Limpiar <Eraser className="size-4 ml-1" />
              </Button>
            </div>
          </form>
        </Form>

        {error && (
          <p role="alert" className="text-sm text-destructive font-medium">
            {error}
          </p>
        )}

        {movimientos.length > 0 && (
          <div className="flex justify-end mb-1">
            <ExportButton
              document={pdfDocument}
              fileName={`historial-movimientos-${consulta?.valor ?? "reporte"}.pdf`}
              buttonText="Descargar PDF"
            />
          </div>
        )}

        {isPending ? (
          <Loading promiseMessage="Cargando Información" />
        ) : (
          <DataTable
            columns={columnas}
            data={movimientos}
            emptyMessage={
              buscado
                ? "No hay movimientos registrados para la consulta."
                : "Ingrese un criterio de búsqueda y presione Buscar para consultar el historial."
            }
          />
        )}

        <DetalleMovimiento
          movimiento={viendoDetalle}
          open={detalleAbierto}
          onOpenChange={setDetalleAbierto}
        />
      </div>
    </PageLayout>
  );
}
