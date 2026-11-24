"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Languages, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  cuerpoIdiomas,
  IDIOMA_VACIO,
  idiomasDesdeDatos,
  LIMITES_VENTANA2,
  MAX_IDIOMAS,
  NIVELES_IDIOMA,
  OTRO_IDIOMA,
  type CatalogosVentana2,
  type ValoresIdiomas,
} from "../../domain/ventana2";
import { crearEsquemaIdiomas } from "../schema/schema-ventana2";
import { CampoOpciones, CampoSelect, CampoTexto } from "./campos";
import { PieSeccion, TarjetaSeccion, type GuardarSeccion } from "./comun";
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

function TarjetaIdioma({ indice, control, catalogos, onQuitar }: { indice: number; control: Control<ValoresIdiomas>; catalogos: CatalogosVentana2; onQuitar: () => void }) {
  const i = useWatch({ control, name: `idiomas.${indice}` });
  const esOtro = i?.idiomaId === OTRO_IDIOMA;
  const nombre = esOtro ? i?.otroIdioma : catalogos.idiomas.find((x) => String(x.id) === i?.idiomaId)?.nombre;
  const opciones = [...catalogos.idiomas.map((x) => ({ valor: String(x.id), texto: x.nombre })), { valor: OTRO_IDIOMA, texto: "Otro (escribirlo)" }];
  return (
    <TarjetaItem titulo={`Idioma ${indice + 1}`} subtitulo={nombre} etiquetaQuitar={`Quitar el idioma ${indice + 1}`} onQuitar={onQuitar} testId="tarjeta-idioma">
      <CampoSelect control={control} name={`idiomas.${indice}.idiomaId`} etiqueta="Idioma" requerido opciones={opciones} className={esOtro ? undefined : "sm:col-span-2"} />
      {esOtro && (
        <CampoTexto control={control} name={`idiomas.${indice}.otroIdioma`} etiqueta="Nombre del idioma" requerido maxLength={LIMITES_VENTANA2.otroIdioma} autoComplete="off" />
      )}
      <CampoOpciones
        control={control}
        name={`idiomas.${indice}.nivel`}
        etiqueta="¿Qué tan bien lo dominas?"
        requerido
        idEtiqueta={`etiqueta-nivel-idioma-${indice}`}
        opciones={NIVELES_IDIOMA}
        className="sm:col-span-2"
      />
    </TarjetaItem>
  );
}

export function SeccionIdiomas({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const flexible = useMemo(() => crearEsquemaIdiomas({ estricto: false }), []);
  const estricto = useMemo(() => crearEsquemaIdiomas({ estricto: true }), []);
  const form = useForm<ValoresIdiomas>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresIdiomas>,
    defaultValues: idiomasDesdeDatos(datos),
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "idiomas" });
  const sinIdiomas = useWatch({ control: form.control, name: "sinIdiomas" });
  const { guardando, error, guardadoA, guardarSeccion } = useGuardadoSeccion({
    form, estricto, seccion: "idiomas", guardar, cuerpo: cuerpoIdiomas, onContinuar, validarAlEntrar,
  });
  const errores = form.formState.errors;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <TarjetaSeccion titulo="Tu RIF" descripcion="Opcional. Es el Registro de Información Fiscal del SENIAT: una letra, ocho dígitos y un dígito verificador.">
          <CampoTexto
            control={form.control}
            name="rif"
            etiqueta="RIF"
            placeholder="V-12345678-9"
            maxLength={14}
            autoCapitalize="characters"
            autoComplete="off"
            ayuda="Puedes escribirlo con o sin guiones."
            className="sm:col-span-2"
          />
        </TarjetaSeccion>
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Languages className="size-5 text-primary" aria-hidden /> Idiomas
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            Opcional. Indica los idiomas que dominas además del español (hasta {MAX_IDIOMAS}). Si el tuyo no está en la lista, elige «Otro» y escríbelo.
          </p>
          <CasillaNoTengo
            id="sin-idiomas"
            etiqueta="No domino otros idiomas"
            marcada={sinIdiomas}
            bloqueada={fields.length > 0}
            mensajeBloqueada="Quita los idiomas de la lista para marcar esta opción."
            onCambio={(v) => {
              form.setValue("sinIdiomas", v, { shouldDirty: true, shouldValidate: true });
              form.clearErrors("idiomas");
            }}
            error={errores.sinIdiomas?.message}
          />
        </section>
        {!sinIdiomas && (
          <>
            {fields.length === 0 && <ListaVacia>Todavía no has agregado idiomas. Usa el botón «Agregar idioma» o marca «No domino otros idiomas».</ListaVacia>}
            <ul className="flex flex-col gap-4" aria-label="Idiomas">
              {fields.map((campo, i) => (
                <TarjetaIdioma key={campo.id} indice={i} control={form.control} catalogos={catalogos} onQuitar={() => remove(i)} />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto sm:self-start"
              disabled={fields.length >= MAX_IDIOMAS}
              onClick={() => {
                form.clearErrors("idiomas");
                append({ ...IDIOMA_VACIO });
              }}
            >
              <Plus aria-hidden /> Agregar idioma
            </Button>
          </>
        )}
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
