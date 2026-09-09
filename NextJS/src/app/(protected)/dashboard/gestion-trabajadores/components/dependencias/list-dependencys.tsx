"use client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "../../../../../../components/ui/card";
import { Label } from "../../../../../../components/ui/label";

import {
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { Combobox } from "@/components/ui/combobox";
import { useState } from "react";
import useSWR from "swr";
export default function TableDependencys() {
  const [dependencyId, setDependencyId] = useState<number | string>("");
  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(
    null,
  );
  const [coordinationId, setCoordinationId] = useState<string | null>(null);

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      dependencyId ? [`directionGeneral.${dependencyId}`, dependencyId] : null,
      async () => await getDirectionGeneralById(dependencyId),
    );
  const { data: directionLine } = useSWR(
    directionGeneralId
      ? [
          `directionLine.${dependencyId}.${directionGeneralId}`,
          dependencyId,
          directionGeneralId,
        ]
      : null,
    async () => await getDirectionLine(directionGeneralId!),
  );

  const { data: coordination } = useSWR(
    coordinationId
      ? [
          `coordination.${dependencyId}.${directionGeneralId}.${coordinationId}`,
          dependencyId,
          directionGeneralId,
          coordinationId,
        ]
      : null,
    async () => await getCoordination(coordinationId!),
  );

  return (
    <>
      <Card className="bg-white">
        <CardContent >
          <div className={`grid grid-cols-2 w-full gap-5`}>
            <div className={`col-span-2 gap-2`}>
              <Label>Nivel</Label>
              <Combobox
                options={(dependency?.data ?? []).map((dp) => ({
                  value: `${dp.id}`,
                  label: `${dp.Codigo}-${dp.dependencia}`,
                }))}
                value={dependencyId ? `${dependencyId}` : ""}
                onChange={(value) => {
                  setDependencyId(value);
                }}
                placeholder="Seleccionar Nivel"
                searchPlaceholder="Buscar nivel..."
                disabled={isLoadingDependency}
              />
              <div className="text-sm text-gray-700 text-[12px]">
                Consultar Dirección / Gerencia / Oficina
              </div>
            </div>

            <div className={`gap-2 `}>
              <Label>Dirección / Gerencia / Oficina</Label>
              <Combobox
                options={(directionGeneral?.data ?? []).map((general) => ({
                  value: `${general.id}`,
                  label: `${general.Codigo}-${general.direccion_general}`,
                }))}
                value={directionGeneralId ?? ""}
                onChange={(value) => {
                  setDirectionGeneralId(value);
                }}
                placeholder="Seleccionar Ubicacion Administrativa"
                searchPlaceholder="Buscar dirección..."
                disabled={isLoadingDirectionGeneral}
              />
              <div className="text-sm text-gray-700 text-[12px]">
                Consultar Divisiones
              </div>
            </div>

            <div className="gap-2">
              <Label>División / Coordinación</Label>

              <Combobox
                options={(directionLine?.data ?? []).map((line) => ({
                  value: `${line.id}`,
                  label: `${line.Codigo}-${line.direccion_linea}`,
                }))}
                value={coordinationId ?? ""}
                onChange={(value) => {
                  setCoordinationId(value);
                }}
                disabled={
                  !(
                    directionLine?.data !== undefined &&
                    directionLine!.data?.length > 0
                  )
                }
                placeholder={
                  directionLine?.data !== undefined &&
                  directionLine!.data?.length > 0
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
          <div className="grid grid-cols-2 gap-5 ">
            {directionLine?.data.length! > 0 &&
              Array.isArray(directionLine?.data) && (
                <div className="overflow-auto   border rounded-2xl border-blue-700 ">
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
                      {directionLine.data?.map((general, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {general.Codigo}
                          </TableCell>
                          <TableCell className="text-center">
                            {general.direccion_linea}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            <div className="rounded-2xl">
              {coordination?.data.length! > 0 && (
                <div className="overflow-auto   border rounded-2xl border-blue-700 ">
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
                      {coordination?.data?.map((general, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {general.Codigo}
                          </TableCell>
                          <TableCell className="text-center">
                            {general.coordinacion}
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
    </>
  );
}
