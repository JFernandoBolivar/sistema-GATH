"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/shared/ui/components/combobox";
import {
  getCoordinacionesAction,
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getTiposNominaAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import { LIMITES_TEXTO } from "@/shared/domain/validation/limites-texto";
import type { DatosPropuesta, PropuestaCargo } from "../../domain/expediente";

interface Item {
  id: number;
  nombre: string;
  codigo?: string;
}

const aOpciones = (items: Item[]): ComboboxOption[] =>
  items.map((i) => ({ value: String(i.id), label: i.codigo ? `${i.codigo} - ${i.nombre}` : i.nombre }));

/** Lista hija de una cascada: se carga al elegir el padre y se descarta sola al cambiarlo. */
function useHijos(padreId: number | null, cargar: (id: number) => Promise<Item[]>) {
  const [estado, setEstado] = useState<{ id: number | null; items: Item[] }>({ id: null, items: [] });
  useEffect(() => {
    if (!padreId) return;
    let activo = true;
    cargar(padreId)
      .then((items) => activo && setEstado({ id: padreId, items }))
      .catch(() => activo && setEstado({ id: padreId, items: [] }));
    return () => {
      activo = false;
    };
  }, [padreId, cargar]);
  const listo = padreId !== null && estado.id === padreId;
  return { items: listo ? estado.items : [], cargando: padreId !== null && !listo };
}

interface Props {
  inicial: PropuestaCargo;
  titulo: string;
  etiquetaConfirmar: string;
  pendiente?: boolean;
  error?: string | null;
  onConfirmar: (datos: DatosPropuesta) => void;
  onCancelar: () => void;
}

interface Catalogos {
  cargos: Item[];
  especificos: Item[];
  nominas: Item[];
  dependencias: Item[];
}

const num = (v: string): number | null => (v ? Number(v) : null);

/**
 * Propuesta de cargo y oficina al abrir hacia Presupuesto. Reutiliza los catálogos de cargos y de
 * organización; si no se pueden cargar (permiso o red) ofrece texto libre para no bloquear al analista.
 */
export function DialogoPropuesta({ inicial, titulo, etiquetaConfirmar, pendiente = false, error, onConfirmar, onCancelar }: Props) {
  const [cat, setCat] = useState<Catalogos | null>(null);
  const [falloCatalogos, setFalloCatalogos] = useState(false);

  const [cargoId, setCargoId] = useState<number | null>(inicial.cargoId);
  const [especificoId, setEspecificoId] = useState<number | null>(inicial.cargoEspecificoId);
  const [nominaId, setNominaId] = useState<number | null>(inicial.tipoNominaId);
  const [dependenciaId, setDependenciaId] = useState<number | null>(inicial.dependenciaId);
  const [generalId, setGeneralId] = useState<number | null>(inicial.direccionGeneralId);
  const [lineaId, setLineaId] = useState<number | null>(inicial.direccionLineaId);
  const [coordinacionId, setCoordinacionId] = useState<number | null>(inicial.coordinacionId);
  const [cargoTexto, setCargoTexto] = useState(inicial.cargoTexto);
  const [oficinaTexto, setOficinaTexto] = useState(inicial.oficinaTexto);
  const [observaciones, setObservaciones] = useState("");
  const [intentado, setIntentado] = useState(false);

  useEffect(() => {
    let activo = true;
    Promise.all([
      getDenominacionesAction(),
      getDenominacionesEspecificasAction(),
      getTiposNominaAction(),
      getDependenciasAction(),
    ])
      .then(([cargos, especificos, nominas, dependencias]) => {
        if (activo) setCat({ cargos, especificos, nominas, dependencias });
      })
      .catch(() => activo && setFalloCatalogos(true));
    return () => {
      activo = false;
    };
  }, []);

  const generales = useHijos(dependenciaId, getDireccionesGeneralesAction);
  const lineas = useHijos(generalId, getDireccionesLineaAction);
  const coordinaciones = useHijos(lineaId, getCoordinacionesAction);

  const conCatalogos = cat !== null;
  const cargoOk = conCatalogos ? cargoId !== null : cargoTexto.trim() !== "";
  const oficinaOk = conCatalogos ? dependenciaId !== null : oficinaTexto.trim() !== "";

  function confirmar() {
    setIntentado(true);
    if (!cargoOk || !oficinaOk) return;
    const datos: DatosPropuesta = {};
    if (cargoId !== null) datos.cargo_id = cargoId;
    if (especificoId !== null) datos.cargo_especifico_id = especificoId;
    if (nominaId !== null) datos.tipo_nomina_id = nominaId;
    if (dependenciaId !== null) datos.dependencia_id = dependenciaId;
    if (generalId !== null) datos.direccion_general_id = generalId;
    if (lineaId !== null) datos.direccion_linea_id = lineaId;
    if (coordinacionId !== null) datos.coordinacion_id = coordinacionId;
    if (!conCatalogos) {
      if (cargoTexto.trim()) datos.cargo_texto = cargoTexto.trim();
      if (oficinaTexto.trim()) datos.oficina_texto = oficinaTexto.trim();
    }
    if (observaciones.trim()) datos.observaciones = observaciones.trim();
    onConfirmar(datos);
  }

  const cargandoInicial = !conCatalogos && !falloCatalogos;

  return (
    <Dialog open onOpenChange={(a) => (!a && !pendiente ? onCancelar() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Indique el cargo y la oficina que Captación propone para este postulante. Presupuesto los revisará.
          </DialogDescription>
        </DialogHeader>

        {cargandoInicial ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando catálogos…
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {falloCatalogos ? (
              <p className="sm:col-span-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                No se pudieron cargar los catálogos de cargos y oficinas. Describa la propuesta con texto libre.
              </p>
            ) : null}

            {conCatalogos ? (
              <>
                <Campo etiqueta="Cargo *" id="prop-cargo" error={intentado && !cargoOk ? "Seleccione el cargo." : undefined}>
                  <Combobox id="prop-cargo" options={aOpciones(cat.cargos)} value={cargoId ? String(cargoId) : ""} onChange={(v) => setCargoId(num(v))} placeholder="Seleccione el cargo" searchPlaceholder="Buscar cargo…" invalido={intentado && !cargoOk} />
                </Campo>
                <Campo etiqueta="Cargo específico" id="prop-especifico">
                  <Combobox id="prop-especifico" options={aOpciones(cat.especificos)} value={especificoId ? String(especificoId) : ""} onChange={(v) => setEspecificoId(num(v))} placeholder="Opcional" searchPlaceholder="Buscar cargo específico…" />
                </Campo>
                <Campo etiqueta="Tipo de nómina" id="prop-nomina">
                  <Combobox id="prop-nomina" options={aOpciones(cat.nominas)} value={nominaId ? String(nominaId) : ""} onChange={(v) => setNominaId(num(v))} placeholder="Opcional" searchPlaceholder="Buscar nómina…" />
                </Campo>
                <Campo etiqueta="Dependencia *" id="prop-dependencia" error={intentado && !oficinaOk ? "Seleccione la dependencia." : undefined}>
                  <Combobox
                    id="prop-dependencia"
                    options={aOpciones(cat.dependencias)}
                    value={dependenciaId ? String(dependenciaId) : ""}
                    onChange={(v) => {
                      setDependenciaId(num(v));
                      setGeneralId(null);
                      setLineaId(null);
                      setCoordinacionId(null);
                    }}
                    placeholder="Seleccione la dependencia"
                    searchPlaceholder="Buscar dependencia…"
                    invalido={intentado && !oficinaOk}
                  />
                </Campo>
                <Campo etiqueta="Dirección general / Oficina" id="prop-general">
                  <Combobox
                    id="prop-general"
                    options={aOpciones(generales.items)}
                    value={generalId ? String(generalId) : ""}
                    onChange={(v) => {
                      setGeneralId(num(v));
                      setLineaId(null);
                      setCoordinacionId(null);
                    }}
                    placeholder={dependenciaId ? (generales.cargando ? "Cargando…" : "Opcional") : "Elija primero la dependencia"}
                    searchPlaceholder="Buscar…"
                    disabled={!dependenciaId || generales.cargando}
                  />
                </Campo>
                <Campo etiqueta="Dirección de línea" id="prop-linea">
                  <Combobox
                    id="prop-linea"
                    options={aOpciones(lineas.items)}
                    value={lineaId ? String(lineaId) : ""}
                    onChange={(v) => {
                      setLineaId(num(v));
                      setCoordinacionId(null);
                    }}
                    placeholder={generalId ? (lineas.cargando ? "Cargando…" : "Opcional") : "Elija primero la dirección general"}
                    searchPlaceholder="Buscar…"
                    disabled={!generalId || lineas.cargando}
                  />
                </Campo>
                <Campo etiqueta="Coordinación" id="prop-coordinacion">
                  <Combobox
                    id="prop-coordinacion"
                    options={aOpciones(coordinaciones.items)}
                    value={coordinacionId ? String(coordinacionId) : ""}
                    onChange={(v) => setCoordinacionId(num(v))}
                    placeholder={lineaId ? (coordinaciones.cargando ? "Cargando…" : "Opcional") : "Elija primero la dirección de línea"}
                    searchPlaceholder="Buscar…"
                    disabled={!lineaId || coordinaciones.cargando}
                  />
                </Campo>
              </>
            ) : (
              <>
                <Campo etiqueta="Cargo propuesto *" id="prop-cargo-texto" error={intentado && !cargoOk ? "Indique el cargo." : undefined}>
                  <Input id="prop-cargo-texto" value={cargoTexto} onChange={(e) => setCargoTexto(e.target.value)} maxLength={150} aria-invalid={intentado && !cargoOk} />
                </Campo>
                <Campo etiqueta="Oficina propuesta *" id="prop-oficina-texto" error={intentado && !oficinaOk ? "Indique la oficina." : undefined}>
                  <Input id="prop-oficina-texto" value={oficinaTexto} onChange={(e) => setOficinaTexto(e.target.value)} maxLength={150} aria-invalid={intentado && !oficinaOk} />
                </Campo>
              </>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="prop-observaciones">Observaciones (opcional)</Label>
              <Textarea id="prop-observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} maxLength={LIMITES_TEXTO.observacion.max} className="h-24" />
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancelar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={pendiente || cargandoInicial}>
            {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {etiquetaConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ etiqueta, id, error, children }: { etiqueta: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
