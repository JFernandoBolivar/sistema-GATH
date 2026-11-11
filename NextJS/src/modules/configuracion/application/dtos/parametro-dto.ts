/**
 * DTOs de los parámetros del sistema (D9).
 *
 * Las definiciones se movieron a `domain/entities/parametro` para que el puerto
 * `RepoParametros` no importe desde `application/` (S5-02). Este módulo se
 * mantiene como punto de importación del resto de la app.
 */
export * from "../../domain/entities/parametro";
