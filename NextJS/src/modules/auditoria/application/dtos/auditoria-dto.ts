/**
 * DTOs de la bitácora de auditoría (D10).
 *
 * Las definiciones se movieron a `domain/entities/auditoria` para que el puerto
 * `RepoAuditoria` no importe desde `application/` (S5-02). Este módulo se
 * mantiene como punto de importación del resto de la app.
 */
export * from "../../domain/entities/auditoria";
