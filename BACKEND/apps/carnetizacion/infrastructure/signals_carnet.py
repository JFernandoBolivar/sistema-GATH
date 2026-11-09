"""
Señales automáticas del ciclo de vida de carnets (O44 - E9).
Egreso: anula automáticamente cualquier carnet activo de un trabajador.
"""
import logging
from django.db.models.signals import post_save

logger = logging.getLogger('gath.carnetizacion')


def conectar_senales_carnet() -> None:
    try:
        from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
        from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM

        def _anular_carnet_en_egreso(sender, instance, created, **kwargs):
            if created and instance:
                try:
                    repo = RepoCarnetizacionORM()
                    emp_id = getattr(instance.employee, 'id', None) or getattr(instance, 'employee_id', None)
                    if emp_id:
                        anulados = repo.anular_carnet_por_egreso(
                            int(emp_id),
                            motivo="Egreso registrado en pasivos",
                        )
                        if anulados > 0:
                            logger.info("Anulados %d carnets activos por egreso del empleado %s", anulados, emp_id)
                except Exception:
                    logger.warning("Error anulando carnet en señal de egreso", exc_info=True)

        post_save.connect(_anular_carnet_en_egreso, sender=EmployeeEgresadoModel, weak=False)
    except Exception:
        logger.warning("No se pudo conectar la señal de egreso de carnetización", exc_info=True)
