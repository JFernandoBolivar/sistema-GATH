"use client";

import {
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  LogIn,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface PasoGuiaDef {
  numero: number;
  titulo: string;
  resumen: string;
  icono: typeof LogIn;
  instrucciones: string;
  ejemploTitulo: string;
  ejemploDetalle: string;
  pautas?: {
    correctas: readonly string[];
    incorrectas: readonly string[];
  };
}

export const PASOS_GUIA: readonly PasoGuiaDef[] = [
  {
    numero: 1,
    titulo: "Ingreso a la plataforma",
    resumen: "Acceso con su cédula y contraseña al módulo de Fe de vida.",
    icono: LogIn,
    instrucciones:
      "Inicie sesión en el sistema GATH utilizando su número de cédula de identidad y su contraseña habitual. En el menú principal de autogestión, seleccione la opción «Fe de vida» para ingresar al proceso convocado.",
    ejemploTitulo: "Para empezar",
    ejemploDetalle:
      "En la pantalla inicial verá el nombre de la jornada vigente y la fecha límite de recepción. Pulse el botón «Comenzar mi fe de vida» para iniciar el formulario.",
  },
  {
    numero: 2,
    titulo: "Verificación de datos",
    resumen: "Confirmación y actualización de teléfonos, correo, dirección y cargas familiares.",
    icono: FileCheck2,
    instrucciones:
      "Revise con cuidado sus datos de contacto (teléfono móvil, teléfono de habitación y correo alternativo), su dirección de domicilio y la información de contactos de emergencia. Si tiene hijos menores de edad o dependientes a su cargo, indíquelo en el paso correspondiente.",
    ejemploTitulo: "Recomendación importante",
    ejemploDetalle:
      "Asegúrese de que el número móvil y el correo alternativo estén activos, ya que a través de ellos recibirá la constancia y avisos de Bienestar Social.",
  },
  {
    numero: 3,
    titulo: "Foto y documentos",
    resumen: "Fotografía selfie sosteniendo la cédula junto a su rostro y recaudos de soporte.",
    icono: Camera,
    instrucciones:
      "Debe tomarse una fotografía en vivo (selfie) sosteniendo su cédula de identidad laminada junto a su rostro a la altura del mentón o pecho. Si reportó hijos sin cédula (menores de 9 años) u otros datos que lo exijan, adjunte el documento en formato digital claro.",
    ejemploTitulo: "Guía para la fotografía",
    ejemploDetalle:
      "Sostenga su documento sin tapar sus nombres ni su rostro. Use un lugar bien iluminado frente a la cámara.",
    pautas: {
      correctas: [
        "Rostro descubierto y mirando a la cámara",
        "Cédula visible, nítida y legible al lado del rostro",
        "Buena iluminación de frente sin sombras duras",
      ],
      incorrectas: [
        "No use lentes oscuros, gorras, sombreros ni tapabocas",
        "Evite reflejos o brillos sobre los datos de la cédula",
        "No use fotos de fotos ni documentos recortados",
      ],
    },
  },
  {
    numero: 4,
    titulo: "Envío y confirmación",
    resumen: "Revisión final de los datos y declaración jurada de veracidad.",
    icono: Send,
    instrucciones:
      "Verifique el resumen de todas las modificaciones y datos cargados. Lea atentamente la declaración jurada de supervivencia y marque la casilla de aceptación para certificar la veracidad de la información antes de enviar.",
    ejemploTitulo: "Confirmación formal",
    ejemploDetalle:
      "Al presionar «Enviar mi fe de vida», su trámite pasará a la bandeja de Bienestar Social. Una vez enviada, no podrá editar los datos hasta que sea evaluada.",
  },
  {
    numero: 5,
    titulo: "Notificación y certificado",
    resumen: "Revisión por Bienestar Social, aviso por correo y descarga del certificado con QR.",
    icono: Award,
    instrucciones:
      "El equipo de Bienestar Social revisará su solicitud. Si todo está correcto, recibirá un correo electrónico con su constancia oficial emitida en PDF. En caso de requerir alguna corrección, la solicitud será devuelta con las observaciones correspondientes para que pueda ajustarla sin perder su avance.",
    ejemploTitulo: "Constancia verificable",
    ejemploDetalle:
      "La constancia digital cuenta con un número correlativo único de acta y un código QR que permite a cualquier institución pública verificar su validez en línea.",
  },
] as const;

export interface PanelGuiaFeDeVidaProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  pasoActual?: number;
}

