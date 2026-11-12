"use client";

import { useId, useState, useTransition } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  FileImage,
  Filter,
  ImagePlus,
  Loader2,
  ImageOff,
  PlusCircle,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoriaBiblioteca, ElementoBiblioteca } from "../../domain/entities/carnet";
import { useBusquedaDiferida } from "../hooks/use-busqueda-diferida";
import { PaginadorServidor } from "./paginador-servidor";
import {
  eliminarElementoBibliotecaAction,
  getBibliotecaPaginaAction,
  subirElementoBibliotecaAction,
} from "../../infrastructure/actions/carnetizacion-actions";

const CATEGORIAS_FILTRO: { valor: string; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "logo", label: "Logos" },
  { valor: "firma", label: "Firmas" },
  { valor: "imagen", label: "Imágenes" },
];

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BibliotecaMediosTab() {
  const [categoriaFiltro, setCategoriaFiltroCruda] = useState<string>("todas");
  // Paginación, categoría y búsqueda se resuelven en el servidor.
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(12);
  const [busqueda, setBusquedaCruda] = useState("");
  const busquedaAplicada = useBusquedaDiferida(busqueda);
  const [modalSubirOpen, setModalSubirOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estados del modal de subida
  const [subirNombre, setSubirNombre] = useState("");
  const [subirCategoria, setSubirCategoria] = useState<CategoriaBiblioteca>("logo");
  const [subirDescripcion, setSubirDescripcion] = useState("");
  const [subirArchivo, setSubirArchivo] = useState<File | null>(null);
  const [previewSubida, setPreviewSubida] = useState<string | null>(null);
  const [dimensionesArchivo, setDimensionesArchivo] = useState<{
    ancho: number;
    alto: number;
  } | null>(null);

  // Estados de eliminación
  const [elementoAEliminar, setElementoAEliminar] = useState<ElementoBiblioteca | null>(null);

  const fileInputId = useId();

  const categoriaParam = categoriaFiltro === "todas" ? undefined : categoriaFiltro;

  const {
    data: respuestaBiblioteca,
    isLoading,
    mutate,
  } = useSWR(
    ["biblioteca-medios", categoriaParam, pagina, tamano, busquedaAplicada],
    () => getBibliotecaPaginaAction(categoriaParam, { pagina, tamano, busqueda: busquedaAplicada }),
    { keepPreviousData: true },
  );

  const datosPagina = respuestaBiblioteca && respuestaBiblioteca.success ? respuestaBiblioteca.data : null;
  const elementos: ElementoBiblioteca[] = datosPagina?.resultados ?? [];
  const hayBusqueda = busqueda.trim().length > 0;

  const setCategoriaFiltro = (valor: string) => {
    setCategoriaFiltroCruda(valor);
    setPagina(1);
  };

  const handleArchivoSeleccionado = (file: File) => {
    // Validar tipo permitido
    const tiposPermitidos = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!tiposPermitidos.includes(file.type)) {
      toast.error("Formato no permitido. Solo se aceptan PNG, JPEG, WebP o SVG.");
      return;
    }

    // Validar tamaño según categoría
    const maxBytes = subirCategoria === "firma" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      const maxMb = subirCategoria === "firma" ? "2MB" : "5MB";
      toast.error(`El archivo supera el tamaño máximo permitido (${maxMb}).`);
      return;
    }

    setSubirArchivo(file);
    if (!subirNombre) {
      // Autocompletar nombre con nombre del archivo sin extensión
      const nombreLimpio = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setSubirNombre(nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1));
    }

    // Generar vista previa y leer dimensiones
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreviewSubida(url);
      const img = new Image();
      img.onload = () => {
        setDimensionesArchivo({ ancho: img.naturalWidth, alto: img.naturalHeight });
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleSubirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subirNombre.trim()) {
      toast.error("Indique un nombre para el elemento.");
      return;
    }
    if (!subirArchivo) {
      toast.error("Seleccione un archivo de imagen o gráfico vectorial.");
      return;
    }

    const formData = new FormData();
    formData.append("nombre", subirNombre.trim());
    formData.append("categoria", subirCategoria);
    formData.append("archivo", subirArchivo);
    if (subirDescripcion.trim()) {
      formData.append("descripcion", subirDescripcion.trim());
    }

    startTransition(async () => {
      const res = await subirElementoBibliotecaAction(formData);
      if (res.success) {
        toast.success("Elemento agregado a la biblioteca exitosamente.");
        setModalSubirOpen(false);
        setSubirNombre("");
        setSubirDescripcion("");
        setSubirArchivo(null);
        setPreviewSubida(null);
        setDimensionesArchivo(null);
        mutate();
      } else {
        toast.error(res.error || "No fue posible subir el archivo.");
      }
    });
  };

  const confirmarEliminar = (elemento: ElementoBiblioteca) => {
    setElementoAEliminar(elemento);
  };

  const ejecutarEliminacion = () => {
    if (!elementoAEliminar) return;
    startTransition(async () => {
      const res = await eliminarElementoBibliotecaAction(elementoAEliminar.id);
      if (res.success) {
        toast.success("Elemento eliminado de la biblioteca.");
        setElementoAEliminar(null);
        // Si era el último de la página, retrocede para no dejar una página vacía.
        if (elementos.length === 1) setPagina((p) => Math.max(1, p - 1));
        mutate();
      } else {
        toast.error(res.error || "No fue posible eliminar el elemento.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de herramientas y filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-muted-foreground mr-1" />
          <span className="text-sm font-medium text-muted-foreground mr-2">Categoría:</span>
          {CATEGORIAS_FILTRO.map((c) => (
            <Button
              key={c.valor}
              variant={categoriaFiltro === c.valor ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaFiltro(c.valor)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <Search
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              value={busqueda}
              onChange={(e) => {
                setBusquedaCruda(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar medio por nombre…"
              className="pl-9 sm:w-64"
              aria-label="Buscar medio por nombre"
            />
          </div>
          <Button onClick={() => setModalSubirOpen(true)} className="gap-2 shrink-0" size="sm">
            <PlusCircle className="size-4" />
            Subir Medio
          </Button>
        </div>
      </div>

      {/* Grid de Medios */}
      {isLoading && !datosPagina ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : elementos.length === 0 ? (
        <Card className="shadow-xs border border-dashed">
          <CardContent className="text-center py-12">
            <ImagePlus className="size-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-semibold text-foreground mt-4">
              {hayBusqueda || categoriaFiltro !== "todas"
                ? "Ningún medio coincide con el filtro"
                : "No hay medios registrados"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {hayBusqueda || categoriaFiltro !== "todas"
                ? "Pruebe con otro nombre o cambie la categoría."
                : "Sube logos institucionales, firmas autorizadas o sellos que podrán ser incrustados en los carnets."}
            </p>
            {!hayBusqueda && categoriaFiltro === "todas" && (
              <Button
                onClick={() => setModalSubirOpen(true)}
                className="mt-4 gap-2"
                variant="outline"
              >
                <PlusCircle className="size-4" />
                Subir primer medio
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {elementos.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden border shadow-xs flex flex-col justify-between group hover:border-primary/40 transition-all"
            >
              <div>
                {/* Contenedor de previsualización con fondo cuadrícula para transparencia */}
                <div
                  className="h-36 w-full relative flex items-center justify-center p-3 border-b overflow-hidden"
                  style={{
                    backgroundColor: "#f8fafc",
                    backgroundImage:
                      "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
                    backgroundSize: "16px 16px",
                    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  }}
                >
                  <MiniaturaMedio src={item.archivo_url} nombre={item.nombre} />
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 text-[10px] font-mono capitalize backdrop-blur-xs bg-white/80 dark:bg-black/80"
                  >
                    {item.categoria}
                  </Badge>
                </div>

                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <h4
                      className="font-semibold text-sm leading-tight text-foreground truncate"
                      title={item.nombre}
                    >
                      {item.nombre}
                    </h4>
                  </div>
                  {item.descripcion && (
                    <p
                      className="text-xs text-muted-foreground line-clamp-1"
                      title={item.descripcion}
                    >
                      {item.descripcion}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1 border-t">
                    <span>
                      {item.ancho_px && item.alto_px
                        ? `${item.ancho_px} × ${item.alto_px} px`
                        : "Vectorial SVG"}
                    </span>
                    <span className="text-right">{formatearBytes(item.tamano_bytes)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 pt-0 flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 text-xs gap-1"
                  onClick={() => confirmarEliminar(item)}
                >
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {datosPagina && (
        <PaginadorServidor
          id="filas-biblioteca"
          pagina={datosPagina.pagina}
          totalPaginas={datosPagina.totalPaginas}
          tamano={datosPagina.tamano}
          total={datosPagina.total}
          cargando={isLoading}
          onPagina={setPagina}
          onTamano={(t) => {
            setTamano(t);
            setPagina(1);
          }}
        />
      )}

      {/* --- DIALOG DE SUBIDA --- */}
      <Dialog open={modalSubirOpen} onOpenChange={setModalSubirOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSubirSubmit}>
            <DialogHeader>
              <DialogTitle>Subir Medio a la Biblioteca</DialogTitle>
              <DialogDescription>
                Agrega logos, firmas o sellos con validación estricta de seguridad.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="medio-nombre">Nombre Identificador</Label>
                <Input
                  id="medio-nombre"
                  placeholder="Ej: Logo CONATEL Fondo Blanco"
                  value={subirNombre}
                  onChange={(e) => setSubirNombre(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Categoría de Medio</Label>
                <Select
                  value={subirCategoria}
                  onValueChange={(val: CategoriaBiblioteca) => setSubirCategoria(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logo">Logo Institucional</SelectItem>
                    <SelectItem value="firma">Firma Digitalizada (Máx 2MB)</SelectItem>
                    <SelectItem value="imagen">Imagen / Sello / Fondo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="medio-desc">Descripción (Opcional)</Label>
                <Input
                  id="medio-desc"
                  placeholder="Ej: Firma de la Dirección de Recursos Humanos"
                  value={subirDescripcion}
                  onChange={(e) => setSubirDescripcion(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={fileInputId}>Archivo de Imagen</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/30 transition-colors">
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleArchivoSeleccionado(f);
                    }}
                  />
                  {previewSubida ? (
                    <div className="space-y-2">
                      <div className="h-28 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewSubida}
                          alt="Previsualización"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {subirArchivo?.name} ({subirArchivo && formatearBytes(subirArchivo.size)})
                        {dimensionesArchivo &&
                          ` • ${dimensionesArchivo.ancho} × ${dimensionesArchivo.alto} px`}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById(
                            fileInputId,
                          ) as HTMLInputElement | null;
                          if (input) input.click();
                        }}
                      >
                        Cambiar archivo
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor={fileInputId}
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5 py-2"
                    >
                      <Upload className="size-8 text-muted-foreground/60" />
                      <span className="text-sm font-medium text-foreground">
                        Haz clic para seleccionar archivo
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPEG, WebP o SVG (Firmas máx 2MB, otros máx 5MB)
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalSubirOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !subirArchivo} className="gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <FileImage className="size-4" />
                    Subir Medio
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MODAL CONFIRMACIÓN DE ELIMINACIÓN --- */}
      <Dialog
        open={!!elementoAEliminar}
        onOpenChange={(open) => !open && setElementoAEliminar(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar elemento?</DialogTitle>
            <DialogDescription>
              Se eliminará{" "}
              <span className="font-semibold text-foreground">{elementoAEliminar?.nombre}</span> de
              la biblioteca. Las plantillas que ya utilicen este recurso podrían dejar de
              visualizarlo si se vuelve a renderizar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setElementoAEliminar(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={ejecutarEliminacion}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Miniatura de un medio; si el archivo no se puede leer, un aviso en vez de la imagen rota. */
function MiniaturaMedio({ src, nombre }: { src: string; nombre: string }) {
  const [falla, setFalla] = useState(false);
  if (falla) {
    return (
      <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
        <ImageOff className="size-6" aria-hidden="true" />
        <span className="text-xs">Archivo no disponible</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={nombre}
      className="max-h-full max-w-full object-contain drop-shadow-xs"
      loading="lazy"
      onError={() => setFalla(true)}
    />
  );
}
