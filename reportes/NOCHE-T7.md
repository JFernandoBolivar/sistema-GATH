# NOCHE T7 — Pruebas E2E desactualizadas

**Fecha:** 2026-11-11 · **Sin commit**

Se actualizaron a la interfaz actual **sin tocar la interfaz**. Los tres fallos
eran selectores de textos que la UI ya no muestra.

| Archivo | Antes | Ahora |
| ------- | ----- | ----- |
| `NextJS/e2e/auditoria/fe-de-vida-movil.spec.ts:80` | esperaba «Guía paso a paso» | el panel se titula **«Guía de Fe de vida»** (`panel-guia-fe-de-vida.tsx:136`) |
| `NextJS/e2e/fe-de-vida.spec.ts:151` | esperaba el botón «Ampliar» | el botón es **«Ver completa»** (`visor-evidencia.tsx:40`, con icono `Maximize2`) |
| `NextJS/e2e/pasivos-fe-de-vida-reportes.spec.ts:42` | esperaba una pestaña «Pasivos» | la pantalla ya no usa pestañas: es el reporte con título **«Reporte De Pasivos»** (`app/(app)/pasivos/reportes/page.tsx`) |

## Verificación

- `npx tsc --noEmit`: 0 errores.
- `npx eslint src --quiet`: 0 errores.
- La ejecución E2E completa se hace en la FASE 2 (requiere el sistema levantado y
  las credenciales de `.env.test.local`).