/**
 * Panel lateral (Sheet) interactivo con los 5 pasos de la fe de vida para el pasivo.
 * Resalta el paso en que se encuentra el usuario y ofrece ejemplos claros de cada etapa.
 */
export function PanelGuiaFeDeVida({
  abierto,
  onOpenChange,
  pasoActual = 1,
}: PanelGuiaFeDeVidaProps) {
  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="sticky top-0 z-10 border-b bg-card p-5 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" aria-hidden />
            </span>
            <SheetTitle className="text-lg font-bold">
              Guía de Fe de vida
            </SheetTitle>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            Conozca los 5 pasos necesarios para consignar su fe de vida y obtener su constancia oficial.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-5">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground md:text-sm">
            <p className="font-semibold text-primary">Importante para el pasivo</p>
            <p className="mt-1 text-muted-foreground">
              La fe de vida certifica su condición ante CONATEL para asegurar la continuidad de sus asignaciones. Puede realizarla desde su teléfono inteligente o computadora con cámara.
            </p>
          </div>

          <ol className="space-y-4" aria-label="Pasos del proceso de fe de vida">
            {PASOS_GUIA.map((p) => {
              const Icono = p.icono;
              const esActual = p.numero === pasoActual;

              return (
                <li
                  key={p.numero}
                  aria-current={esActual ? "step" : undefined}
                  className={cn(
                    "relative rounded-xl border p-4 transition-colors",
                    esActual
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        esActual
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {p.numero}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <Icono className="h-4 w-4 text-primary" aria-hidden />
                          <span>{p.titulo}</span>
                        </h3>
                        {esActual && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                            Paso actual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.resumen}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-foreground md:text-sm">
                    {p.instrucciones}
                  </p>

                  <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
                    <span className="font-semibold text-foreground">{p.ejemploTitulo}: </span>
                    <span className="text-muted-foreground">{p.ejemploDetalle}</span>

                    {p.pautas && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2">
                          <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Lo que debe hacer:
                          </span>
                          <ul className="space-y-1 text-[11px] text-muted-foreground">
                            {p.pautas.correctas.map((c, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-emerald-600">•</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1.5 rounded-md border border-rose-500/20 bg-rose-500/5 p-2">
                          <span className="flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-400">
                            <XCircle className="h-3.5 w-3.5" aria-hidden /> Lo que debe evitar:
                          </span>
                          <ul className="space-y-1 text-[11px] text-muted-foreground">
                            {p.pautas.incorrectas.map((c, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-rose-600">•</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        </ScrollArea>

        <div className="sticky bottom-0 border-t bg-card p-4">
          <SheetClose asChild>
            <Button type="button" className="min-h-10 w-full font-medium">
              Entendido
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export interface BotonVerGuiaProps {
  onClick: () => void;
  className?: string;
  variante?: "outline" | "ghost" | "default" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

/** Botón accesible para abrir la guía de 5 pasos en cualquier momento. */
export function BotonVerGuia({
  onClick,
  className,
  variante = "outline",
  size = "sm",
}: BotonVerGuiaProps) {
  return (
    <Button
      type="button"
      variant={variante}
      size={size}
      onClick={onClick}
      className={cn("gap-1.5 font-medium", className)}
      aria-label="Ver guía de 5 pasos de la fe de vida"
    >
      <HelpCircle className="h-4 w-4" aria-hidden />
      <span>Ver guía</span>
    </Button>
  );
}
