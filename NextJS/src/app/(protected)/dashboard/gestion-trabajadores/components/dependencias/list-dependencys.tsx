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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <Card>
        <CardContent>
          <div className={`grid grid-cols-2 w-full gap-4 space-y-5`}>
            <div className={`col-span-2 space-y-2`}>
              <Label>Nivel</Label>
              <Select
                onValueChange={(value) => {
                  setDependencyId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Nivel</SelectLabel>
                    {dependency?.data.map((dp, i) => (
                      <SelectItem key={i} value={`${dp.id}`}>
                        {dp.Codigo}-{dp.dependencia}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
                <div className="text-sm text-gray-700 text-[12px]">
                  Consultar Dirección / Gerencia / Oficina
                </div>
              </Select>
            </div>

            <div className={`space-y-2 `}>
              <Label>Dirección / Gerencia / Oficina</Label>
              <Select
                onValueChange={(value) => {
                  setDirectionGeneralId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar Ubicacion Administrativa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Dirección / Gerencia / Oficina</SelectLabel>
                    {directionGeneral?.data.map((general, i) => (
                      <SelectItem key={i} value={`${general.id}`}>
                        {general.Codigo}-{general.direccion_general}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
                <div className="text-sm text-gray-700 text-[12px]">
                  Consultar Divisiones
                </div>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>División / Coordinación</Label>

              <Select
                onValueChange={(value) => {
                  setCoordinationId(value);
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={
                    directionLine?.data !== undefined &&
                    directionLine!.data?.length > 0
                      ? false
                      : true
                  }
                >
                  <SelectValue
                    placeholder={`${
                      directionLine?.data !== undefined &&
                      directionLine!.data?.length > 0
                        ? "Seleccionar Ubicacion Administrativa"
                        : "No Posee Ubicaciones Administrativas"
                    }`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>División / Coordinación</SelectLabel>
                    {directionLine?.data.map((line, i) => (
                      <SelectItem key={i} value={`${line.id}`}>
                        {line.Codigo}-{line.direccion_linea}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
                <div className="text-[12px] text-gray-700">
                  Consultar Coordinaciones De La División
                </div>
              </Select>
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
