"""Repositorio ORM de parámetros del sistema y su historial de auditoría."""
from dataclasses import replace

from django.db.models import Q
from django.utils import timezone

from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    ACCION_PARAMETRO_ACTUALIZADO,
    DEFINICIONES,
    MODULO_AUDITORIA,
    RECURSO_AUDITORIA,
)
from apps.configuracion.infrastructure.mappers.mapper_parametros import parametro_a_entidad
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
from apps.personal.infrastructure.models.empleado_model import EmployeeModel
from core.domain.configuracion import CLAVE_CARNETIZACION_MI_CARNET_USUARIOS
from core.domain.exceptions import ValidationError
from core.infrastructure.models.auditoria import AuditoriaLog


class RepoParametrosORM:
    def listar(self) -> list[ParametroSistema]:
        """Solo lectura: las filas se siembran en la migración `configuracion.0003`.

        Si falta una fila (base antigua o clave nueva), se devuelve el valor por
        defecto de la definición **sin escribir**; el GET nunca crea filas.
        """
        existentes = {m.clave: m for m in ParametroSistemaModel.objects.all()}
        resultado: list[ParametroSistema] = []
        for definicion in DEFINICIONES:
            modelo = existentes.get(definicion.clave)
            if modelo is not None:
                resultado.append(replace(parametro_a_entidad(modelo), defecto=definicion.defecto))
                continue
            resultado.append(ParametroSistema(
                clave=definicion.clave,
                etiqueta=definicion.etiqueta,
                descripcion=definicion.descripcion,
                grupo=definicion.grupo,
                tipo=definicion.tipo,
                valor=definicion.defecto,
                defecto=definicion.defecto,
                minimo=definicion.minimo,
                maximo=definicion.maximo,
            ))
        return resultado

    def obtener(self, clave: str) -> ParametroSistema | None:
        modelo = ParametroSistemaModel.objects.filter(clave=clave).first()
        return parametro_a_entidad(modelo) if modelo is not None else None

    def guardar(self, parametro: ParametroSistema, actor_id: int | None) -> ParametroSistema:
        modelo, _ = ParametroSistemaModel.objects.update_or_create(
            clave=parametro.clave,
            defaults={
                'etiqueta': parametro.etiqueta,
                'descripcion': parametro.descripcion,
                'grupo': parametro.grupo,
                'tipo': parametro.tipo,
                'valor': parametro.valor,
                'valor_min': parametro.minimo,
                'valor_max': parametro.maximo,
                'actualizado_por_id': actor_id,
            },
        )
        return parametro_a_entidad(modelo)

    def historial(
        self, clave: str, limite: int, offset: int = 0
    ) -> tuple[list[CambioParametro], int]:
        qs = AuditoriaLog.objects.filter(
            modulo=MODULO_AUDITORIA,
            accion=ACCION_PARAMETRO_ACTUALIZADO,
            recurso_tipo=RECURSO_AUDITORIA,
            recurso_id=clave,
        ).order_by('-fecha_hora', '-id')
        total = qs.count()
        filas = qs[offset:offset + limite] if limite > 0 else qs[offset:]

        nombres: dict[str, str] = {}
        if clave == CLAVE_CARNETIZACION_MI_CARNET_USUARIOS:
            todas_cedulas: set[str] = set()
            for fila in filas:
                prev = str((fila.estado_previo or {}).get('valor', ''))
                post = str((fila.estado_nuevo or {}).get('valor', ''))
                todas_cedulas.update(c.strip() for c in prev.split(',') if c.strip())
                todas_cedulas.update(c.strip() for c in post.split(',') if c.strip())
            if todas_cedulas:
                nombres = self.obtener_nombres_por_cedulas(list(todas_cedulas))

        cambios: list[CambioParametro] = []
        for fila in filas:
            previo = str((fila.estado_previo or {}).get('valor', ''))
            nuevo = str((fila.estado_nuevo or {}).get('valor', ''))
            agregados: tuple[str, ...] = ()
            quitados: tuple[str, ...] = ()
            resumen_cambio: str | None = None

            if clave == CLAVE_CARNETIZACION_MI_CARNET_USUARIOS:
                set_prev = {c.strip() for c in previo.split(',') if c.strip()}
                set_nuevo = {c.strip() for c in nuevo.split(',') if c.strip()}
                agregados = tuple(f'{nombres.get(c, c)} ({c})' for c in sorted(set_nuevo - set_prev))
                quitados = tuple(f'{nombres.get(c, c)} ({c})' for c in sorted(set_prev - set_nuevo))
                partes_resumen = []
                if agregados:
                    partes_resumen.append('Agregados: ' + ', '.join(agregados))
                if quitados:
                    partes_resumen.append('Quitados: ' + ', '.join(quitados))
                resumen_cambio = '; '.join(partes_resumen) if partes_resumen else None

            cambios.append(
                CambioParametro(
                    fecha=timezone.localtime(fila.fecha_hora).isoformat(),
                    actor_cedula=fila.actor_cedula,
                    valor_previo=previo,
                    valor_nuevo=nuevo,
                    resultado=fila.resultado,
                    agregados=agregados,
                    quitados=quitados,
                    resumen_cambio=resumen_cambio,
                )
            )
        return cambios, total

    def validar_cuentas_activas(self, cedulas: list[str]) -> list[tuple[str, str]]:
        if not cedulas:
            return []
        empleados = {
            e.cedulaidentidad: f'{e.nombres} {e.apellidos}'.strip()
            for e in EmployeeModel.objects.filter(cedulaidentidad__in=cedulas)
        }
        cuentas_activas = set(
            CuentaModel.objects.filter(cedula_id__in=cedulas, is_active=True).values_list(
                'cedula_id', flat=True
            )
        )
        resultado: list[tuple[str, str]] = []
        for c in cedulas:
            if c not in empleados:
                raise ValidationError(f'«{c}»: no está registrado como trabajador.')
            if c not in cuentas_activas:
                raise ValidationError(f'«{c}»: no tiene cuenta de usuario activa en GATH.')
            resultado.append((c, empleados[c]))
        return resultado

    def obtener_nombres_por_cedulas(self, cedulas: list[str]) -> dict[str, str]:
        if not cedulas:
            return {}
        return {
            e.cedulaidentidad: f'{e.nombres} {e.apellidos}'.strip()
            for e in EmployeeModel.objects.filter(cedulaidentidad__in=cedulas)
        }

    def buscar_trabajadores(self, query: str, cedulas: list[str] | None = None) -> list[dict]:
        if cedulas:
            qs = EmployeeModel.objects.filter(cedulaidentidad__in=cedulas)
        elif query:
            qs = EmployeeModel.objects.filter(
                Q(cedulaidentidad__icontains=query)
                | Q(nombres__icontains=query)
                | Q(apellidos__icontains=query)
            )[:20]
        else:
            return []

        ceds = [e.cedulaidentidad for e in qs]
        cuentas_activas = set(
            CuentaModel.objects.filter(cedula_id__in=ceds, is_active=True).values_list(
                'cedula_id', flat=True
            )
        )
        cuentas_existentes = set(
            CuentaModel.objects.filter(cedula_id__in=ceds).values_list('cedula_id', flat=True)
        )
        return [
            {
                'cedula': e.cedulaidentidad,
                'nombre': f'{e.nombres} {e.apellidos}'.strip(),
                'tiene_cuenta': e.cedulaidentidad in cuentas_existentes,
                'cuenta_activa': e.cedulaidentidad in cuentas_activas,
            }
            for e in qs
        ]
