"use client";

import { useMemo } from "react";
import { useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cuerpoEstudios, ESTUDIO_VACIO, estudiosDesdeDatos, MAX_ESTUDIOS, type CatalogosVentana2, type ValoresEstudios } from "../../domain/ventana2";
import { crearEsquemaEstudios } from "../schema/schema-ventana2";
import { CampoCombobox, CampoSelect } from "./campos";
import { PieSeccion, type GuardarSeccion } from "./comun";
import { EncabezadoSeccion, ListaVacia, TarjetaItem } from "./lista";
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

function TarjetaEstudio({ indice, control, catalogos, onQuitar, onCambioNivel, onCambioCarrera }: {
  indice: number;
  control: Control<ValoresEstudios>;
  catalogos: CatalogosVentana2;
  onQuitar: () => void;
  onCambioNivel: () => void;
  onCambioCarrera: () => void;
}) {
  const e = useWatch({ control, name: `estudios.${indice}` });
  const nivelId = Number(e?.nivelAcademicoId) || null;
  const carreraId = Number(e?.carreraId) || null;
  // Una carrera sin nivel asignado en el catálogo se ofrece con cualquier nivel.
  const carreras = useMemo(
    () => (nivelId ? catalogos.carreras.filter((c) => c.nivelAcademicoId === null || c.nivelAcademicoId === nivelId) : []),
    [catalogos.carreras, nivelId],
  );
  const menciones = useMemo(() => (carreraId ? catalogos.menciones.filter((m) => m.carreraId === carreraId) : []), [catalogos.menciones, carreraId]);
  const nivel = catalogos.nivelesAcademicos.find((n) => n.id === nivelId)?.nombre;

  return (
    <TarjetaItem titulo={`Estudio ${indice + 1}`} subtitulo={nivel} etiquetaQuitar={`Quitar el estudio ${indice + 1}`} onQuitar={onQuitar} testId="tarjeta-estudio">
      <CampoSelect
        control={control}
        name={`estudios.${indice}.nivelAcademicoId`}
        etiqueta="Nivel académico"
        requerido
        opciones={aOpciones(catalogos.nivelesAcademicos)}
        onCambio={onCambioNivel}
      />
      <CampoCombobox
        control={control}
        name={`estudios.${indice}.carreraId`}
        etiqueta="Carrera o área"
        opciones={aOpciones(carreras)}
        deshabilitado={!nivelId || carreras.length === 0}
        placeholder={!nivelId ? "Elige primero el nivel" : carreras.length === 0 ? "Este nivel no tiene carreras" : "Elige una carrera"}
        ayuda={nivelId && carreras.length > 0 ? "Indícala si tu nivel tiene carrera (técnico, universitario, postgrado)." : undefined}
        onCambio={onCambioCarrera}
      />
      <CampoCombobox
        control={control}
        name={`estudios.${indice}.mencionId`}
        etiqueta="Mención"
        opciones={aOpciones(menciones)}
        deshabilitado={menciones.length === 0}
        placeholder={!carreraId ? "Elige primero la carrera" : menciones.length === 0 ? "Esta carrera no tiene menciones" : "Elige una mención"}
      />
      <CampoCombobox control={control} name={`estudios.${indice}.institucionId`} etiqueta="Institución" opciones={aOpciones(catalogos.instituciones)} placeholder="Busca tu institución" />
    </TarjetaItem>
  );
}

export function SeccionEstudios({ datos, catalogos, guardar, onContinuar, onAnterior, validarAlEntrar }: Props) {
  const flexible = useMemo(() => crearEsquemaEstudios({ estricto: false }), []);
  const estricto = useMemo(() => crearEsquemaEstudios({ estricto: true }), []);
  const form = useForm<ValoresEstudios>({
    resolver: zodResolver(flexible) as unknown as Resolver<ValoresEstudios>,
    defaultValues: estudiosDesdeDatos(datos),
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "estudios" });
  const { guardando, error, guardadoA, guardarSeccion } = useGuardadoSeccion({
    form, estricto, seccion: "estudios", guardar, cuerpo: cuerpoEstudios, onContinuar, validarAlEntrar,
  });
  const mensajeLista = form.formState.errors.estudios?.message ?? form.formState.errors.estudios?.root?.message;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
        <EncabezadoSeccion icono={<GraduationCap className="size-5 text-primary" aria-hidden />} titulo="Tus estudios">
          Registra al menos un estudio: el nivel académico más alto que alcanzaste (por ejemplo, tu título universitario, técnico o de bachiller).
          Si quieres, agrega también los anteriores. Hasta {MAX_ESTUDIOS}.
        </EncabezadoSeccion>
        {fields.length === 0 && <ListaVacia>Todavía no has agregado estudios. Usa el botón «Agregar estudio».</ListaVacia>}
        <ul className="flex flex-col gap-4" aria-label="Estudios">
          {fields.map((campo, i) => (
            <TarjetaEstudio
              key={campo.id}
              indice={i}
              control={form.control}
              catalogos={catalogos}
              onQuitar={() => remove(i)}
              onCambioNivel={() => {
                form.setValue(`estudios.${i}.carreraId`, "");
                form.setValue(`estudios.${i}.mencionId`, "");
              }}
              onCambioCarrera={() => form.setValue(`estudios.${i}.mencionId`, "")}
            />
          ))}
        </ul>
        {mensajeLista && <p role="alert" className="text-sm font-medium text-destructive">{mensajeLista}</p>}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          disabled={fields.length >= MAX_ESTUDIOS}
          onClick={() => {
            form.clearErrors("estudios");
            append({ ...ESTUDIO_VACIO });
          }}
        >
          <Plus aria-hidden /> Agregar estudio
        </Button>
        <PieSeccion onGuardar={() => void guardarSeccion(false)} onGuardarYSeguir={() => void guardarSeccion(true)} onAnterior={onAnterior} guardando={guardando} guardadoA={guardadoA} error={error} />
      </form>
    </Form>
  );
}
