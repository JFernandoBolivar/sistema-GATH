"use client";

import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import Konva from "konva";

import type { ElementoKonva, FondoCara, PersonaMuestra } from "../../../domain/entities/disenador";
import { urlArchivoBiblioteca } from "../../../domain/entities/disenador";
import { claveVistaPreviaQr, QR_PREFIJO } from "../../../domain/entities/qr-estilo";
import { vistaPreviaQrAction } from "../../../infrastructure/actions/carnetizacion-actions";
import { KonvaEdicionPuntos } from "./konva-edicion-puntos";
import { KonvaElementoItem } from "./konva-elemento-item";

interface Props {
  anchoMm: number;
  altoMm: number;
  escala: number;
  elementos: ElementoKonva[];
  caraActual: "anverso" | "reverso";
  seleccionIds: string[];
  onSeleccionarElemento: (id: string | null, aditivo?: boolean) => void;
  onSeleccionarVarios: (ids: string[]) => void;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  datosPersona: PersonaMuestra;
  coloresRegla?: { primario: string; acento: string; texto: string };
  mostrarGuias?: boolean;
  /** Fondo a sangre de la cara activa (B-2), tomado de la Biblioteca de Medios. */
  fondo?: FondoCara;
  /** Modo «Editar puntos»: elemento en edición y vértice seleccionado. */
  edicionPuntos?: { id: string; indice: number | null } | null;
  onSeleccionarPunto?: (indice: number | null) => void;
  onMoverPunto?: (indice: number, x: number, y: number) => void;
  onAgregarPunto?: (x: number, y: number) => void;
  /** Tamaño de los tiradores del Transformer en px (más grande en táctil). */
  anchorSize?: number;
}

