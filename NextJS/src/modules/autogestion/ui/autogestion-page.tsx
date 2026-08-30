"use client";

/**
 * Página de autogestión: cuestionario de censo (preguntas dinámicas),
 * ver mi censo y reporte por dependencias. Cliente + react-hook-form +
 * zodResolver; las acciones van envueltas en useTransition (R8) y se delegan
 * a las Server Actions del módulo (R7). Opera con DTOs (R5).
 */
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { ClipboardList, Loader2, Save, Search } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";

import type {
  ItemRespuestaInputDTO,
  PreguntaCensoDTO,
  ReporteDependenciaDTO,
  RespuestaCensoDTO,
} from "../application/dtos/censo-dto";
import {
  getMiCensoAction,
  getPreguntasCensoAction,
  getReporteDependenciasCensoAction,
  guardarMiCensoAction,
  obtenerCensoPorCedulaAction,
} from "../infrastructure/actions/autogestion-actions";

export default function AutogestionPage() {
  const [preguntas, setPreguntas] = useState<PreguntaCensoDTO[]>([]);
  const [miCenso, setMiCenso] = useState<RespuestaCensoDTO[]>([]);
  const [reporte, setReporte] = useState<ReporteDependenciaDTO[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, ItemRespuestaInputDTO>>({});
  const [tab, setTab] = useState<"censo" | "reporte">("censo");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [busquedaCedula, setBusquedaCedula] = useState("");
  const [censoPorCedula, setCensoPorCedula] = useState<RespuestaCensoDTO[] | null>(null);
  const [busquedaError, setBusquedaError] = useState<string | null>(null);

  const cargar = () => {
    startTransition(async () => {
      setError(null);
      try {
        const [p, mc, rep] = await Promise.all([
          getPreguntasCensoAction(),
          getMiCensoAction(),
          getReporteDependenciasCensoAction(),
        ]);
        setPreguntas(p);
        setMiCenso(mc);
        setReporte(rep);
      } catch {
        setError("No fue posible cargar el censo.");
      }
    });
  };

  useEffect(() => {
    cargar();
  }, []);

  const setRespuesta = (preguntaId: number, parcial: Partial<ItemRespuestaInputDTO>) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: { ...prev[preguntaId], ...parcial, preguntaId } }));
  };

  const onGuardar = () => {
    startTransition(async () => {
      setError(null);
      setExito(null);
      const items = Object.values(respuestas);
      if (items.length === 0) {
        setError("No ha respondido ninguna pregunta.");
        return;
      }
      const resultado = await guardarMiCensoAction(items);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        return;
      }
      setRespuestas({});
      setExito("Censo guardado correctamente.");
      setMiCenso(resultado as RespuestaCensoDTO[]);
    });
  };

  const onBuscarCedula = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setBusquedaError(null);
      const resultado = await obtenerCensoPorCedulaAction(busquedaCedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setBusquedaError((resultado as { error: string }).error);
        setCensoPorCedula(null);
        return;
      }
      setCensoPorCedula(resultado as RespuestaCensoDTO[]);
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <ClipboardList className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Autogestión</h1>
      </header>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {exito && <p role="status" className="text-sm text-emerald-600">{exito}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "censo" | "reporte")}>
        <TabsList>
          <TabsTrigger value="censo">Cuestionario</TabsTrigger>
          <TabsTrigger value="reporte">Reporte por dependencias</TabsTrigger>
        </TabsList>

        <TabsContent value="censo">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Consultar censo por cédula</CardTitle>
              <CardDescription>
                Busque las respuestas del censo de un empleado por su cédula de identidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={onBuscarCedula} className="flex items-end gap-2 md:w-96" noValidate>
                <Field>
                  <Label htmlFor="busquedaCedula">Cédula</Label>
                  <Input
                    id="busquedaCedula"
                    value={busquedaCedula}
                    onChange={(e) => setBusquedaCedula(e.target.value)}
                    placeholder="Ej. 12345678"
                  />
                </Field>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
                  Buscar
                </Button>
              </form>

              {busquedaError && <p role="alert" className="text-sm text-destructive">{busquedaError}</p>}

              {censoPorCedula && (
                censoPorCedula.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este empleado no tiene respuestas de censo registradas.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pregunta</TableHead>
                          <TableHead>Respuesta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {censoPorCedula.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.preguntaEnunciado}</TableCell>
                            <TableCell>{r.opcionTexto ?? r.respuestaTexto}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {preguntas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay preguntas de censo disponibles.</p>
            ) : (
              preguntas.map((pregunta, idx) => (
                <Card key={pregunta.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{idx + 1}. {pregunta.enunciado}</CardTitle>
                    <CardDescription>{pregunta.tipo}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pregunta.opciones.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {pregunta.opciones.map((opcion) => (
                          <label key={opcion.id} className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`pregunta-${pregunta.id}`}
                              checked={respuestas[pregunta.id]?.opcionId === opcion.id}
                              onChange={() => setRespuesta(pregunta.id, { opcionId: opcion.id })}
                              className="size-4"
                            />
                            {opcion.texto}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Escriba su respuesta"
                        value={respuestas[pregunta.id]?.respuesta ?? ""}
                        onChange={(e) => setRespuesta(pregunta.id, { respuesta: e.target.value })}
                      />
                    )}
                  </CardContent>
                </Card>
              ))
            )}
            <div>
              <Button onClick={onGuardar} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                Guardar censo
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reporte">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Total empleados</TableHead>
                  <TableHead>Empleados censados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reporte.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-16 text-center text-muted-foreground">Sin datos de reporte.</TableCell></TableRow>
                ) : (
                  reporte.map((r) => (
                    <TableRow key={r.dependenciaId}>
                      <TableCell className="font-medium">{r.dependencia}</TableCell>
                      <TableCell>{r.totalEmpleados}</TableCell>
                      <TableCell>{r.empleadosCensados}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
