from django.db import models


class AuditLog(models.Model):
    """
    Registro de auditoria: login/logout/expiracion de sesion, CRUD de
    trabajadores/antecedentes/contratos, y errores no manejados del sistema
    (backend y frontend). Se escribe siempre en paralelo a los archivos de
    log en texto plano (ver USER/services/audit_service.py).
    """

    ACTION_CHOICES = [
        ("LOGIN", "LOGIN"),
        ("LOGIN_FAILED", "LOGIN_FAILED"),
        ("LOGOUT", "LOGOUT"),
        ("SESSION_EXPIRED", "SESSION_EXPIRED"),
        ("CREATE", "CREATE"),
        ("UPDATE", "UPDATE"),
        ("DELETE", "DELETE"),
        ("ERROR", "ERROR"),
    ]
    LEVEL_CHOICES = [
        ("INFO", "INFO"),
        ("WARNING", "WARNING"),
        ("ERROR", "ERROR"),
    ]
    SOURCE_CHOICES = [
        ("backend", "backend"),
        ("frontend", "frontend"),
    ]

    timestamp = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey(
        "USER.cuenta",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    # Snapshot del actor (correo/cedula) para que el registro sobreviva
    # aunque la cuenta se elimine despues.
    actor_repr = models.CharField(max_length=150, blank=True, default="")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity = models.CharField(max_length=100, blank=True, default="")
    entity_id = models.CharField(max_length=50, blank=True, default="")
    detail = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="INFO")
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default="backend")

    class Meta:
        managed = True
        app_label = "USER"
        db_table = "audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["-timestamp"]),
            models.Index(fields=["action"]),
            models.Index(fields=["entity", "entity_id"]),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.action} {self.entity}:{self.entity_id} by {self.actor_repr}"
