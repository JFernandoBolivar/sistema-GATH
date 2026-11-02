"use client";

import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { OrigenFoto } from "@/shared/components/captura-foto/captura-foto";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import type { ItemBorrador } from "@/modules/autogestion/domain/entities/solicitud-actualizacion";
import {
  SECCIONES_DEF,
  claveCampo,
  etiquetaCampo,
  type EntidadDef,
} from "@/modules/autogestion/domain/value-objects/campos-seccion";
import { getMiExpedienteAction } from "@/modules/autogestion/infrastructure/actions/autogestion-actions";
import { EditorEntidad } from "@/modules/autogestion/ui/solicitudes/editor-entidad";
import { useNombresCatalogo } from "@/modules/autogestion/ui/solicitudes/use-nombres-catalogo";
import { formatearValor } from "@/modules/autogestion/ui/formato-solicitud";
import type { DetalleSolicitudDTO, SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { requiereFotoNueva } from "../../domain/services/reglas";
import {
  enviarSolicitudAction,
  guardarBorradorAction,
  subirEvidenciaAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import {
  confirmacionEnvioSchema,
  type ConfirmacionEnvioValores,
  type DatosContactoValores,
} from "../schema/schema-fe-de-vida";
import { aEntrada, cambiosAItems, fusionarContacto, valoresIniciales } from "./borrador-items";
import { PasoContacto } from "./paso-contacto";
import { PasoFoto } from "./paso-foto";

type Paso = "contacto" | "emergencia" | "hijos" | "foto" | "revisar";

const TITULOS: Record<Paso, string> = {
  contacto: "Sus datos",
  emergencia: "Emergencia y dirección",
  hijos: "Sus hijos",
  foto: "Foto con su cédula",
  revisar: "Revisar y enviar",
};

const entidadDe = (seccion: "contacto" | "vivienda" | "familiar", entidad: string): EntidadDef => {
  const def = SECCIONES_DEF[seccion].entidades.find((e) => e.entidad === entidad);
  if (!def) throw new Error(`Entidad ${entidad} no definida`);
  return def;
};

const ENTIDADES_EMERGENCIA: Array<["contacto" | "vivienda", EntidadDef]> = [
  ["contacto", entidadDe("contacto", "contacto_emergencia")],
  ["vivienda", entidadDe("vivienda", "datos_vivienda")],
];
const ENTIDAD_HIJOS = entidadDe("familiar", "familiar");

/** Todos los campos de estas entidades están habilitados para el pasivo (no hay plazo por campo). */
const CAMPOS_HABILITADOS = [...ENTIDADES_EMERGENCIA.map(([, e]) => e), ENTIDAD_HIJOS].flatMap((e) =>
  e.campos.map((c) => claveCampo(e.entidad, c.campo)),
);

interface Props {
  solicitud: SolicitudDTO;
  detalle: DetalleSolicitudDTO;
  onActualizar: () => void;
}

/** Formulario por pasos de la fe de vida: datos, emergencia y dirección, hijos, foto y envío. */
export function FormularioFeDeVida({ solicitud, detalle, onActualizar }: Props) {
  const {
    data: ficha,
    error,
    isLoading,
    mutate,
  } = useSWR("mi-expediente-fe-de-vida", () => getMiExpedienteAction());
  const inicial = useMemo(() => cambiosAItems(detalle.cambios), [detalle.cambios]);
  const [items, setItems] = useState<ItemBorrador[]>(inicial);
  const [indice, setIndice] = useState(0);
  const [foto, setFoto] = useState<{ archivo: File; origen: OrigenFoto } | null>(null);
  const [fotoSubida, setFotoSubida] = useState(false);
  const [guardando, iniciarGuardado] = useTransition();
  const [subiendo, iniciarSubida] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const nombres = useNombresCatalogo(items.map((i) => ({ campo: i.campo, valorPropuesto: i.valor })));

  const tieneHijos = useMemo(() => {
    const declarado = items.find((i) => i.entidad === "datos_complementarios" && i.campo === "tiene_hijos");
    return declarado ? declarado.valor === true : ficha?.datos_complementarios?.tiene_hijos === true;
  }, [items, ficha]);

  const pasos = useMemo<Paso[]>(
    () => (tieneHijos
      ? ["contacto", "emergencia", "hijos", "foto", "revisar"]
      : ["contacto", "emergencia", "foto", "revisar"]),
    [tieneHijos],
  );
  const paso = pasos[Math.min(indice, pasos.length - 1)];

  const confirmacion = useForm<ConfirmacionEnvioValores>({
    resolver: zodResolver(confirmacionEnvioSchema),
    defaultValues: { declaro: undefined },
  });

  if (isLoading) return <VistaCargando mensaje="Cargando sus datos…" onReintentar={() => mutate()} />;
  if (error || !ficha) {
    return <VistaError mensaje="No se pudieron cargar sus datos." onReintentar={() => mutate()} />;
  }

  function guardarYAvanzar(nuevos: ItemBorrador[], siguiente: number) {
    iniciarGuardado(async () => {
      const res = await guardarBorradorAction(solicitud.id, aEntrada(nuevos));
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      setItems(nuevos);
      setIndice(siguiente);
    });
  }

  function continuarContacto(valores: DatosContactoValores) {
    if (!ficha) return;
    guardarYAvanzar(fusionarContacto(items, valores, ficha), 1);
  }

  function subirFotoYContinuar() {
    if (!foto) {
      setIndice(indice + 1);
      return;
    }
    iniciarSubida(async () => {
      const form = new FormData();
      form.append("solicitudId", solicitud.id);
      form.append("file", foto.archivo);
      form.append("origen", foto.origen);
      const res = await subirEvidenciaAction(form);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      setFotoSubida(true);
      setFoto(null);
      setIndice(indice + 1);
    });
  }

  function enviar() {
    iniciarEnvio(async () => {
      const guardado = await guardarBorradorAction(solicitud.id, aEntrada(items));
      if (!guardado.ok) {
        toast.error(guardado.mensaje);
        return;
      }
      const res = await enviarSolicitudAction(solicitud.id);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      toast.success(res.mensaje);
      onActualizar();
    });
  }

  const fotoVigente = solicitud.tieneEvidencia || fotoSubida;
  const exigeNueva = requiereFotoNueva(solicitud) && !fotoSubida;
  const inicialesContacto = valoresIniciales(ficha, items);
  const conCambios = items.filter((i) => !(i.accion === "MODIFICAR" && i.campo === "tiene_hijos"));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Pasos de la fe de vida">
        <ol className="flex flex-wrap gap-2">
          {pasos.map((p, i) => (
            <li
              key={p}
              aria-current={i === indice ? "step" : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                i === indice
                  ? "border-primary bg-primary text-primary-foreground"
                  : i < indice
                    ? "border-success/40 bg-success-soft text-success"
                    : "text-muted-foreground"
              }`}
            >
              {i + 1}. {TITULOS[p]}
            </li>
          ))}
        </ol>
      </nav>
      <p role="status" aria-live="polite" className="sr-only">
        Paso {indice + 1} de {pasos.length}: {TITULOS[paso]}
      </p>

      {paso === "contacto" ? (
        <PasoContacto
          ficha={ficha}
          valoresIniciales={inicialesContacto}
          guardando={guardando}
          onContinuar={continuarContacto}
        />
      ) : null}

      {paso === "emergencia" ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Contacto de emergencia y dirección</h2>
          <p className="text-base text-muted-foreground">
            Revise estos datos y corríjalos si cambiaron. Si están bien, continúe.
          </p>
          {ENTIDADES_EMERGENCIA.map(([seccion, def]) => (
            <EditorEntidad
              key={def.entidad}
              seccion={seccion}
              definicion={def}
              ficha={ficha}
              items={items}
              nombres={nombres}
              camposHabilitados={CAMPOS_HABILITADOS}
              onItems={setItems}
            />
          ))}
          <NavegacionPasos
            guardando={guardando}
            onAtras={() => setIndice(indice - 1)}
            onContinuar={() => guardarYAvanzar(items, indice + 1)}
          />
        </div>
      ) : null}

      {paso === "hijos" ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Sus hijos</h2>
          <p className="text-base text-muted-foreground">
            Aparecen los hijos que ya tenemos registrados. Corrija sus datos o agregue los que falten.
          </p>
          <EditorEntidad
            seccion="familiar"
            definicion={ENTIDAD_HIJOS}
            ficha={ficha}
            items={items}
            nombres={nombres}
            camposHabilitados={CAMPOS_HABILITADOS}
            onItems={setItems}
          />
          <NavegacionPasos
            guardando={guardando}
            onAtras={() => setIndice(indice - 1)}
            onContinuar={() => guardarYAvanzar(items, indice + 1)}
          />
        </div>
      ) : null}

      {paso === "foto" ? (
        <PasoFoto
          fotoVigente={fotoVigente}
          exigeNueva={exigeNueva}
          fotoElegida={foto?.archivo ?? null}
          subiendo={subiendo}
          onFoto={(archivo, origen) => setFoto(archivo && origen ? { archivo, origen } : null)}
          onAtras={() => setIndice(indice - 1)}
          onContinuar={subirFotoYContinuar}
        />
      ) : null}

      {paso === "revisar" ? (
        <form onSubmit={confirmacion.handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Revise y envíe</h2>
          <section aria-labelledby="fv-resumen" className="rounded-lg border bg-card p-4">
            <h3 id="fv-resumen" className="text-base font-semibold">
              Datos que corrigió
            </h3>
            {conCambios.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">
                No corrigió ningún dato: se confirman los que ya tenemos.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {conCambios.map((i, n) => (
                  <li key={`${i.entidad}-${i.campo}-${n}`} className="text-base">
                    <span className="font-medium">{etiquetaCampo(i.campo, i.entidad)}:</span>{" "}
                    {formatearValor(i.valor, i.campo, nombres)}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-base">
              {tieneHijos ? "Declaró que tiene hijos." : "Declaró que no tiene hijos."}
            </p>
            <p className="mt-1 text-base">Foto con la cédula: {fotoVigente ? "cargada" : "pendiente"}.</p>
          </section>
          <div className="flex flex-col gap-1.5">
            <label className="flex min-h-11 items-start gap-3 text-base">
              <input
                type="checkbox"
                className="mt-1 size-5"
                aria-describedby={confirmacion.formState.errors.declaro ? "fv-declaro-error" : undefined}
                {...confirmacion.register("declaro")}
              />
              Declaro que los datos y la foto son verdaderos y que soy la persona de la cédula.
            </label>
            {confirmacion.formState.errors.declaro ? (
              <p id="fv-declaro-error" role="alert" className="text-sm font-medium text-danger">
                {confirmacion.formState.errors.declaro.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setIndice(indice - 1)} disabled={enviando}>
              <ArrowLeft aria-hidden /> Atrás
            </Button>
            <Button type="submit" className="min-h-11" disabled={enviando || !fotoVigente}>
              <Send aria-hidden /> {enviando ? "Enviando…" : "Enviar fe de vida"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function NavegacionPasos({
  guardando,
  onAtras,
  onContinuar,
}: {
  guardando: boolean;
  onAtras: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-3">
      <Button type="button" variant="outline" className="min-h-11" onClick={onAtras} disabled={guardando}>
        <ArrowLeft aria-hidden /> Atrás
      </Button>
      <Button type="button" className="min-h-11" onClick={onContinuar} disabled={guardando}>
        {guardando ? "Guardando…" : "Continuar"}
      </Button>
    </div>
  );
}
