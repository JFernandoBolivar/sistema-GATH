"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/components/avatar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";
import {
  agregarInvitadosEnBloqueAction,
  getExternosInvitablesAction,
  getIdsExternosInvitablesAction,
  getIdsPersonalInvitableAction,
  getPersonalInvitableAction,
} from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import { getDependenciasAction } from "@/modules/organizacion/infrastructure/actions/organizacion-actions";
import {
  TOPE_AGREGAR_EN_BLOQUE,
  type EventoCategoria,
  type EventoZona,
  type PaginaPersonasInvitables,
  type PersonaInvitable,
  type PoblacionInvitable,
  type ResultadoAgregarEnBloque,
} from "@/modules/carnetizacion/domain/entities/evento";

type FiltroPoblacion = PoblacionInvitable | "DEPENDENCIA";

const OPCIONES_POBLACION: { valor: FiltroPoblacion; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos los trabajadores" },
  { valor: "ACTIVOS", etiqueta: "Solo activos" },
  { valor: "PASIVOS", etiqueta: "Solo pasivos" },
  { valor: "DEPENDENCIA", etiqueta: "Por dependencia u oficina" },
];

const TAMANO_PAGINA = 10;
const MIN_BUSQUEDA = 2;

interface DependenciaOpcion {
  id: number;
  nombre: string;
}

interface InvitadosAgregarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoId: string;
  categorias: EventoCategoria[];
  zonas: EventoZona[];
  onAgregados: (resultado: ResultadoAgregarEnBloque) => void;
  onGestionarZonasCategorias?: () => void;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

interface ListaPersonasProps {
  etiqueta: string;
  pagina: PaginaPersonasInvitables | null;
  cargando: boolean;
  seleccion: Set<string>;
  onAlternar: (p: PersonaInvitable) => void;
  onCambiarPagina: (n: number) => void;
  onSeleccionarTodos: () => void;
  seleccionandoTodos: boolean;
  textoVacio: string;
}