interface RecorteImagen {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Recorte central tipo `object-fit: cover` para que el fondo cubra todo el lienzo. */
export function recorteCover(
  anchoImg: number,
  altoImg: number,
  anchoCaja: number,
  altoCaja: number,
): RecorteImagen | undefined {
  if (
    anchoImg <= 0 ||
    altoImg <= 0 ||
    anchoCaja <= 0 ||
    altoCaja <= 0
  ) {
    return undefined;
  }
  const objetivo = anchoCaja / altoCaja;
  if (anchoImg / altoImg > objetivo) {
    const ancho = altoImg * objetivo;
    return { x: (anchoImg - ancho) / 2, y: 0, width: ancho, height: altoImg };
  }
  const alto = anchoImg / objetivo;
  return { x: 0, y: (altoImg - alto) / 2, width: anchoImg, height: alto };
}

export function KonvaCanvasStage({
  anchoMm,
  altoMm,
  escala,
  elementos,
  caraActual,
  seleccionIds,
  onSeleccionarElemento,
  onSeleccionarVarios,
  onActualizarElemento,
  datosPersona,
  coloresRegla = { primario: "#16264a", acento: "#d9121f", texto: "#ffffff" },
  mostrarGuias = true,
  fondo,
  edicionPuntos = null,
  onSeleccionarPunto,
  onMoverPunto,
  onAgregarPunto,
  anchorSize = 8,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const qrSolicitados = useRef<Set<string>>(new Set());
  const trRef = useRef<Konva.Transformer>(null);
  const [imagenesCargadas, setImagenesCargadas] = useState<Record<string, HTMLImageElement>>({});
  const [marco, setMarco] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marcoRef = useRef<typeof marco>(null);
  const [guiasActivas, setGuiasActivas] = useState<{ x?: number; y?: number }>({});

  const anchoPx = anchoMm * escala;
  const altoPx = altoMm * escala;

  // Filtrar elementos de la cara visible
  const elementosCara = elementos.filter((e) => e.cara === caraActual && !e.oculto);
  const urlFondo = fondo ? urlArchivoBiblioteca(fondo.biblioteca_id) : null;

  // Cargar imágenes en memoria para Konva
  useEffect(() => {
    if (urlFondo && !imagenesCargadas[urlFondo]) {
      const imgFondo = new window.Image();
      imgFondo.crossOrigin = "anonymous";
      imgFondo.src = urlFondo;
      imgFondo.onload = () => {
        setImagenesCargadas((prev) => ({ ...prev, [urlFondo]: imgFondo }));
      };
    }
    elementosCara.forEach((el) => {
      if ((el.t === "image" || el.t === "photo") && el.src && !imagenesCargadas[el.src]) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = el.src;
        img.onload = () => {
          setImagenesCargadas((prev) => ({ ...prev, [el.src as string]: img }));
        };
      }
    });
  }, [elementosCara, imagenesCargadas, urlFondo]);

  // Vista previa fiel del estilo del QR: el backend dibuja el mismo PNG que irá en el PDF.
  // Se pide con un pequeño retardo para no saturar mientras se arrastra un slider o color.
  const clavesQr = [
    ...new Set(
      elementosCara.filter((e) => e.t === "qr").map((e) => claveVistaPreviaQr(e.qr_estilo)),
    ),
  ];
  const clavesQrTexto = clavesQr.join("\n");
  useEffect(() => {
    const pendientes = clavesQrTexto
      .split("\n")
      .filter((c) => c && !imagenesCargadas[c] && !qrSolicitados.current.has(c));
    if (pendientes.length === 0) return;
    const temporizador = window.setTimeout(() => {
      pendientes.forEach(async (clave) => {
        qrSolicitados.current.add(clave);
        const res = await vistaPreviaQrAction(JSON.parse(clave.slice(QR_PREFIJO.length)));
        if (!res.success || !res.data) return;
        const img = new window.Image();
        img.onload = () => setImagenesCargadas((prev) => ({ ...prev, [clave]: img }));
        img.src = res.data;
      });
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [clavesQrTexto, imagenesCargadas]);

  // El Transformer muestra todos los nodos seleccionados (uno o varios)
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const nodos = seleccionIds
      .map((id) => stage.findOne(`#node-${id}`))
      .filter((n): n is Konva.Node => !!n);
    // En «Editar puntos» mandan los tiradores de los vértices, no el Transformer.
    trRef.current.nodes(edicionPuntos ? [] : nodos);
    trRef.current.getLayer()?.batchDraw();
  }, [seleccionIds, elementosCara, edicionPuntos]);

  const esFondo = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) =>
    e.target === stageRef.current || e.target.name() === "canvas-background";

  const posicion = () => stageRef.current?.getPointerPosition() ?? null;
  const imagenFondo = urlFondo ? imagenesCargadas[urlFondo] : undefined;
  const recorteFondo = imagenFondo
    ? recorteCover(imagenFondo.width, imagenFondo.height, anchoPx, altoPx)
    : undefined;

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!esFondo(e)) return;
    const p = posicion();
    if (!p) return;
    marcoRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    setMarco(marcoRef.current);
  };

  const handleMouseMove = () => {
    if (!marcoRef.current) return;
    const p = posicion();
    if (!p) return;
    marcoRef.current = { ...marcoRef.current, x2: p.x, y2: p.y };
    setMarco(marcoRef.current);
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const m = marcoRef.current;
    marcoRef.current = null;
    setMarco(null);
    if (!m || !stageRef.current) return;
    const caja = {
      x: Math.min(m.x1, m.x2),
      y: Math.min(m.y1, m.y2),
      width: Math.abs(m.x2 - m.x1),
      height: Math.abs(m.y2 - m.y1),
    };
    // Un simple clic en el fondo (sin arrastrar) limpia la selección
    if (caja.width < 3 && caja.height < 3) {
      if (esFondo(e)) onSeleccionarElemento(null);
      return;
    }
    const ids = elementosCara
      .filter((el) => {
        const nodo = stageRef.current?.findOne(`#node-${el.id}`);
        return !!nodo && Konva.Util.haveIntersection(caja, nodo.getClientRect());
      })
      .map((el) => el.id);
    onSeleccionarVarios(ids);
  };

  return (
    <Stage
      ref={stageRef}
      width={anchoPx}
      height={altoPx}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
      className="shadow-2xl rounded-sm overflow-hidden border border-border/80"
    >
      <Layer>
        {/* Fondo físico del carnet */}
        <Rect
          name="canvas-background"
          x={0}
          y={0}
          width={anchoPx}
          height={altoPx}
          fill="#ffffff"
          cornerRadius={4 * escala}
        />

        {/* Fondo por cara de la Biblioteca (B-2): cubre la tarjeta, debajo de las capas */}
        {imagenFondo && recorteFondo && (
          <KonvaImage
            image={imagenFondo}
            x={0}
            y={0}
            width={anchoPx}
            height={altoPx}
            crop={recorteFondo}
            listening={false}
          />
        )}

        {/* Guías de Imán en el Centro (Snap Guides) */}
        {mostrarGuias && guiasActivas.x !== undefined && (
          <Line
            points={[guiasActivas.x, 0, guiasActivas.x, altoPx]}
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />
        )}
        {mostrarGuias && guiasActivas.y !== undefined && (
          <Line
            points={[0, guiasActivas.y, anchoPx, guiasActivas.y]}
            stroke="#3b82f6"
            strokeWidth={1}
            dash={[4, 4]}
          />
        )}

        {/* Capas y Elementos */}
        {elementosCara.map((el) => (
          <KonvaElementoItem
            key={el.id}
            elemento={el}
            escala={escala}
            anchoPx={anchoPx}
            altoPx={altoPx}
            datosPersona={datosPersona}
            coloresRegla={coloresRegla}
            imagenesCargadas={imagenesCargadas}
            editandoPuntos={edicionPuntos?.id === el.id}
            onSeleccionarElemento={onSeleccionarElemento}
            onActualizarElemento={onActualizarElemento}
            onActualizarGuias={setGuiasActivas}
          />
        ))}

        {edicionPuntos &&
          elementosCara
            .filter((el) => el.id === edicionPuntos.id)
            .map((el) => (
              <KonvaEdicionPuntos
                key={`puntos-${el.id}`}
                elemento={el}
                escala={escala}
                indiceSeleccionado={edicionPuntos.indice}
                onSeleccionarPunto={(i) => onSeleccionarPunto?.(i)}
                onMoverPunto={(i, x, y) => onMoverPunto?.(i, x, y)}
                onAgregarPunto={(x, y) => onAgregarPunto?.(x, y)}
              />
            ))}

        {marco && (
          <Rect
            x={Math.min(marco.x1, marco.x2)}
            y={Math.min(marco.y1, marco.y2)}
            width={Math.abs(marco.x2 - marco.x1)}
            height={Math.abs(marco.y2 - marco.y1)}
            fill="rgba(37,99,235,0.12)"
            stroke="#2563eb"
            strokeWidth={1}
            listening={false}
          />
        )}

        {/* Transformer interactivo para mover, rotar y escalar */}
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          anchorSize={anchorSize}
          anchorStroke="#2563eb"
          anchorFill="#ffffff"
          borderStroke="#2563eb"
          borderStrokeWidth={1.5}
        />
      </Layer>
    </Stage>
  );
}
