"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cuerpoCursos, CURSO_VACIO, cursosDesdeDatos, MAX_CURSOS, type CatalogosVentana2, type ValoresCursos } from "../../domain/ventana2";
import { crearEsquemaCursos } from "../schema/schema-ventana2";
import { CampoCombobox, CampoTexto } from "./campos";
import { PieSeccion, type GuardarSeccion } from "./comun";
import { CasillaNoTengo, ListaVacia, TarjetaItem } from "./lista";
import { useGuardadoSeccion } from "./use-guardado-seccion";

interface Props {
  datos: Record<string, unknown>;
  catalogos: CatalogosVentana2;
  guardar: GuardarSeccion;
  onContinuar: () => void;
  onAnterior?: () => void;
  validarAlEntrar?: boolean;
}

const aOpciones = (lista: ReadonlyArray<{ id: number; nombre: string }>) => lista.map((o) => ({ valor: String(o.id), texto: o.nombre }));

function TarjetaCurso({ indice, control, catalogos, hoyIso, onQuitar }: { indice: number; control: Control<ValoresCursos>; catalogos: CatalogosVentana2; hoyIso: string; onQuitar: () => void }) {
  const c = useWatch({ control, name: `cursos.${indice}` });
  const nombre = catalogos.capacitaciones.find((x) => String(x.id) === c?.capacitacionId)?.nombre;
  return (
    <TarjetaItem titulo={`Curso ${indice + 1}`} subtitulo={nombre} etiquetaQuitar={`Quitar el curso ${indice + 1}`} onQuitar={onQuitar} testId="tarjeta-curso">
      <CampoCombobox control={control} name={`cursos.${indice}.capacitacionId`} etiqueta="Curso o capacitación" requerido opciones={aOpciones(catalogos.capacitaciones)} placeholder="Busca el curso" className="sm:col-span-2" />
      <CampoCombobox control={control} name={`cursos.${indice}.institucionId`} etiqueta="Institución" requerido opciones={aOpciones(catalogos.instituciones)} placeholder="Busca la institución" className="sm:col-span-2" />
      <CampoTexto control={control} name={`cursos.${indice}.fechaInicio`} etiqueta="Fecha de inicio" type="date" max={hoyIso} min="1950-01-01" />
      <CampoTexto control={control} name={`cursos.${indice}.fechaFin`} etiqueta="Fecha de fin" type="date" max={hoyIso} min="1950-01-01" />
      <CampoTexto control={control} name={`cursos.${indice}.horas`} etiqueta="Horas de duración" inputMode="numeric" maxLength={4} placeholder="Ej. 40" ayuda="Opcional." />
    </TarjetaItem>
  );
}

export function SeccionCursos({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [hoy] = useState(() => new Date());
  const hoyIso = hoy.toISOString().slice(0, 10);
  const flexible = useMemo(() => crearEsquemaCursos({ estricto: false, hoy }), [hoy]);
  const estricto = useMemo(() => crearEsquemaCursos({ estricto: true, hoy }), [hoy]);
  const form = useForm<ValoresCursos>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresCursos>,
    defaultValues: cursosDesdeDatos(datos),
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "cursos" });
  const sinCursos = useWatch({ control: form.control, name: "sinCursos" });
  const { guardando, error, guardadoA, guardarSeccion } = useGuardadoSeccion({
    form, estricto, seccion: "cursos", guardar, cuerpo: cuerpoCursos, onContinuar, validarAlEntrar,
  });
  const errores = form.formState.errors;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="size-5 text-primary" aria-hidden /> Cursos y capacitaciones
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Esta sección es opcional. Registra los cursos, talleres o diplomados que hayas realizado (hasta {MAX_CURSOS}). Si no tienes, marca la casilla o continúa.
          </p>
          <CasillaNoTengo
            id="sin-cursos"
            etiqueta="No tengo cursos"
            marcada={sinCursos}
            bloqueada={fields.length > 0}
            mensajeBloqueada="Quita los cursos de la lista para marcar esta opción."
            onCambio={(v) => {
              form.setValue("sinCursos", v, { shouldDirty: true, shouldValidate: true });
              form.clearErrors("cursos");
            }}
            error={errores.sinCursos?.message}
          />
        </section>
        {!sinCursos && (
          <>
            {fields.length === 0 && <ListaVacia>Todavía no has agregado cursos. Usa el botón «Agregar curso» o marca «No tengo cursos».</ListaVacia>}
            <ul className="flex flex-col gap-4" aria-label="Cursos">
              {fields.map((campo, i) => (
                <TarjetaCurso key={campo.id} indice={i} control={form.control} catalogos={catalogos} hoyIso={hoyIso} onQuitar={() => remove(i)} />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto sm:self-start"
              disabled={fields.length >= MAX_CURSOS}
              onClick={() => {
                form.clearErrors("cursos");
                append({ ...CURSO_VACIO });
              }}
            >
              <Plus aria-hidden /> Agregar curso
            </Button>
          </>
        )}
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
