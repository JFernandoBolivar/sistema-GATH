"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ANTECEDENTE_VACIO, cuerpoExperiencia, experienciaDesdeDatos, MAX_ANTECEDENTES, type CatalogosVentana2, type ValoresExperiencia } from "../../domain/ventana2";
import { crearEsquemaExperiencia } from "../schema/schema-ventana2";
import { CampoCombobox, CampoOpciones, CampoTexto } from "./campos";
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

function TarjetaAntecedente({ indice, control, catalogos, hoyIso, onQuitar }: { indice: number; control: Control<ValoresExperiencia>; catalogos: CatalogosVentana2; hoyIso: string; onQuitar: () => void }) {
  const a = useWatch({ control, name: `antecedentes.${indice}` });
  const organismo = catalogos.organismos.find((o) => String(o.id) === a?.organismoId)?.nombre;
  return (
    <TarjetaItem titulo={`Experiencia ${indice + 1}`} subtitulo={organismo} etiquetaQuitar={`Quitar la experiencia ${indice + 1}`} onQuitar={onQuitar} testId="tarjeta-antecedente">
      <CampoCombobox control={control} name={`antecedentes.${indice}.organismoId`} etiqueta="Organismo" requerido opciones={aOpciones(catalogos.organismos)} placeholder="Busca el organismo" className="sm:col-span-2" />
      <CampoTexto control={control} name={`antecedentes.${indice}.fechaIngreso`} etiqueta="Fecha de ingreso" requerido type="date" max={hoyIso} min="1950-01-01" />
      <CampoTexto control={control} name={`antecedentes.${indice}.fechaEgreso`} etiqueta="Fecha de egreso" requerido type="date" max={hoyIso} min="1950-01-01" />
    </TarjetaItem>
  );
}

export function SeccionExperiencia({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const [hoy] = useState(() => new Date());
  const hoyIso = hoy.toISOString().slice(0, 10);
  const flexible = useMemo(() => crearEsquemaExperiencia({ estricto: false, hoy }), [hoy]);
  const estricto = useMemo(() => crearEsquemaExperiencia({ estricto: true, hoy }), [hoy]);
  const form = useForm<ValoresExperiencia>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresExperiencia>,
    defaultValues: experienciaDesdeDatos(datos),
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "antecedentes" });
  const sinAntecedentes = useWatch({ control: form.control, name: "sinAntecedentes" });
  const { guardando, error, guardadoA, guardarSeccion } = useGuardadoSeccion({
    form, estricto, seccion: "experiencia", guardar, cuerpo: cuerpoExperiencia, onContinuar, validarAlEntrar,
  });
  const errores = form.formState.errors;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Landmark className="size-5 text-primary" aria-hidden /> Experiencia en la Administración Pública
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Esta sección es opcional. Registra los organismos públicos donde trabajaste antes (hasta {MAX_ANTECEDENTES}), con las fechas de ingreso y egreso.
            Si nunca has trabajado en la Administración Pública, marca la casilla.
          </p>
          <div className="mt-4">
            <CampoOpciones
              control={form.control}
              name="trabajoAntesEnConatel"
              etiqueta="¿Trabajaste antes en CONATEL?"
              idEtiqueta="etiqueta-trabajo-conatel"
              opciones={[["si", "Sí"], ["no", "No"]]}
              ayuda="Opcional. Si trabajaste en CONATEL antes, registra también ese periodo como experiencia si lo recuerdas."
            />
          </div>
          <CasillaNoTengo
            id="sin-antecedentes"
            etiqueta="No he trabajado en la Administración Pública"
            marcada={sinAntecedentes}
            bloqueada={fields.length > 0}
            mensajeBloqueada="Quita las experiencias de la lista para marcar esta opción."
            onCambio={(v) => {
              form.setValue("sinAntecedentes", v, { shouldDirty: true, shouldValidate: true });
              form.clearErrors("antecedentes");
            }}
            error={errores.sinAntecedentes?.message}
          />
        </section>
        {!sinAntecedentes && (
          <>
            {fields.length === 0 && <ListaVacia>Todavía no has agregado experiencia. Usa el botón «Agregar experiencia» o marca la casilla.</ListaVacia>}
            <ul className="flex flex-col gap-4" aria-label="Experiencia en la Administración Pública">
              {fields.map((campo, i) => (
                <TarjetaAntecedente key={campo.id} indice={i} control={form.control} catalogos={catalogos} hoyIso={hoyIso} onQuitar={() => remove(i)} />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto sm:self-start"
              disabled={fields.length >= MAX_ANTECEDENTES}
              onClick={() => {
                form.clearErrors("antecedentes");
                append({ ...ANTECEDENTE_VACIO });
              }}
            >
              <Plus aria-hidden /> Agregar experiencia
            </Button>
          </>
        )}
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
