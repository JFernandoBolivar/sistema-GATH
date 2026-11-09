import { z } from "zod";

/** Serial del Carnet de la Patria: opcional; solo letras y números, máximo 30. */
export const SERIAL_CARNET_PATRIA = /^[A-Za-z0-9]{0,30}$/;
export const SERIAL_CARNET_PATRIA_MSG =
  "El serial del Carnet de la Patria solo admite letras y números (máximo 30)";

/** Campo zod obligatoriamente opcional (acepta vacío, `null` y `undefined`). */
export const serialCarnetPatriaZod = () =>
  z
    .string()
    .trim()
    .regex(SERIAL_CARNET_PATRIA, { message: SERIAL_CARNET_PATRIA_MSG })
    .optional()
    .nullable();
