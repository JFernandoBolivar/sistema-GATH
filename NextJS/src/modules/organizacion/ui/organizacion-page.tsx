"use client";

/**
 * Página principal de organización: "Consultar Ub. Administrativas" (/organizacion y /organizacion/listado-ubicacion-administrativa).
 * Paridad 100% con la interfaz legada (`listado-ubicacion-administrativa/` + `list-dependencys.tsx`):
 * - Cascadas de Comboboxes: Nivel, Dirección / Gerencia / Oficina, División / Coordinación
 * - Tablas con encabezado azul (bg-blue-600 text-white) y bordes redondeados (rounded-2xl border-blue-700)
 * - Textos de ayuda idénticos: Consultar Dirección / Gerencia / Oficina, Consultar Divisiones, Consultar Coordinaciones De La División
 */
import { useEffect, useState, useTransition } from "react";

import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  CoordinacionDTO,
  DependenciaDTO,
  DireccionGeneralDTO,
  DireccionLineaDTO,
} from "../application/dtos/organizacion-dto";
import {
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
} from "../infrastructure/actions/organizacion-actions";

export default function OrganizacionPage() {
  const [dependencias, setDependencias] = useState<DependenciaDTO[]>([]);
  const [dirGenerales, setDirGenerales] = useState<DireccionGeneralDTO[]>([]);
  const [dirLinea, setDirLinea] = useState<DireccionLineaDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<CoordinacionDTO[]>([]);

  const [dependencyId, setDependencyId] = useState<string>("");
  const [directionGeneralId, setDirectionGeneralId] = useState<string>("");
  const [coordinationId, setCoordinationId] = useState<string>("");

  const [, startTransition] = useTransition();
  const [isLoadingDependency, setIsLoadingDependency] = useState(false);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);

  useEffect(() => {
    setIsLoadingDependency(true);
    getDependenciasAction()
      .then((deps) => setDependencias(deps))
      .catch(() => {})
      .finally(() => setIsLoadingDependency(false));
  }, []);

  const handleSelectDependencia = (value: string) => {
    setDependencyId(value);
    setDirectionGeneralId("");
    setCoordinationId("");
    setDirGenerales([]);
    setDirLinea([]);
    setCoordinaciones([]);

    if (!value) return;

    setIsLoadingDirectionGeneral(true);
    startTransition(async () => {
      try {
        const data = await getDireccionesGeneralesAction(Number(value));
        setDirGenerales(data);
      } catch {
        // Silencioso
      } finally {
        setIsLoadingDirectionGeneral(false);
      }
    });
  };

  const handleSelectDireccionGeneral = (value: string) => {
    setDirectionGeneralId(value);
    setCoordinationId("");
    setDirLinea([]);
    setCoordinaciones([]);

    if (!value) return;

    setIsLoadingDirectionLine(true);
    startTransition(async () => {
      try {
        const data = await getDireccionesLineaAction(Number(value));
        setDirLinea(data);
      } catch {
        // Silencioso
      } finally {
        setIsLoadingDirectionLine(false);
      }
    });
  };

  const handleSelectDireccionLinea = (value: string) => {
    setCoordinationId(value);
    setCoordinaciones([]);

    if (!value) return;

    startTransition(async () => {
      try {
        const data = await getCoordinacionesAction(Number(value));
        setCoordinaciones(data);
      } catch {
        // Silencioso
      }
    });
  };

  return (
    <PageLayout title="Listado De Ubicaciones Administrativas">
      <Card className="bg-white">
        <CardContent>
          <div className="grid grid-cols-2 w-full gap-5">
            <div className="col-span-2 gap-2">
              <Label>Nivel</Label>
              <Combobox
                options={dependencias.map((dp) => ({
                  value: `${dp.id}`,
                  label: `${dp.codigo}-${dp.nombre}`,
                }))}
                value={dependencyId}
                onChange={handleSelectDependencia}
                placeholder="Seleccionar Nivel"
                searchPlaceholder="Buscar nivel..."
                disabled={isLoadingDependency}
              />
              <div className="text-sm text-gray-700 text-[12px]">
                Consultar Dirección / Gerencia / Oficina
              </div>
            </div>

            <div className="gap-2">
              <Label>Dirección / Gerencia / Oficina</Label>
              <Combobox
                options={dirGenerales.map((general) => ({
                  value: `${general.id}`,
                  label: `${general.codigo}-${general.nombre}`,
                }))}
                value={directionGeneralId}
                onChange={handleSelectDireccionGeneral}
                placeholder="Seleccionar Ubicacion Administrativa"
                searchPlaceholder="Buscar dirección..."
                disabled={isLoadingDirectionGeneral || !dependencyId}
              />
              <div className="text-sm text-gray-700 text-[12px]">
                Consultar Divisiones
              </div>
            </div>

            <div className="gap-2">
              <Label>División / Coordinación</Label>
              <Combobox
                options={dirLinea.map((line) => ({
                  value: `${line.id}`,
                  label: `${line.codigo}-${line.nombre}`,
                }))}
                value={coordinationId}
                onChange={handleSelectDireccionLinea}
                disabled={dirLinea.length === 0 || isLoadingDirectionLine}
                placeholder={
                  dirLinea.length > 0
                    ? "Seleccionar Ubicacion Administrativa"
                    : "No Posee Ubicaciones Administrativas"
                }
                searchPlaceholder="Buscar división o coordinación..."
              />
              <div className="text-[12px] text-gray-700">
                Consultar Coordinaciones De La División
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mt-6">
            {dirLinea.length > 0 && (
              <div className="overflow-auto border rounded-2xl border-blue-700">
                <Table>
                  <TableCaption>División</TableCaption>
                  <TableHeader className="bg-blue-600">
                    <TableRow>
                      <TableHead className="w-[100px] font-bold text-white">
                        Código
                      </TableHead>
                      <TableHead className="text-center font-bold text-white">
                        División
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dirLinea.map((general, i) => (
                      <TableRow key={general.id ?? i}>
                        <TableCell className="font-medium">
                          {general.codigo}
                        </TableCell>
                        <TableCell className="text-center">
                          {general.nombre}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="rounded-2xl">
              {coordinaciones.length > 0 && (
                <div className="overflow-auto border rounded-2xl border-blue-700">
                  <Table>
                    <TableCaption>Coordinación</TableCaption>
                    <TableHeader className="bg-blue-600">
                      <TableRow>
                        <TableHead className="w-[100px] font-bold text-white">
                          Código
                        </TableHead>
                        <TableHead className="text-center font-bold text-white">
                          Coordinación
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coordinaciones.map((general, i) => (
                        <TableRow key={general.id ?? i}>
                          <TableCell className="font-medium">
                            {general.codigo}
                          </TableCell>
                          <TableCell className="text-center">
                            {general.nombre}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