function ListaPersonas({
  etiqueta,
  pagina,
  cargando,
  seleccion,
  onAlternar,
  onCambiarPagina,
  onSeleccionarTodos,
  seleccionandoTodos,
  textoVacio,
}: ListaPersonasProps) {
  const total = pagina?.total ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {cargando ? "Buscando…" : `${total} resultado${total === 1 ? "" : "s"}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={total === 0 || seleccionandoTodos}
          onClick={onSeleccionarTodos}
        >
          {`Seleccionar todos los ${total} del filtro`}
        </Button>
      </div>

      <ul
        aria-label={etiqueta}
        className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60"
      >
        {(pagina?.resultados ?? []).map((p) => {
          const marcado = seleccion.has(p.clave);
          const id = `persona-${p.tipo}-${p.clave}`;
          return (
            <li key={p.clave} className="flex items-center gap-3 p-2.5">
              <Checkbox
                id={id}
                checked={marcado || p.ya_invitado}
                disabled={p.ya_invitado}
                onCheckedChange={() => onAlternar(p)}
                aria-label={`Seleccionar a ${p.nombre}`}
              />
              {/* Si la foto no existe o no carga, Avatar muestra las iniciales. */}
              <Avatar className="size-9 shrink-0" aria-hidden>
                {p.foto_url ? <AvatarImage src={p.foto_url} alt="" className="object-cover" /> : null}
                <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                  {iniciales(p.nombre)}
                </AvatarFallback>
              </Avatar>
              <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-0">
                <span className="truncate text-sm font-semibold">{p.nombre}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {[p.documento, p.cargo, p.dependencia].filter(Boolean).join(" · ")}
                </span>
              </Label>
              {p.condicion && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {p.condicion}
                </Badge>
              )}
              {p.ya_invitado && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Ya invitado
                </Badge>
              )}
            </li>
          );
        })}
        {!cargando && (pagina?.resultados.length ?? 0) === 0 && (
          <li className="p-6 text-center text-xs text-muted-foreground">{textoVacio}</li>
        )}
      </ul>

      {pagina && pagina.total_paginas > 1 && (
        <div className="flex items-center justify-between text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina.pagina <= 1 || cargando}
            onClick={() => onCambiarPagina(pagina.pagina - 1)}
          >
            Anterior
          </Button>
          <span>
            Página {pagina.pagina} de {pagina.total_paginas}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagina.pagina >= pagina.total_paginas || cargando}
            onClick={() => onCambiarPagina(pagina.pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

export function InvitadosAgregarDialog({
  open,
  onOpenChange,
  eventoId,
  categorias,
  zonas,
  onAgregados,
  onGestionarZonasCategorias,
}: InvitadosAgregarDialogProps) {
  const [pestana, setPestana] = useState<"personal" | "externos">("personal");
  const [poblacion, setPoblacion] = useState<FiltroPoblacion>("TODOS");
  const [dependencias, setDependencias] = useState<DependenciaOpcion[]>([]);
  const [dependenciaId, setDependenciaId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [paginaNum, setPaginaNum] = useState(1);
  const [pagina, setPagina] = useState<PaginaPersonasInvitables | null>(null);
  const [cargando, setCargando] = useState(false);
  const [seleccionandoTodos, setSeleccionandoTodos] = useState(false);
  const [selPersonal, setSelPersonal] = useState<Set<string>>(new Set());
  const [selExternos, setSelExternos] = useState<Set<string>>(new Set());
  const [categoriaId, setCategoriaId] = useState("");
  const [zonaId, setZonaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  const categoriaEfectiva = categoriaId || categorias[0]?.id || "";
  const zonaEfectiva = zonaId || zonas[0]?.id || "";
  const total = selPersonal.size + selExternos.size;

  // Dependencias del catálogo de organización, solo cuando se necesitan.
  useEffect(() => {
    if (!open || poblacion !== "DEPENDENCIA" || dependencias.length > 0) return;
    getDependenciasAction()
      .then((lista) => setDependencias(lista.map((d) => ({ id: d.id, nombre: d.nombre }))))
      .catch(() => setError("No fue posible cargar las dependencias."));
  }, [open, poblacion, dependencias.length]);

  // El servidor busca desde 2 caracteres; se espera un instante entre teclas.
  useEffect(() => {
    const t = setTimeout(() => {
      const limpio = busqueda.trim();
      setBusquedaAplicada(limpio.length >= MIN_BUSQUEDA ? limpio : "");
      setPaginaNum(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const filtroPersonal = useCallback(() => {
    if (poblacion === "DEPENDENCIA") {
      return {
        poblacion: "TODOS" as PoblacionInvitable,
        dependencia_id: dependenciaId ? Number(dependenciaId) : undefined,
        busqueda: busquedaAplicada || undefined,
      };
    }
    return { poblacion, busqueda: busquedaAplicada || undefined };
  }, [poblacion, dependenciaId, busquedaAplicada]);

  useEffect(() => {
    if (!open) return;
    if (pestana === "personal" && poblacion === "DEPENDENCIA" && !dependenciaId) {
      setPagina(null);
      return;
    }
    const numero = ++peticion.current;
    setCargando(true);
    const solicitud =
      pestana === "personal"
        ? getPersonalInvitableAction(eventoId, {
            ...filtroPersonal(),
            pagina: paginaNum,
            page_size: TAMANO_PAGINA,
          })
        : getExternosInvitablesAction(eventoId, {
            busqueda: busquedaAplicada || undefined,
            pagina: paginaNum,
            page_size: TAMANO_PAGINA,
          });
    solicitud
      .then((res) => {
        if (numero === peticion.current) setPagina(res);
      })
      .catch((err) => {
        if (numero !== peticion.current) return;
        setError(err instanceof Error ? err.message : "No fue posible buscar.");
      })
      .finally(() => {
        if (numero === peticion.current) setCargando(false);
      });
  }, [open, pestana, eventoId, filtroPersonal, busquedaAplicada, paginaNum, poblacion, dependenciaId]);

  const reiniciarBusqueda = () => {
    setPaginaNum(1);
    setPagina(null);
  };

  const alternar = (p: PersonaInvitable) => {
    if (p.ya_invitado) return;
    const setter = p.tipo === "TRABAJADOR" ? setSelPersonal : setSelExternos;
    setter((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(p.clave)) nuevo.delete(p.clave);
      else nuevo.add(p.clave);
      return nuevo;
    });
  };

  const seleccionarTodos = async () => {
    setSeleccionandoTodos(true);
    setError(null);
    try {
      if (pestana === "personal") {
        const ids = await getIdsPersonalInvitableAction(eventoId, filtroPersonal());
        setSelPersonal(new Set(ids));
      } else {
        const ids = await getIdsExternosInvitablesAction(eventoId, busquedaAplicada || undefined);
        setSelExternos(new Set(ids));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible seleccionar el filtro.");
    } finally {
      setSeleccionandoTodos(false);
    }
  };

  const agregar = async () => {
    if (total === 0) return;
    if (total > TOPE_AGREGAR_EN_BLOQUE) {
      setError(`Se pueden agregar hasta ${TOPE_AGREGAR_EN_BLOQUE} invitados a la vez.`);
      return;
    }
    if (!categoriaEfectiva || !zonaEfectiva) {
      setError("El evento necesita al menos una categoría y una zona.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resultado = await agregarInvitadosEnBloqueAction(eventoId, {
        categoria_id: categoriaEfectiva,
        zona_id: zonaEfectiva,
        cedulas: Array.from(selPersonal),
        externos_ids: Array.from(selExternos),
      });
      setSelPersonal(new Set());
      setSelExternos(new Set());
      onAgregados(resultado);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible agregar los invitados.");
    } finally {
      setEnviando(false);
    }
  };

  const textoVacioPersonal =
    poblacion === "DEPENDENCIA" && !dependenciaId
      ? "Elija una dependencia u oficina."
      : "Ninguna persona coincide con el filtro.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agregar invitados</DialogTitle>
          <DialogDescription>
            Busque y seleccione personas ya registradas; no hace falta escribir sus datos.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs
          value={pestana}
          onValueChange={(v) => {
            setPestana(v as "personal" | "externos");
            reiniciarBusqueda();
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="externos">Externos registrados</TabsTrigger>
          </TabsList>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Buscar por nombre o cédula"
              placeholder="Buscar por nombre o cédula (mínimo 2 caracteres)"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <TabsContent value="personal" className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Población</Label>
                <Select
                  value={poblacion}
                  onValueChange={(v) => {
                    setPoblacion(v as FiltroPoblacion);
                    reiniciarBusqueda();
                  }}
                >
                  <SelectTrigger aria-label="Población">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPCIONES_POBLACION.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {poblacion === "DEPENDENCIA" && (
                <div className="space-y-1">
                  <Label>Dependencia u oficina</Label>
                  <Select
                    value={dependenciaId}
                    onValueChange={(v) => {
                      setDependenciaId(v);
                      reiniciarBusqueda();
                    }}
                  >
                    <SelectTrigger aria-label="Dependencia u oficina">
                      <SelectValue placeholder="Seleccione una dependencia" />
                    </SelectTrigger>
                    <SelectContent>
                      {dependencias.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <ListaPersonas
              etiqueta="Personal"
              pagina={pagina}
              cargando={cargando}
              seleccion={selPersonal}
              onAlternar={alternar}
              onCambiarPagina={setPaginaNum}
              onSeleccionarTodos={seleccionarTodos}
              seleccionandoTodos={seleccionandoTodos}
              textoVacio={textoVacioPersonal}
            />
          </TabsContent>

          <TabsContent value="externos" className="space-y-3">
            <ListaPersonas
              etiqueta="Externos registrados"
              pagina={pagina}
              cargando={cargando}
              seleccion={selExternos}
              onAlternar={alternar}
              onCambiarPagina={setPaginaNum}
              onSeleccionarTodos={seleccionarTodos}
              seleccionandoTodos={seleccionandoTodos}
              textoVacio="Ninguna credencial externa coincide con la búsqueda."
            />
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select value={categoriaEfectiva} onValueChange={setCategoriaId}>
              <SelectTrigger aria-label="Categoría">
                <SelectValue placeholder="Seleccione categoría" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Zona</Label>
            <Select value={zonaEfectiva} onValueChange={setZonaId}>
              <SelectTrigger aria-label="Zona">
                <SelectValue placeholder="Seleccione zona" />
              </SelectTrigger>
              <SelectContent>
                {zonas.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {onGestionarZonasCategorias && (
          <button
            type="button"
            className="self-start text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              onOpenChange(false);
              onGestionarZonasCategorias();
            }}
          >
            Gestionar zonas y categorías
          </button>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm font-medium" aria-live="polite">
            {`Se agregarán ${total} invitado${total === 1 ? "" : "s"}`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" onClick={agregar} disabled={total === 0 || enviando}>
              {enviando ? "Agregando…" : "Agregar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
