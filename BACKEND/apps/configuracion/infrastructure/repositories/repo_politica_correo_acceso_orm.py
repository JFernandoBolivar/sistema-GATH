"""
Repositorio ORM para la política de Correo de Acceso y consultas masivas (A7).
"""
from __future__ import annotations

from typing import Sequence

from django.conf import settings
from django.db import transaction

from core.domain.catalogos import (
    CONDICION_ACTIVO,
    CONDICION_PASIVO,
    ESTATUS_ACTIVO,
    TIPO_PERSONAL_PASIVO,
)
from apps.autogestion.infrastructure.models.actualizacion_models import (
    DatosComplementariosTrabajadorModel,
)
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.configuracion.domain.correo_acceso import (
    DatosCorreoTrabajador,
    PoliticaCorreoAcceso,
    PoliticaFaltaCorreo,
    PoliticaFuenteCorreo,
)
from apps.configuracion.infrastructure.models.politica_correo_acceso_model import (
    ExcepcionCorreoAccesoModel,
    PoliticaCorreoAccesoModel,
)
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.pasivos.infrastructure.models.pasivo_models import EmployeeEgresadoModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class RepoPoliticaCorreoAccesoORM:
    def obtener_politica(self) -> PoliticaCorreoAcceso:
        reg = PoliticaCorreoAccesoModel.objects.first()
        if not reg:
            return PoliticaCorreoAcceso()
        return PoliticaCorreoAcceso(
            politica_pasivos=PoliticaFuenteCorreo(reg.politica_pasivos),
            politica_activos=PoliticaFuenteCorreo(reg.politica_activos),
            si_falta_elegido=PoliticaFaltaCorreo(reg.si_falta_elegido),
            avisar_al_aplicar_masivo=bool(reg.avisar_al_aplicar_masivo),
        )

    def actualizar_politica(
        self, datos: dict, actor_id: int | None = None
    ) -> tuple[PoliticaCorreoAcceso, PoliticaCorreoAcceso]:
        reg = PoliticaCorreoAccesoModel.objects.first()
        if not reg:
            reg = PoliticaCorreoAccesoModel.objects.create()
        anterior = PoliticaCorreoAcceso(
            politica_pasivos=PoliticaFuenteCorreo(reg.politica_pasivos),
            politica_activos=PoliticaFuenteCorreo(reg.politica_activos),
            si_falta_elegido=PoliticaFaltaCorreo(reg.si_falta_elegido),
            avisar_al_aplicar_masivo=bool(reg.avisar_al_aplicar_masivo),
        )

        if 'politica_pasivos' in datos:
            reg.politica_pasivos = PoliticaFuenteCorreo(datos['politica_pasivos']).value
        if 'politica_activos' in datos:
            reg.politica_activos = PoliticaFuenteCorreo(datos['politica_activos']).value
        if 'si_falta_elegido' in datos:
            reg.si_falta_elegido = PoliticaFaltaCorreo(datos['si_falta_elegido']).value
        if 'avisar_al_aplicar_masivo' in datos:
            reg.avisar_al_aplicar_masivo = bool(datos['avisar_al_aplicar_masivo'])
        if actor_id:
            reg.actualizado_por_id = actor_id

        reg.save()
        nuevo = PoliticaCorreoAcceso(
            politica_pasivos=PoliticaFuenteCorreo(reg.politica_pasivos),
            politica_activos=PoliticaFuenteCorreo(reg.politica_activos),
            si_falta_elegido=PoliticaFaltaCorreo(reg.si_falta_elegido),
            avisar_al_aplicar_masivo=bool(reg.avisar_al_aplicar_masivo),
        )
        return anterior, nuevo

    def registrar_excepcion_manual(
        self, cedula: str, motivo: str = '', actor_cedula: str = ''
    ) -> None:
        ExcepcionCorreoAccesoModel.objects.update_or_create(
            cedula=cedula,
            defaults={
                'motivo': motivo or 'Configurado manualmente desde Usuarios',
                'actor_cedula': actor_cedula,
            },
        )

    def listar_cedulas_excepcion(self) -> set[str]:
        return set(
            ExcepcionCorreoAccesoModel.objects.values_list('cedula', flat=True)
        )

    def listar_trabajadores_por_grupo(self, grupo: str) -> Sequence[DatosCorreoTrabajador]:
        """Consulta los trabajadores de la categoría solicitada con sus correos disponibles."""
        es_grupo_pasivos = (grupo or '').strip().lower() == 'pasivos'

        # Determinar universo de cédulas
        if es_grupo_pasivos:
            cedulas_set = set(
                AsigTrabajoModel.objects.filter(
                    Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO, employee__isnull=False
                ).values_list('employee_id', flat=True)
            ) | set(EmployeeEgresadoModel.objects.values_list('employee_id', flat=True))
            condicion_str = CONDICION_PASIVO
        else:
            pasivos_set = set(
                AsigTrabajoModel.objects.filter(
                    Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO, employee__isnull=False
                ).values_list('employee_id', flat=True)
            ) | set(EmployeeEgresadoModel.objects.values_list('employee_id', flat=True))
            cedulas_set = (
                set(
                    AsigTrabajoModel.objects.filter(
                        estatusid__estatus__iexact=ESTATUS_ACTIVO, employee__isnull=False
                    )
                    .exclude(Tipo_personal__tipo_personal__iexact=TIPO_PERSONAL_PASIVO)
                    .values_list('employee_id', flat=True)
                )
                - pasivos_set
            )
            condicion_str = CONDICION_ACTIVO

        if not cedulas_set:
            return []

        excepciones = self.listar_cedulas_excepcion()
        cuentas_existentes = set(
            CuentaModel.objects.filter(cedula_id__in=cedulas_set).values_list(
                'cedula_id', flat=True
            )
        )

        # Mapa de complementarios
        complementarios = {
            c.cedula: (c.correo_alternativo or '').strip()
            for c in DatosComplementariosTrabajadorModel.objects.filter(
                cedula__in=cedulas_set
            )
        }

        dominio_institucional = getattr(settings, 'DOMINIO_CORREO_INSTITUCIONAL', '@conatel.gob.ve')

        resultado: list[DatosCorreoTrabajador] = []
        qs_emp = EmployeeModel.objects.filter(cedulaidentidad__in=cedulas_set).order_by(
            'apellidos', 'nombres'
        )

        for emp in qs_emp:
            ced = emp.cedulaidentidad
            correo_ficha = (emp.correo or '').strip()
            correo_alt = complementarios.get(ced, '')
            # Correo institucional: si el de la ficha es institucional, o contiene el dominio
            correo_inst = (
                correo_ficha if dominio_institucional in correo_ficha.lower() else ''
            )

            resultado.append(
                DatosCorreoTrabajador(
                    cedula=ced,
                    nombre_completo=f'{emp.nombres} {emp.apellidos}'.strip(),
                    condicion=condicion_str,
                    correo_actual_acceso=correo_ficha,
                    correo_institucional=correo_inst,
                    correo_alternativo=correo_alt,
                    correo_ficha=correo_ficha,
                    tiene_cuenta=(ced in cuentas_existentes),
                    es_excepcion_manual=(ced in excepciones),
                )
            )

        return resultado

    def correo_en_uso_por_otro(self, cedula: str, correo: str) -> bool:
        """`Employee.correo` es unique: evita que el lote falle al asignar uno repetido."""
        return (
            EmployeeModel.objects.filter(correo__iexact=correo)
            .exclude(cedulaidentidad=cedula)
            .exists()
        )

    def aplicar_correo_a_empleado(self, cedula: str, nuevo_correo: str) -> None:
        """Actualiza el correo de acceso en la ficha del empleado."""
        EmployeeModel.objects.filter(cedulaidentidad=cedula).update(
            correo=nuevo_correo
        )
