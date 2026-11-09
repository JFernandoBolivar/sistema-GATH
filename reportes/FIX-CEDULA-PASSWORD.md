# FIX-CEDULA-PASSWORD — La contraseña inicial corta ya no bloquea el cambio

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`

## Problema reportado

Hay cédulas de 5 o 6 dígitos. Como la contraseña inicial de una cuenta es la
cédula, el formulario de «Cambiar contraseña» (y el login) rechazaban esa clave
con «Mínimo 8 caracteres y máximo 32 caracteres», impidiendo completar el cambio
obligatorio.

## Causa

El value object `crearPasswordVO` aplicaba la política de longitud de la
contraseña **nueva** (8–32) tanto a la contraseña **actual** como al login. El
backend nunca exigió esa longitud para la clave existente: solo compara el hash.

## Corrección

- Nuevo `crearPasswordExistenteVO`: para el login y la contraseña actual solo
  exige presencia, máximo 128 caracteres y ausencia de HTML/caracteres de
  control. Acepta cédulas de 5 o 6 dígitos.
- `crearPasswordVO` se mantiene para la contraseña **nueva**: mínimo 8, máximo
  32.
- `iniciarSesion` usa el VO de contraseña existente.
- `cambiarPassword` usa el VO existente para la clave actual y el de política
  para la nueva.

La política del backend (Django `validate_password`) sigue aplicándose a la
contraseña nueva.

## Verificación

- `vitest src/modules/auth`: **41 passed**.
- Pruebas nuevas: login con cédula de 5 dígitos y cambio de contraseña con
  cédula actual corta; sigue rechazando la contraseña nueva corta y la actual
  vacía.
- `tsc --noEmit`: 0 errores · `eslint src/modules/auth`: 0.
