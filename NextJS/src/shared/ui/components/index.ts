/**
 * Barrel de `shared/ui/components/` (F2.13 — cierre pragmático).
 *
 * Decisión: los primitivos shadcn viven físicamente aún en `@/components/ui/`
 * (código legado en producción). Moverlos rompería decenas de imports de la app
 * legada, y los movimientos físicos son tarea de F8. Este barrel aplica un
 * patrón puente: un archivo por primitivo que re-exporta (`export *`) desde la
 * ruta legacy, de modo que TODO código nuevo importa desde
 * `@/shared/ui/components` y en F8 solo cambia el interior de cada puente,
 * sin tocar ningún consumidor.
 */
export * from "./accordion";
export * from "./alert";
export * from "./alert-dialog";
export * from "./aspect-ratio";
export * from "./avatar";
export * from "./badge";
export * from "./breadcrumb";
export * from "./button";
export * from "./button-group";
export * from "./calendar";
export * from "./card";
export * from "./carousel";
export * from "./chart";
export * from "./checkbox";
export * from "./collapsible";
export * from "./command";
export * from "./context-menu";
export * from "./dialog";
export * from "./drawer";
export * from "./dropdown-menu";
export * from "./empty";
export * from "./field";
export * from "./form";
export * from "./hover-card";
export * from "./input";
export * from "./input-group";
export * from "./input-otp";
export * from "./item";
export * from "./kbd";
export * from "./label";
export * from "./menubar";
export * from "./navigation-menu";
export * from "./pagination";
export * from "./popover";
export * from "./progress";
export * from "./radio-group";
export * from "./scroll-area";
export * from "./select";
export * from "./separator";
export * from "./sheet";
export * from "./sidebar";
export * from "./skeleton";
export * from "./slider";
export * from "./sonner";
export * from "./spinner";
export * from "./switch";
export * from "./table";
export * from "./tabs";
export * from "./textarea";
export * from "./toast";
export * from "./toggle";
export * from "./toggle-group";
export * from "./tooltip";
