"use client";

/**
 * Diálogo consolidado de alta/edición de un elemento de catálogo de soporte
 * (alergias, patologías, discapacidades, tallas, regiones de talla, tipos de
 * prenda, organismos adscritos). Un solo diálogo con los campos dinámicos
 * según el catálogo activo — mismo patrón de "un solo diálogo" ya aplicado
 * en `modules/personal` en vez de fragmentar en un formulario por catálogo.
 * Reemplaza el `Card` de formulario inline que vivía antes en
 * `catalogos-page.tsx`; misma funcionalidad, sin perder cobertura.
 */
import { useEffect, useState, useTransition } from "react";
import { FolderPlus, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoItemDTO } from "../application/dtos/catalogos-dto";
import {
  crearAlergiaAction,
  crearCategoriaAlergiaAction,
  crearCategoriaDiscapacidadAction,
  crearCategoriaPatologiaAction,
  crearDiscapacidadAction,
  crearPatologiaAction,
  crearRegionTallaAction,
  crearTallaAction,
  crearTipoPrendaAction,
  crearOrganismoAdscritoAction,
  actualizarOrganismoAdscritoAction,
  getCategoriasAlergiaAction,
  getCategoriasDiscapacidadAction,
  getCategoriasPatologiaAction,
  getRegionesTallaAction,
  getTiposPrendaAction,
} from "../infrastructure/actions/catalogos-actions";
import type { CodigoCatalogo } from "./schema/schema-catalogos";

interface CatalogoItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: CodigoCatalogo;
  etiqueta: string;
  itemEditando: CatalogoItemDTO | null;
  onGuardado: () => void;
}

export default function CatalogoItemDialog({
  open,
  onOpenChange,
  codigo,
  etiqueta,
  itemEditando,
  onGuardado,
}: CatalogoItemDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [nombreItem, setNombreItem] = useState("");
  const [categoriaIdSeleccionada, setCategoriaIdSeleccionada] = useState("");
  const [regionIdSeleccionada, setRegionIdSeleccionada] = useState("");
  const [tipoPrendaIdSeleccionada, setTipoPrendaIdSeleccionada] = useState("");
  const [descripcionRegion, setDescripcionRegion] = useState("");

  const [mostrarCrearCategoria, setMostrarCrearCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");

  const [categoriasSalud, setCategoriasSalud] = useState<CatalogoItemDTO[]>([]);
  const [regionesTallaOpciones, setRegionesTallaOpciones] = useState<CatalogoItemDTO[]>([]);
  const [tiposPrendaOpciones, setTiposPrendaOpciones] = useState<CatalogoItemDTO[]>([]);

  useEffect(() => {
    if (!open) return;
    setNombreItem(itemEditando?.nombre ?? "");
    setCategoriaIdSeleccionada("");
    setRegionIdSeleccionada("");
    setTipoPrendaIdSeleccionada("");
    setDescripcionRegion("");
    setMostrarCrearCategoria(false);
    setNuevaCategoriaNombre("");

    if (codigo === "alergias") {
      getCategoriasAlergiaAction().then(setCategoriasSalud).catch(() => {});
    } else if (codigo === "patologias") {
      getCategoriasPatologiaAction().then(setCategoriasSalud).catch(() => {});
    } else if (codigo === "discapacidades") {
      getCategoriasDiscapacidadAction().then(setCategoriasSalud).catch(() => {});
    } else if (codigo === "tallas") {
      getRegionesTallaAction().then(setRegionesTallaOpciones).catch(() => {});
      getTiposPrendaAction().then(setTiposPrendaOpciones).catch(() => {});
    }
  }, [open, codigo, itemEditando]);

  const handleCrearCategoriaRapida = async () => {
    if (!nuevaCategoriaNombre.trim()) {
      toast.error("El nombre de la categoría es requerido.");
      return;
    }
    startTransition(async () => {
      let res: { success: boolean; message: string; item?: CatalogoItemDTO };
      if (codigo === "alergias") {
        res = await crearCategoriaAlergiaAction({ nombre_categoria: nuevaCategoriaNombre });
      } else if (codigo === "patologias") {
        res = await crearCategoriaPatologiaAction({ nombre_categoria: nuevaCategoriaNombre });
      } else {
        res = await crearCategoriaDiscapacidadAction({ nombre_categoria: nuevaCategoriaNombre });
      }

      if (res.success) {
        toast.success(res.message);
        setNuevaCategoriaNombre("");
        setMostrarCrearCategoria(false);
        const list =
          codigo === "alergias"
            ? await getCategoriasAlergiaAction()
            : codigo === "patologias"
            ? await getCategoriasPatologiaAction()
            : await getCategoriasDiscapacidadAction();
        setCategoriasSalud(list);
        if (res.item) setCategoriaIdSeleccionada(String(res.item.id));
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreItem.trim()) {
      toast.error("El nombre o valor es requerido.");
      return;
    }

    startTransition(async () => {
      let res: { success: boolean; message: string; item?: CatalogoItemDTO };

      if (codigo === "alergias") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearAlergiaAction({
          alergia: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (codigo === "patologias") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearPatologiaAction({
          patologia: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (codigo === "discapacidades") {
        if (!categoriaIdSeleccionada) {
          toast.error("Debe seleccionar una categoría.");
          return;
        }
        res = await crearDiscapacidadAction({
          discapacidad: nombreItem,
          categoria_id: Number(categoriaIdSeleccionada),
        });
      } else if (codigo === "tallas") {
        if (!regionIdSeleccionada || !tipoPrendaIdSeleccionada) {
          toast.error("Debe seleccionar región y tipo de prenda.");
          return;
        }
        res = await crearTallaAction({
          valor: nombreItem,
          region_id: Number(regionIdSeleccionada),
          tipo_prenda_id: Number(tipoPrendaIdSeleccionada),
        });
      } else if (codigo === "regiones-talla") {
        res = await crearRegionTallaAction({
          codigo: nombreItem,
          descripcion: descripcionRegion || null,
        });
      } else if (codigo === "tipos-prenda") {
        res = await crearTipoPrendaAction({ categoria: nombreItem });
      } else if (codigo === "organismos-adscritos") {
        res = itemEditando
          ? await actualizarOrganismoAdscritoAction({ id: itemEditando.id, nombre: nombreItem })
          : await crearOrganismoAdscritoAction({ nombre: nombreItem });
      } else {
        return;
      }

      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        onGuardado();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{itemEditando ? "Editar registro en" : "Nuevo registro en"} {etiqueta}</DialogTitle>
          <DialogDescription>
            {itemEditando
              ? "Modifique los datos del elemento seleccionado."
              : "Complete los campos para registrar un nuevo elemento en este catálogo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="nombreItem">
              {codigo === "regiones-talla"
                ? "Código de Región (máx. 10 car.)"
                : codigo === "tallas"
                ? "Valor de Talla (ej. M, 38, XL)"
                : codigo === "organismos-adscritos"
                ? "Nombre del Organismo Adscrito"
                : "Nombre / Descripción"}
            </Label>
            <Input
              id="nombreItem"
              value={nombreItem}
              onChange={(e) => setNombreItem(e.target.value)}
              placeholder={
                codigo === "regiones-talla"
                  ? "Ej. ADULTO"
                  : codigo === "tallas"
                  ? "Ej. M o 38"
                  : codigo === "organismos-adscritos"
                  ? "Ej. CONATEL, VTV, CANTV"
                  : "Nombre..."
              }
              maxLength={codigo === "regiones-talla" ? 10 : codigo === "organismos-adscritos" ? 50 : 100}
              disabled={isPending}
              required
            />
          </div>

          {(codigo === "alergias" || codigo === "patologias" || codigo === "discapacidades") && (
            <div>
              <div className="flex items-center justify-between pb-1">
                <Label htmlFor="catSalud">Categoría</Label>
                <button
                  type="button"
                  onClick={() => setMostrarCrearCategoria(!mostrarCrearCategoria)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <FolderPlus className="size-3" />
                  {mostrarCrearCategoria ? "Cancelar" : "+ Nueva Categoría"}
                </button>
              </div>
              {mostrarCrearCategoria ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre de nueva categoría..."
                    value={nuevaCategoriaNombre}
                    onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                    disabled={isPending}
                  />
                  <Button type="button" size="sm" onClick={handleCrearCategoriaRapida} disabled={isPending}>
                    Crear
                  </Button>
                </div>
              ) : (
                <Select value={categoriaIdSeleccionada} onValueChange={setCategoriaIdSeleccionada}>
                  <SelectTrigger id="catSalud">
                    <SelectValue placeholder="Seleccione categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasSalud.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {codigo === "tallas" && (
            <>
              <div>
                <Label htmlFor="regionSelect">Región de Talla</Label>
                <Select value={regionIdSeleccionada} onValueChange={setRegionIdSeleccionada}>
                  <SelectTrigger id="regionSelect">
                    <SelectValue placeholder="Seleccione región" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionesTallaOpciones.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prendaSelect">Tipo de Prenda</Label>
                <Select value={tipoPrendaIdSeleccionada} onValueChange={setTipoPrendaIdSeleccionada}>
                  <SelectTrigger id="prendaSelect">
                    <SelectValue placeholder="Seleccione tipo de prenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposPrendaOpciones.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {codigo === "regiones-talla" && (
            <div>
              <Label htmlFor="descRegion">Descripción (opcional)</Label>
              <Input
                id="descRegion"
                value={descripcionRegion}
                onChange={(e) => setDescripcionRegion(e.target.value)}
                placeholder="Ej. Tallas para adulto"
                disabled={isPending}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : itemEditando ? (
                <Pencil className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {itemEditando ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
